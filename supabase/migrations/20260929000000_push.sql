-- Optional push notifications. They never carry content: the push has no payload at all, and
-- the phone shows one fixed line, "Your room needs attention".
--
-- What the server can see, added by this migration: for each person who switched notifications
-- on, the push service address their browser gave (a random URL at Google, Mozilla, Apple or
-- Microsoft), which room it belongs to, and when the person last nudged their partner.
-- The push service sees that a push arrived, never what for.

-- The VAPID signing key pair for this project (one row). Only the push Edge Function reads the
-- private half, through push_secret(), which only the service role may call.
create table private.push_config (
  id smallint primary key default 1 check (id = 1),
  public_key text not null,
  private_jwk jsonb not null
);

create table public.push_subscriptions (
  endpoint text primary key check (
    octet_length(endpoint) <= 1024
    and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]*push\.apple\.com|[a-z0-9.-]*\.notify\.windows\.com)/'
  ),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;

-- One nudge per person per room every 10 minutes, however many things they answer.
create table private.push_log (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create function public.push_public_key()
returns text
language sql stable security definer set search_path = ''
as $$
  select public_key from private.push_config where id = 1;
$$;
revoke all on function public.push_public_key() from public;
grant execute on function public.push_public_key() to anon, authenticated;

create function public.push_subscribe(p_room uuid, p_endpoint text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not (private.is_member(p_room) and private.room_open(p_room)) then
    raise exception 'Not a member' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (endpoint, room_id, user_id) values (p_endpoint, p_room, v_uid)
  on conflict (endpoint) do update set room_id = excluded.room_id, user_id = excluded.user_id, created_at = now();
  -- At most three devices per person per room: drop the oldest.
  delete from public.push_subscriptions s
  where s.room_id = p_room and s.user_id = v_uid
    and s.endpoint not in (
      select endpoint from public.push_subscriptions
      where room_id = p_room and user_id = v_uid order by created_at desc limit 3
    );
end;
$$;

create function public.push_unsubscribe(p_endpoint text)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = (select auth.uid());
$$;

-- Called (through the Edge Function) with the sender's own token. Returns the partner's push
-- addresses, or nothing if this person already nudged them in the last 10 minutes. A call with
-- nobody to nudge does not use up the 10 minutes.
create function public.push_targets(p_room uuid)
returns setof text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not (private.is_member(p_room) and private.room_open(p_room)) then
    return;
  end if;
  if exists (
    select 1 from private.push_log l
    where l.room_id = p_room and l.user_id = v_uid and l.sent_at > now() - interval '10 minutes'
  ) then
    return;
  end if;
  if not exists (select 1 from public.push_subscriptions s where s.room_id = p_room and s.user_id <> v_uid) then
    return;
  end if;
  insert into private.push_log (room_id, user_id) values (p_room, v_uid)
  on conflict (room_id, user_id) do update set sent_at = now();
  return query
    select s.endpoint from public.push_subscriptions s where s.room_id = p_room and s.user_id <> v_uid;
end;
$$;

revoke all on function public.push_subscribe(uuid, text) from public, anon;
revoke all on function public.push_unsubscribe(text) from public, anon;
revoke all on function public.push_targets(uuid) from public, anon;
grant execute on function public.push_subscribe(uuid, text) to authenticated;
grant execute on function public.push_unsubscribe(text) to authenticated;
grant execute on function public.push_targets(uuid) to authenticated;

-- Service role only (the Edge Function): the signing key, and forgetting dead addresses.
create function public.push_secret()
returns json
language sql stable security definer set search_path = ''
as $$
  select json_build_object('public_key', public_key, 'private_jwk', private_jwk) from private.push_config where id = 1;
$$;
create function public.push_forget(p_endpoint text)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;
revoke all on function public.push_secret() from public, anon, authenticated;
revoke all on function public.push_forget(text) from public, anon, authenticated;
grant execute on function public.push_secret() to service_role;
grant execute on function public.push_forget(text) to service_role;

-- The key pair is made inside the Edge Function the first time it runs, so the private key
-- never passes through the repo, a terminal or a person. First write wins.
create function public.push_init(p_public text, p_private jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into private.push_config (id, public_key, private_jwk) values (1, p_public, p_private)
  on conflict (id) do nothing;
$$;
revoke all on function public.push_init(text, jsonb) from public, anon, authenticated;
grant execute on function public.push_init(text, jsonb) to service_role;
