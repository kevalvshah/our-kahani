-- Encrypted photos live in Cloudflare R2, served by a Pages Function at /media on the app's own
-- origin. The function holds no Supabase secret: it asks these two functions, with the person's
-- own sign-in, whether they may touch a room's files, and which rooms' files must be purged.

-- True when the caller is a member of an open room.
create function public.media_allowed(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_member(p_room) and private.room_open(p_room);
$$;
revoke all on function public.media_allowed(uuid) from public, anon;
grant execute on function public.media_allowed(uuid) to authenticated;

-- Rooms whose files must be deleted: erased or ended in the last 7 days. Only ids, which mean
-- nothing without the room key. Deleting is idempotent, so anyone triggering it early is harmless.
create table private.media_purge (
  room_id uuid primary key,
  gone_at timestamptz not null default now()
);

create function private.queue_media_purge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.media_purge (room_id) values (old.id) on conflict do nothing;
  return old;
end;
$$;

create trigger rooms_queue_media_purge
  after delete on public.rooms
  for each row execute function private.queue_media_purge();

create function public.media_purge_list()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select room_id from private.media_purge where gone_at > now() - interval '7 days' limit 500;
$$;
revoke all on function public.media_purge_list() from public;
grant execute on function public.media_purge_list() to anon, authenticated;

-- Keep the purge list short.
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
end;
$$;
revoke all on function private.nightly_cleanup() from public;
