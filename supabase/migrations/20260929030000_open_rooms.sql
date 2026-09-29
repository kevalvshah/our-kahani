-- Rooms go at the couple's own pace: no end date. A room lasts until either person erases it
-- (the app downloads everything first). Photos and voice notes are the exception: each is kept
-- for 28 days, and the app reminds people to download them before then.
--
-- What the server can see afterwards: unchanged, except that rooms no longer have an end date
-- and photo records older than 28 days are deleted (their R2 files are deleted by /media/purge).

alter table public.rooms alter column ends_at set default 'infinity';
update public.rooms set ends_at = 'infinity';

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
  -- Photos (and their reactions) are kept for 28 days; the files go with /media/purge.
  delete from public.records where kind in (120, 121) and created_at < now() - interval '28 days';
end;
$$;
revoke all on function private.nightly_cleanup() from public;
