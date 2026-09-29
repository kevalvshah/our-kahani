-- A nudge with nobody to reach does not use up the sender's 10 minutes (applied to both
-- projects after 20260929000000_push; the same definition is in that file for fresh setups).
create or replace function public.push_targets(p_room uuid)
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

