-- Storage guard for the free plan (500 MB database). A daily job (.github/workflows/daily.yml)
-- reads storage_health(): it warns at 60% and 80%, and doubles as the keep-alive ping that stops
-- a free project from pausing. New rooms are refused at 70%; existing rooms keep working.

create function private.db_percent()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(pg_catalog.pg_database_size(pg_catalog.current_database()) * 100.0 / (500 * 1024 * 1024), 1);
$$;
revoke all on function private.db_percent() from public;

-- Only a size, never anything about rooms or people.
create function public.storage_health()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object('percent', private.db_percent(), 'new_rooms_paused', private.db_percent() >= 70);
$$;
revoke all on function public.storage_health() from public;
grant execute on function public.storage_health() to anon, authenticated;

create function private.guard_new_room()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.db_percent() >= 70 then
    raise exception 'New rooms are paused' using errcode = 'P0008';
  end if;
  return new;
end;
$$;

create trigger rooms_guard_new_room
  before insert on public.rooms
  for each row execute function private.guard_new_room();
