-- Partner rescue: one person lost their device and their phrase; the other makes a one-time
-- rescue code on their own phone.
--
-- What the server can see, added by this migration: that a rescue was made for a room, by whom
-- and for whom, when it expires (24 hours), the SHA-256 of a lookup token derived from the code
-- and hashtag, and the room key sealed under a key from the same code. It cannot open it: the
-- code (80 random bits) never leaves the two people.

create table private.rescues (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  for_user uuid not null references auth.users (id) on delete cascade,
  made_by uuid not null references auth.users (id) on delete cascade,
  lookup bytea not null unique check (octet_length(lookup) = 32),
  envelope bytea not null check (octet_length(envelope) between 29 and 1024),
  expires_at timestamptz not null default now() + interval '24 hours'
);
alter table private.rescues enable row level security;
revoke all on private.rescues from public, anon, authenticated;

-- The caller's own key backup, without moving anything: the partner opens it on their phone
-- to get the room key they seal into a rescue. Null when the phrase does not match.
create function public.read_backup(p_token bytea)
returns bytea
language sql stable security definer set search_path = ''
as $$
  select k.envelope from private.key_backups k
  where k.lookup = pg_catalog.sha256(p_token) and k.user_id = (select auth.uid());
$$;

create function public.create_rescue(p_room uuid, p_token bytea, p_envelope bytea)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_other uuid;
  v_expires timestamptz := now() + interval '24 hours';
begin
  if not (private.is_member(p_room) and private.room_open(p_room)) then
    raise exception 'Not a member' using errcode = '42501';
  end if;
  if p_token is null or octet_length(p_token) <> 32 then
    raise exception 'Invalid token' using errcode = '22023';
  end if;
  select m.user_id into v_other from public.members m where m.room_id = p_room and m.user_id <> v_uid;
  if v_other is null then
    raise exception 'Nobody to rescue yet' using errcode = 'P0010';
  end if;
  insert into private.rescues (room_id, for_user, made_by, lookup, envelope, expires_at)
  values (p_room, v_other, v_uid, pg_catalog.sha256(p_token), p_envelope, v_expires)
  on conflict (room_id) do update
    set for_user = excluded.for_user, made_by = excluded.made_by, lookup = excluded.lookup,
        envelope = excluded.envelope, expires_at = excluded.expires_at;
  return v_expires;
end;
$$;

create function public.rescue_status(p_room uuid)
returns timestamptz
language sql stable security definer set search_path = ''
as $$
  select r.expires_at from private.rescues r
  where r.room_id = p_room and r.made_by = (select auth.uid()) and r.expires_at > now();
$$;

create function public.cancel_rescue(p_room uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from private.rescues where room_id = p_room and made_by = (select auth.uid());
$$;

-- Used once, within 24 hours, from a new browser. The lost person's place (membership, records,
-- keep vote) moves to this browser's account, their old phrase stops working, and their old
-- private notes are removed (they were sealed with a notes key nobody has any more).
create function public.use_rescue(p_token bytea)
returns table (room_id uuid, role text, envelope bytea)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  r record;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select x.* into r from private.rescues x
  join public.rooms rm on rm.id = x.room_id
  where x.lookup = pg_catalog.sha256(p_token) and x.expires_at > now() and rm.ends_at > now();
  if not found then
    raise exception 'That rescue code does not work' using errcode = 'P0009';
  end if;
  -- It is for the other person: never usable by someone already in the room.
  if exists (select 1 from public.members m where m.room_id = r.room_id and m.user_id = v_uid and v_uid <> r.for_user) then
    raise exception 'That rescue code does not work' using errcode = 'P0009';
  end if;
  if v_uid <> r.for_user then
    update public.members m set user_id = v_uid where m.room_id = r.room_id and m.user_id = r.for_user;
    update public.records rc set author_id = v_uid where rc.room_id = r.room_id and rc.author_id = r.for_user;
    update public.keep_votes kv set user_id = v_uid where kv.room_id = r.room_id and kv.user_id = r.for_user;
  end if;
  delete from public.records rc where rc.room_id = r.room_id and rc.author_id = v_uid and rc.kind between 200 and 299;
  delete from private.key_backups k where k.room_id = r.room_id and k.user_id in (r.for_user, v_uid);
  delete from public.push_subscriptions s where s.room_id = r.room_id and s.user_id = r.for_user;
  delete from private.rescues x where x.room_id = r.room_id;
  return query
    select r.room_id, m.role, r.envelope from public.members m where m.room_id = r.room_id and m.user_id = v_uid;
end;
$$;

revoke all on function public.read_backup(bytea) from public, anon;
revoke all on function public.create_rescue(uuid, bytea, bytea) from public, anon;
revoke all on function public.rescue_status(uuid) from public, anon;
revoke all on function public.cancel_rescue(uuid) from public, anon;
revoke all on function public.use_rescue(bytea) from public, anon;
grant execute on function public.read_backup(bytea) to authenticated;
grant execute on function public.create_rescue(uuid, bytea, bytea) to authenticated;
grant execute on function public.rescue_status(uuid) to authenticated;
grant execute on function public.cancel_rescue(uuid) to authenticated;
grant execute on function public.use_rescue(bytea) to authenticated;

-- Nightly: also drop expired rescues.
create or replace function private.nightly_cleanup()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.rooms where ends_at < now();
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '7 days'
    and not exists (select 1 from public.members m where m.user_id = u.id);
  delete from private.media_purge where gone_at < now() - interval '8 days';
  delete from private.rescues where expires_at < now();
end;
$$;
revoke all on function private.nightly_cleanup() from public;
