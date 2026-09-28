-- Our Kahani: rules for every feature, still from metadata only.
--
-- records.kind ranges (the envelope is always AES-256-GCM ciphertext made on a phone):
--   1-49     answers: the partner's is withheld until you have answered the same ref
--   50       time capsule line: withheld from the partner until 90 days after it was written
--   100-199  shared as soon as submitted (profiles, suggestions, reactions, games, photos...)
--   140      the room hashtag, final: write-once for the room, never changed or deleted
--   200-299  private: only the author can ever read them (saved notes). A saved copy of the
--            partner's record has ref "copy:<record id>" and is deleted when the original is.
--
-- What the server can see, added by this migration: "keep this room" votes (a yes per person,
-- never shown to the partner), and for recovery an opaque lookup hash per person.

-- ---------------------------------------------------------------------------
-- Reading: the reveal rule for every kind
-- ---------------------------------------------------------------------------
drop policy records_read on public.records;
drop function private.can_read_record(uuid, uuid, smallint, text, boolean);

create function private.can_read_record(
  p_room uuid, p_author uuid, p_kind smallint, p_ref text, p_submitted boolean, p_created timestamptz
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_author = (select auth.uid())
    or (
      private.is_member(p_room)
      and p_submitted
      and (
        (p_kind between 100 and 199)
        or (p_kind < 50 and private.answered_by_me(p_room, p_kind, p_ref))
        or (p_kind = 50 and p_created <= now() - interval '90 days')
      )
    );
$$;
revoke all on function private.can_read_record(uuid, uuid, smallint, text, boolean, timestamptz) from public;
grant execute on function private.can_read_record(uuid, uuid, smallint, text, boolean, timestamptz) to authenticated;

create policy records_read on public.records
  for select to authenticated
  using (private.can_read_record(room_id, author_id, kind, ref, submitted, created_at));

-- ---------------------------------------------------------------------------
-- Writing: answers lock once both have answered; capsule and hashtag never change
-- ---------------------------------------------------------------------------
drop policy records_update_own on public.records;
create policy records_update_own on public.records
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and private.room_open(room_id)
    and (
      (kind between 100 and 299 and kind <> 140)
      or (kind < 50 and not private.answered_by_partner(room_id, kind, ref))
    )
  );

drop policy records_delete_own on public.records;
create policy records_delete_own on public.records
  for delete to authenticated
  using (author_id = (select auth.uid()) and kind <> 140);

-- The hashtag is write-once for the whole room.
create unique index records_one_hashtag on public.records (room_id) where kind = 140;

-- Answer status now covers the time capsule too (sealed or not; never its content).
create or replace function public.room_answers(p_room uuid)
returns table (kind smallint, ref text, mine boolean)
language sql stable security definer set search_path = ''
as $$
  select r.kind, r.ref, r.author_id = (select auth.uid())
  from public.records r
  where r.room_id = p_room and r.submitted and r.kind <= 50 and private.is_member(p_room);
$$;

-- ---------------------------------------------------------------------------
-- Taking something back deletes saved copies of it
-- ---------------------------------------------------------------------------
create function private.delete_copies()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.records
  where room_id = old.room_id and kind between 200 and 299 and ref = 'copy:' || old.id::text;
  return old;
end;
$$;
create trigger records_delete_copies
  after delete on public.records
  for each row when (old.kind < 200)
  execute function private.delete_copies();

-- ---------------------------------------------------------------------------
-- Caps (stay on the free tier): records per room, photos per room
-- ---------------------------------------------------------------------------
create function private.enforce_caps()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.records where room_id = new.room_id) >= 5000 then
    raise exception 'This room is full' using errcode = 'P0004';
  end if;
  if new.kind = 120 and (select count(*) from public.records where room_id = new.room_id and kind = 120) >= 20 then
    raise exception 'This room already has 20 photos' using errcode = 'P0005';
  end if;
  return new;
end;
$$;
create trigger records_caps before insert on public.records
  for each row execute function private.enforce_caps();

-- ---------------------------------------------------------------------------
-- Keep the room four more weeks: needs both, votes hidden from each other
-- ---------------------------------------------------------------------------
alter table public.rooms add column cycle integer not null default 1;

create table public.keep_votes (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  cycle integer not null,
  primary key (room_id, user_id)
);
alter table public.keep_votes enable row level security;
revoke all on public.keep_votes from public, anon, authenticated;
grant select on public.keep_votes to authenticated;
-- Each person sees only their own vote.
create policy keep_votes_own on public.keep_votes
  for select to authenticated using (user_id = (select auth.uid()));

create function public.vote_keep(p_room uuid, p_keep boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cycle integer;
begin
  if not private.is_member(p_room) then
    raise exception 'Not a member' using errcode = '42501';
  end if;
  select r.cycle into v_cycle from public.rooms r where r.id = p_room and r.ends_at > now() for update;
  if not found then
    raise exception 'This room has ended' using errcode = 'P0006';
  end if;
  if not p_keep then
    delete from public.keep_votes where room_id = p_room and user_id = v_uid;
    return false;
  end if;
  insert into public.keep_votes (room_id, user_id, cycle) values (p_room, v_uid, v_cycle)
  on conflict (room_id, user_id) do update set cycle = excluded.cycle;
  if (select count(*) from public.keep_votes where room_id = p_room and cycle = v_cycle) >= 2 then
    update public.rooms set ends_at = ends_at + interval '28 days', cycle = cycle + 1 where id = p_room;
    delete from public.keep_votes where room_id = p_room;
    return true;
  end if;
  return false;
end;
$$;
revoke all on function public.vote_keep(uuid, boolean) from public, anon;
grant execute on function public.vote_keep(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Recovery: a key backup wrapped under a key derived from the 12 words
-- ---------------------------------------------------------------------------
-- lookup = SHA-256 of a lookup token derived (HKDF) from the recovery words. The envelope
-- holds the room key and the person's private-notes key, encrypted with another key derived
-- from the same words. The server can store and return it, never open it.
create table private.key_backups (
  lookup bytea primary key check (octet_length(lookup) = 32),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  envelope bytea not null check (octet_length(envelope) between 29 and 4096),
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);
alter table private.key_backups enable row level security;
revoke all on private.key_backups from public, anon, authenticated;

create function public.save_backup(p_room uuid, p_token bytea, p_envelope bytea)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not private.is_member(p_room) then
    raise exception 'Not a member' using errcode = '42501';
  end if;
  if p_token is null or octet_length(p_token) <> 32 then
    raise exception 'Invalid token' using errcode = '22023';
  end if;
  delete from private.key_backups where room_id = p_room and user_id = v_uid;
  insert into private.key_backups (lookup, room_id, user_id, envelope)
  values (pg_catalog.sha256(p_token), p_room, v_uid, p_envelope);
end;
$$;

-- Moves the person's membership, records and backup to this browser's new anonymous account.
create function public.recover_room(p_token bytea)
returns table (room_id uuid, role text, envelope bytea)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  b record;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select k.* into b from private.key_backups k
  join public.rooms r on r.id = k.room_id
  where k.lookup = pg_catalog.sha256(p_token) and r.ends_at > now();
  if not found then
    raise exception 'Those words do not match a room' using errcode = 'P0007';
  end if;
  if b.user_id <> v_uid then
    update public.members m set user_id = v_uid where m.room_id = b.room_id and m.user_id = b.user_id;
    update public.records rc set author_id = v_uid where rc.room_id = b.room_id and rc.author_id = b.user_id;
    update public.keep_votes kv set user_id = v_uid where kv.room_id = b.room_id and kv.user_id = b.user_id;
    update private.key_backups k set user_id = v_uid where k.lookup = b.lookup;
  end if;
  return query
    select b.room_id, m.role, b.envelope from public.members m where m.room_id = b.room_id and m.user_id = v_uid;
end;
$$;

revoke all on function public.save_backup(uuid, bytea, bytea) from public, anon;
revoke all on function public.recover_room(bytea) from public, anon;
grant execute on function public.save_backup(uuid, bytea, bytea) to authenticated;
grant execute on function public.recover_room(bytea) to authenticated;

-- ---------------------------------------------------------------------------
-- Nightly: erase ended rooms, clean up unused anonymous accounts
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

create function private.nightly_cleanup()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- Erasing deletes the ciphertext; the keys only ever existed on the two phones.
  delete from public.rooms where ends_at < now();
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '7 days'
    and not exists (select 1 from public.members m where m.user_id = u.id);
end;
$$;
revoke all on function private.nightly_cleanup() from public;

select cron.schedule('our-kahani-nightly-cleanup', '17 3 * * *', 'select private.nightly_cleanup()');
