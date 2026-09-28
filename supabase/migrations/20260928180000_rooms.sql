-- Our Kahani: rooms, members, records.
--
-- What the server can see: that a room exists, when it was made and ends, its two members'
-- anonymous user ids and roles, and for each record its kind, an opaque card ref, whether it
-- was submitted, its size and time. Everything a person can read (names, answers, notes,
-- the hashtag, photos) is inside `records.envelope`, AES-256-GCM ciphertext made on the phone.
-- The server never sees a room key: joining proves the key with a one-way token.

-- ---------------------------------------------------------------------------
-- Private schema: not exposed by the API. Helpers and secrets live here.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ends_at timestamptz not null default now() + interval '28 days',
  invite_expires_at timestamptz not null default now() + interval '48 hours'
);
comment on table public.rooms is 'No user content here. Anything readable is an encrypted record.';

-- SHA-256 of the join token, which is derived from the room key on the phone (HKDF). Lets the
-- server check that a joiner holds the key without ever learning it.
create table private.join_verifiers (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  verifier bytea not null check (octet_length(verifier) = 32)
);

create table public.members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('creator', 'invitee')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  -- One creator and one invitee: a room never has more than two people.
  unique (room_id, role)
);

create table public.records (
  -- Made on the phone: the id is part of the envelope's AAD, so it must exist before encrypting.
  id uuid primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Kinds 1-99 are answers: hidden from the partner until they have answered the same ref.
  -- Kinds 100+ are shared with the partner as soon as they are submitted.
  kind smallint not null check (kind between 1 and 32767),
  -- Opaque card id from a pack (e.g. "warm.1"), never user text.
  ref text not null check (ref ~ '^[A-Za-z0-9._:-]{1,64}$'),
  submitted boolean not null default true,
  -- version(1) + iv(12) + tag(16) = 29 bytes minimum. Large media goes to R2, not here.
  envelope bytea not null check (octet_length(envelope) between 29 and 16384),
  created_at timestamptz not null default now(),
  unique (room_id, author_id, kind, ref)
);
create index records_room_created on public.records (room_id, created_at);

alter table public.rooms enable row level security;
alter table public.members enable row level security;
alter table public.records enable row level security;
alter table private.join_verifiers enable row level security;

-- Supabase grants everything on new tables to the API roles by default. Start from nothing.
revoke all on public.rooms, public.members, public.records from public, anon, authenticated;
revoke all on private.join_verifiers from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies do not recurse through RLS)
-- ---------------------------------------------------------------------------
create function private.is_member(p_room uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.room_id = p_room and m.user_id = (select auth.uid())
  );
$$;

create function private.room_open(p_room uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.rooms r where r.id = p_room and r.ends_at > now());
$$;

-- True when the caller has submitted their own record for this answer.
create function private.answered_by_me(p_room uuid, p_kind smallint, p_ref text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.records r
    where r.room_id = p_room and r.author_id = (select auth.uid())
      and r.kind = p_kind and r.ref = p_ref and r.submitted
  );
$$;

-- True when the partner has submitted their record for this answer.
create function private.answered_by_partner(p_room uuid, p_kind smallint, p_ref text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.records r
    where r.room_id = p_room and r.author_id <> (select auth.uid())
      and r.kind = p_kind and r.ref = p_ref and r.submitted
  );
$$;

-- The reveal rule, from metadata only: your own records always; your partner's shared
-- records once submitted; your partner's answers only after you have answered the same card.
create function private.can_read_record(p_room uuid, p_author uuid, p_kind smallint, p_ref text, p_submitted boolean)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_author = (select auth.uid())
    or (
      private.is_member(p_room)
      and p_submitted
      and (p_kind >= 100 or private.answered_by_me(p_room, p_kind, p_ref))
    );
$$;

revoke all on function private.is_member(uuid) from public;
revoke all on function private.room_open(uuid) from public;
revoke all on function private.answered_by_me(uuid, smallint, text) from public;
revoke all on function private.answered_by_partner(uuid, smallint, text) from public;
revoke all on function private.can_read_record(uuid, uuid, smallint, text, boolean) from public;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.room_open(uuid) to authenticated;
grant execute on function private.answered_by_me(uuid, smallint, text) to authenticated;
grant execute on function private.answered_by_partner(uuid, smallint, text) to authenticated;
grant execute on function private.can_read_record(uuid, uuid, smallint, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies and grants (the API only ever sees these)
-- ---------------------------------------------------------------------------
grant select on public.rooms to authenticated;
create policy rooms_members_read on public.rooms
  for select to authenticated using (private.is_member(id));

grant select on public.members to authenticated;
create policy members_room_read on public.members
  for select to authenticated using (private.is_member(room_id));

grant select, delete on public.records to authenticated;
grant insert (id, room_id, kind, ref, submitted, envelope) on public.records to authenticated;
-- Only the ciphertext and the submitted flag can change; never the room, kind, ref or author.
grant update (envelope, submitted) on public.records to authenticated;

create policy records_read on public.records
  for select to authenticated
  using (private.can_read_record(room_id, author_id, kind, ref, submitted));

create policy records_insert_own on public.records
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and private.is_member(room_id)
    and private.room_open(room_id)
  );

-- An answer can be changed until the partner has answered too; then it is locked.
create policy records_update_own on public.records
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and private.room_open(room_id)
    and (kind >= 100 or not private.answered_by_partner(room_id, kind, ref))
  );

create policy records_delete_own on public.records
  for delete to authenticated
  using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- RPCs: the only way to create, join or erase a room
-- ---------------------------------------------------------------------------
create function public.create_room(p_verifier bytea)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room uuid;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if p_verifier is null or octet_length(p_verifier) <> 32 then
    raise exception 'Invalid verifier' using errcode = '22023';
  end if;
  -- A person can have at most three open rooms (limits abuse of anonymous sign-in).
  if (
    select count(*) from public.members m
    join public.rooms r on r.id = m.room_id
    where m.user_id = v_uid and r.ends_at > now()
  ) >= 3 then
    raise exception 'Too many open rooms' using errcode = 'P0001';
  end if;

  insert into public.rooms default values returning id into v_room;
  insert into private.join_verifiers (room_id, verifier) values (v_room, p_verifier);
  insert into public.members (room_id, user_id, role) values (v_room, v_uid, 'creator');
  return v_room;
end;
$$;

-- p_token is HKDF(room key, "our-kahani/join/v1"); the server stores only its SHA-256.
create function public.join_room(p_room uuid, p_token bytea)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;

  select m.role into v_role from public.members m where m.room_id = p_room and m.user_id = v_uid;
  if found then
    return v_role; -- joining again is harmless
  end if;

  perform 1
  from public.rooms r
  join private.join_verifiers j on j.room_id = r.id
  where r.id = p_room
    and r.ends_at > now()
    and r.invite_expires_at > now()
    and j.verifier = pg_catalog.sha256(p_token);
  if not found then
    raise exception 'This invite is not valid' using errcode = 'P0002';
  end if;

  begin
    insert into public.members (room_id, user_id, role) values (p_room, v_uid, 'invitee');
  exception when unique_violation then
    raise exception 'This room already has two people' using errcode = 'P0003';
  end;
  return 'invitee';
end;
$$;

-- Answer status from metadata only, so the partner's phone can show "has answered" without
-- receiving their ciphertext.
create function public.room_answers(p_room uuid)
returns table (kind smallint, ref text, mine boolean)
language sql stable security definer set search_path = ''
as $$
  select r.kind, r.ref, r.author_id = (select auth.uid())
  from public.records r
  where r.room_id = p_room and r.submitted and r.kind < 100 and private.is_member(p_room);
$$;

-- Either person can erase the room: ciphertext and membership are deleted for good.
create function public.erase_room(p_room uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_member(p_room) then
    raise exception 'Not a member' using errcode = '42501';
  end if;
  delete from public.rooms where id = p_room;
end;
$$;

revoke all on function public.create_room(bytea) from public, anon;
revoke all on function public.join_room(uuid, bytea) from public, anon;
revoke all on function public.room_answers(uuid) from public, anon;
revoke all on function public.erase_room(uuid) from public, anon;
grant execute on function public.create_room(bytea) to authenticated;
grant execute on function public.join_room(uuid, bytea) to authenticated;
grant execute on function public.room_answers(uuid) to authenticated;
grant execute on function public.erase_room(uuid) to authenticated;
