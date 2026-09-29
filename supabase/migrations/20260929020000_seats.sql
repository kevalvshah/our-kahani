-- Multi-device: each person is a seat in the room (creator or invitee) with up to four devices.
-- Every rule that compared "the author is me" now compares seats, so a person's phone and laptop
-- see and edit the same things. "Enter my room" (hashtag + phrase) adds a device instead of
-- moving the person; a partner rescue signs all of the lost person's devices out.
--
-- What the server can see, added by this migration: which seat each record, vote, backup and
-- rescue belongs to (the same two roles it already knew), and how many devices each person uses
-- (each is a separate anonymous account) and when each was added. Nothing about content.

-- ---------------------------------------------------------------------------
-- Seats
-- ---------------------------------------------------------------------------
create function private.my_seat(p_room uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select m.role from public.members m where m.room_id = p_room and m.user_id = (select auth.uid());
$$;
revoke all on function private.my_seat(uuid) from public;
grant execute on function private.my_seat(uuid) to authenticated;

-- Several devices may share a seat now.
alter table public.members drop constraint members_room_id_role_key;
create index members_room_role on public.members (room_id, role);

-- Adds a device to a seat; the oldest device beyond four is signed out.
create function private.add_device(p_room uuid, p_seat text, p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.members (room_id, user_id, role) values (p_room, p_user, p_seat)
  on conflict (room_id, user_id) do nothing;
  delete from public.members m
  where m.room_id = p_room and m.role = p_seat
    and m.user_id not in (
      select x.user_id from public.members x
      where x.room_id = p_room and x.role = p_seat order by x.joined_at desc limit 4
    );
end;
$$;
revoke all on function private.add_device(uuid, text, uuid) from public;

-- ---------------------------------------------------------------------------
-- Records belong to a seat
-- ---------------------------------------------------------------------------
alter table public.records add column seat text check (seat in ('creator', 'invitee'));
update public.records r set seat = m.role from public.members m where m.room_id = r.room_id and m.user_id = r.author_id;
delete from public.records where seat is null;
alter table public.records alter column seat set not null;

create function private.set_record_seat()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.seat := private.my_seat(new.room_id);
  if new.seat is null then
    raise exception 'Not a member' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger records_set_seat before insert on public.records
  for each row execute function private.set_record_seat();

-- A device account can be cleaned up; the seat's records stay.
alter table public.records drop constraint records_author_id_fkey;
alter table public.records alter column author_id drop not null;
alter table public.records add constraint records_author_id_fkey foreign key (author_id) references auth.users (id) on delete set null;
alter table public.records drop constraint records_room_id_author_id_kind_ref_key;
alter table public.records add constraint records_room_seat_kind_ref_key unique (room_id, seat, kind, ref);

create or replace function private.answered_by_me(p_room uuid, p_kind smallint, p_ref text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.records r
    where r.room_id = p_room and r.seat = private.my_seat(p_room)
      and r.kind = p_kind and r.ref = p_ref and r.submitted
  );
$$;

create or replace function private.answered_by_partner(p_room uuid, p_kind smallint, p_ref text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.records r
    where r.room_id = p_room and r.seat <> private.my_seat(p_room)
      and r.kind = p_kind and r.ref = p_ref and r.submitted
  );
$$;

drop policy records_read on public.records;
drop policy records_insert_own on public.records;
drop policy records_update_own on public.records;
drop policy records_delete_own on public.records;
drop function private.can_read_record(uuid, uuid, smallint, text, boolean, timestamptz);

create function private.can_read_record(
  p_room uuid, p_seat text, p_kind smallint, p_ref text, p_submitted boolean, p_created timestamptz
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_member(p_room) and (
    p_seat = private.my_seat(p_room)
    or (
      p_submitted
      and (
        (p_kind between 100 and 199)
        or (p_kind < 50 and private.answered_by_me(p_room, p_kind, p_ref))
        or (p_kind = 50 and p_created <= now() - interval '90 days')
      )
    )
  );
$$;
revoke all on function private.can_read_record(uuid, text, smallint, text, boolean, timestamptz) from public;
grant execute on function private.can_read_record(uuid, text, smallint, text, boolean, timestamptz) to authenticated;

create policy records_read on public.records
  for select to authenticated
  using (private.can_read_record(room_id, seat, kind, ref, submitted, created_at));

create policy records_insert_own on public.records
  for insert to authenticated
  with check (author_id = (select auth.uid()) and private.is_member(room_id) and private.room_open(room_id));

create policy records_update_own on public.records
  for update to authenticated
  using (seat = private.my_seat(room_id))
  with check (
    seat = private.my_seat(room_id)
    and private.room_open(room_id)
    and (
      (kind between 100 and 299 and kind <> 140)
      or (kind < 50 and not private.answered_by_partner(room_id, kind, ref))
    )
  );

create policy records_delete_own on public.records
  for delete to authenticated
  using (seat = private.my_seat(room_id) and kind <> 140);

create or replace function public.room_answers(p_room uuid)
returns table (kind smallint, ref text, mine boolean)
language sql stable security definer set search_path = ''
as $$
  select r.kind, r.ref, r.seat = private.my_seat(p_room)
  from public.records r
  where r.room_id = p_room and r.submitted and r.kind <= 50 and private.is_member(p_room);
$$;

-- ---------------------------------------------------------------------------
-- Joining: the invitee seat is taken once someone has joined
-- ---------------------------------------------------------------------------
create or replace function public.join_room(p_room uuid, p_token bytea)
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
    return v_role;
  end if;
  perform 1
  from public.rooms r
  join private.join_verifiers j on j.room_id = r.id
  where r.id = p_room and r.ends_at > now() and r.invite_expires_at > now()
    and j.verifier = pg_catalog.sha256(p_token);
  if not found then
    raise exception 'This invite is not valid' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.members m where m.room_id = p_room and m.role = 'invitee') then
    raise exception 'This room already has two people' using errcode = 'P0003';
  end if;
  insert into public.members (room_id, user_id, role) values (p_room, v_uid, 'invitee');
  return 'invitee';
end;
$$;

-- ---------------------------------------------------------------------------
-- Keep votes per seat (one vote per person, whichever device)
-- ---------------------------------------------------------------------------
drop table public.keep_votes;
create table public.keep_votes (
  room_id uuid not null references public.rooms (id) on delete cascade,
  seat text not null check (seat in ('creator', 'invitee')),
  cycle integer not null,
  primary key (room_id, seat)
);
alter table public.keep_votes enable row level security;
revoke all on public.keep_votes from public, anon, authenticated;
grant select on public.keep_votes to authenticated;
create policy keep_votes_own on public.keep_votes
  for select to authenticated using (seat = private.my_seat(room_id));

create or replace function public.vote_keep(p_room uuid, p_keep boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_seat text := private.my_seat(p_room);
  v_cycle integer;
begin
  if v_seat is null then
    raise exception 'Not a member' using errcode = '42501';
  end if;
  select r.cycle into v_cycle from public.rooms r where r.id = p_room and r.ends_at > now() for update;
  if not found then
    raise exception 'This room has ended' using errcode = 'P0006';
  end if;
  if not p_keep then
    delete from public.keep_votes where room_id = p_room and seat = v_seat;
    return false;
  end if;
  insert into public.keep_votes (room_id, seat, cycle) values (p_room, v_seat, v_cycle)
  on conflict (room_id, seat) do update set cycle = excluded.cycle;
  if (select count(*) from public.keep_votes where room_id = p_room and cycle = v_cycle) >= 2 then
    update public.rooms set ends_at = ends_at + interval '28 days', cycle = cycle + 1 where id = p_room;
    delete from public.keep_votes where room_id = p_room;
    return true;
  end if;
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backups per seat; entering the room adds a device
-- ---------------------------------------------------------------------------
alter table private.key_backups add column seat text check (seat in ('creator', 'invitee'));
update private.key_backups k set seat = m.role from public.members m where m.room_id = k.room_id and m.user_id = k.user_id;
delete from private.key_backups where seat is null;
alter table private.key_backups alter column seat set not null;
alter table private.key_backups drop constraint key_backups_room_id_user_id_key;
alter table private.key_backups add constraint key_backups_room_seat_key unique (room_id, seat);
alter table private.key_backups drop constraint key_backups_user_id_fkey;
alter table private.key_backups alter column user_id drop not null;
alter table private.key_backups add constraint key_backups_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

create or replace function public.save_backup(p_room uuid, p_token bytea, p_envelope bytea)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_seat text := private.my_seat(p_room);
begin
  if v_seat is null then
    raise exception 'Not a member' using errcode = '42501';
  end if;
  if p_token is null or octet_length(p_token) <> 32 then
    raise exception 'Invalid token' using errcode = '22023';
  end if;
  delete from private.key_backups where room_id = p_room and seat = v_seat;
  insert into private.key_backups (lookup, room_id, user_id, seat, envelope)
  values (pg_catalog.sha256(p_token), p_room, auth.uid(), v_seat, p_envelope);
end;
$$;

create or replace function public.recover_room(p_token bytea)
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
  -- Someone already in the other seat cannot take this one.
  if exists (select 1 from public.members m where m.room_id = b.room_id and m.user_id = v_uid and m.role <> b.seat) then
    raise exception 'Those words do not match a room' using errcode = 'P0007';
  end if;
  perform private.add_device(b.room_id, b.seat, v_uid);
  return query select b.room_id, b.seat, b.envelope;
end;
$$;

create or replace function public.read_backup(p_token bytea)
returns bytea
language sql stable security definer set search_path = ''
as $$
  select k.envelope from private.key_backups k
  where k.lookup = pg_catalog.sha256(p_token) and k.seat = private.my_seat(k.room_id);
$$;

-- ---------------------------------------------------------------------------
-- Devices: list and sign out the others
-- ---------------------------------------------------------------------------
create function public.my_devices(p_room uuid)
returns table (added_at timestamptz, this_device boolean)
language sql stable security definer set search_path = ''
as $$
  select m.joined_at, m.user_id = (select auth.uid())
  from public.members m
  where m.room_id = p_room and m.role = private.my_seat(p_room)
  order by m.joined_at;
$$;

create function public.sign_out_other_devices(p_room uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_seat text := private.my_seat(p_room);
  n integer;
begin
  if v_seat is null then
    raise exception 'Not a member' using errcode = '42501';
  end if;
  delete from public.push_subscriptions s
  where s.room_id = p_room and s.user_id in (
    select m.user_id from public.members m where m.room_id = p_room and m.role = v_seat and m.user_id <> auth.uid()
  );
  delete from public.members m where m.room_id = p_room and m.role = v_seat and m.user_id <> auth.uid();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.my_devices(uuid) from public, anon;
revoke all on function public.sign_out_other_devices(uuid) from public, anon;
grant execute on function public.my_devices(uuid) to authenticated;
grant execute on function public.sign_out_other_devices(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rescue per seat: all of the lost person's devices are signed out
-- ---------------------------------------------------------------------------
delete from private.rescues;
alter table private.rescues drop column for_user;
alter table private.rescues drop column made_by;
alter table private.rescues add column for_seat text not null check (for_seat in ('creator', 'invitee'));

create or replace function public.create_rescue(p_room uuid, p_token bytea, p_envelope bytea)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_seat text := private.my_seat(p_room);
  v_other text;
  v_expires timestamptz := now() + interval '24 hours';
begin
  if v_seat is null or not private.room_open(p_room) then
    raise exception 'Not a member' using errcode = '42501';
  end if;
  if p_token is null or octet_length(p_token) <> 32 then
    raise exception 'Invalid token' using errcode = '22023';
  end if;
  v_other := case v_seat when 'creator' then 'invitee' else 'creator' end;
  if not exists (select 1 from private.key_backups k where k.room_id = p_room and k.seat = v_other)
     and not exists (select 1 from public.members m where m.room_id = p_room and m.role = v_other) then
    raise exception 'Nobody to rescue yet' using errcode = 'P0010';
  end if;
  insert into private.rescues (room_id, for_seat, lookup, envelope, expires_at)
  values (p_room, v_other, pg_catalog.sha256(p_token), p_envelope, v_expires)
  on conflict (room_id) do update
    set for_seat = excluded.for_seat, lookup = excluded.lookup, envelope = excluded.envelope, expires_at = excluded.expires_at;
  return v_expires;
end;
$$;

create or replace function public.rescue_status(p_room uuid)
returns timestamptz
language sql stable security definer set search_path = ''
as $$
  select r.expires_at from private.rescues r
  where r.room_id = p_room and r.for_seat <> private.my_seat(p_room) and r.expires_at > now();
$$;

create or replace function public.cancel_rescue(p_room uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from private.rescues r where r.room_id = p_room and r.for_seat <> private.my_seat(p_room);
$$;

create or replace function public.use_rescue(p_token bytea)
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
  if exists (select 1 from public.members m where m.room_id = r.room_id and m.user_id = v_uid and m.role <> r.for_seat) then
    raise exception 'That rescue code does not work' using errcode = 'P0009';
  end if;
  -- Every device of the lost person is signed out; this browser takes the seat.
  delete from public.push_subscriptions s where s.room_id = r.room_id and s.user_id in (
    select m.user_id from public.members m where m.room_id = r.room_id and m.role = r.for_seat
  );
  delete from public.members m where m.room_id = r.room_id and m.role = r.for_seat;
  insert into public.members (room_id, user_id, role) values (r.room_id, v_uid, r.for_seat);
  -- Their private notes were sealed with a notes key nobody has any more.
  delete from public.records rc where rc.room_id = r.room_id and rc.seat = r.for_seat and rc.kind between 200 and 299;
  delete from private.key_backups k where k.room_id = r.room_id and k.seat = r.for_seat;
  delete from private.rescues x where x.room_id = r.room_id;
  return query select r.room_id, r.for_seat, r.envelope;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notifications go to the other seat's devices
-- ---------------------------------------------------------------------------
create or replace function public.push_targets(p_room uuid)
returns setof text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_seat text := private.my_seat(p_room);
begin
  if v_seat is null or not private.room_open(p_room) then
    return;
  end if;
  if exists (
    select 1 from private.push_log l
    where l.room_id = p_room and l.user_id = v_uid and l.sent_at > now() - interval '10 minutes'
  ) then
    return;
  end if;
  if not exists (
    select 1 from public.push_subscriptions s join public.members m on m.room_id = s.room_id and m.user_id = s.user_id
    where s.room_id = p_room and m.role <> v_seat
  ) then
    return;
  end if;
  insert into private.push_log (room_id, user_id) values (p_room, v_uid)
  on conflict (room_id, user_id) do update set sent_at = now();
  return query
    select s.endpoint from public.push_subscriptions s join public.members m on m.room_id = s.room_id and m.user_id = s.user_id
    where s.room_id = p_room and m.role <> v_seat;
end;
$$;
