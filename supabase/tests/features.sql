-- Database tests for the feature rules: private notes, the write-once hashtag, the time capsule,
-- saved copies, caps, keep votes, recovery backups, the photo store checks and the storage guard.
-- Runs as one DO block and raises 'ALL FEATURE TESTS PASSED' so everything is rolled back.
--   psql "$SUPABASE_DB_URL" -f supabase/tests/features.sql
-- Any message starting with FAIL, or any other error, means a test failed.

do $test$
declare
  a uuid := gen_random_uuid();   -- creator
  b uuid := gen_random_uuid();   -- invitee
  c uuid := gen_random_uuid();   -- a stranger
  a2 uuid := gen_random_uuid();  -- A again, on a new browser after recovery
  token bytea := extensions.gen_random_bytes(32);
  lookup_a bytea := extensions.gen_random_bytes(32);
  room uuid;
  shared_id uuid := gen_random_uuid();
  capsule_id uuid := gen_random_uuid();
  n int;
  ok boolean;
  rec record;
  j json;
begin
  insert into auth.users (id, aud, role, is_anonymous, created_at, updated_at)
  values (a, 'authenticated', 'authenticated', true, now(), now()),
         (b, 'authenticated', 'authenticated', true, now(), now()),
         (c, 'authenticated', 'authenticated', true, now(), now()),
         (a2, 'authenticated', 'authenticated', true, now(), now());

  -- ==== A creates the room, B joins ========================================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  room := public.create_room(pg_catalog.sha256(token));
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.join_room(room, token);

  -- B: a shared record, a private note, a saved copy of the shared record, a capsule line.
  insert into public.records (id, room_id, kind, ref, envelope)
  values (shared_id, room, 107, 'noticed', extensions.gen_random_bytes(40)),
         (gen_random_uuid(), room, 200, 'note-1', extensions.gen_random_bytes(40)),
         (capsule_id, room, 50, 'capsule', extensions.gen_random_bytes(40));
  reset role;

  -- ==== A: private kinds and the capsule are hidden; shared is visible ======
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.records where room_id = room and kind = 107;
  if n <> 1 then raise exception 'FAIL shared record not visible to partner'; end if;
  select count(*) into n from public.records where room_id = room and kind = 200;
  if n <> 0 then raise exception 'FAIL a private note is visible to the partner'; end if;
  select count(*) into n from public.records where room_id = room and kind = 50;
  if n <> 0 then raise exception 'FAIL a time capsule opened before 90 days'; end if;
  select count(*) into n from public.room_answers(room) where kind = 50 and not mine;
  if n <> 1 then raise exception 'FAIL capsule status (not content) should show as sealed'; end if;

  -- A saves a private copy of B's shared record.
  insert into public.records (id, room_id, kind, ref, envelope)
  values (gen_random_uuid(), room, 200, 'copy:' || shared_id::text, extensions.gen_random_bytes(40));

  -- The hashtag is write-once for the room.
  insert into public.records (id, room_id, kind, ref, envelope)
  values (gen_random_uuid(), room, 140, 'hashtag', extensions.gen_random_bytes(40));
  begin
    update public.records set envelope = extensions.gen_random_bytes(41) where room_id = room and kind = 140;
    raise exception 'FAIL the hashtag was changed';
  exception when insufficient_privilege then null;
  end;
  delete from public.records where room_id = room and kind = 140;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL the hashtag was deleted'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.records (id, room_id, kind, ref, envelope)
    values (gen_random_uuid(), room, 140, 'hashtag', extensions.gen_random_bytes(40));
    raise exception 'FAIL a second hashtag was accepted';
  exception when unique_violation then null;
  end;
  -- B cannot read A's saved copy, then takes the original back: the copy goes too.
  select count(*) into n from public.records where room_id = room and ref like 'copy:%';
  if n <> 0 then raise exception 'FAIL partner can see a saved copy'; end if;
  delete from public.records where id = shared_id;
  reset role;
  select count(*) into n from public.records where room_id = room and ref = 'copy:' || shared_id::text;
  if n <> 0 then raise exception 'FAIL taking something back left a saved copy'; end if;

  -- An old capsule opens for the partner after 90 days.
  update public.records set created_at = now() - interval '91 days' where id = capsule_id;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.records where id = capsule_id;
  if n <> 1 then raise exception 'FAIL the capsule did not open after 90 days'; end if;

  -- ==== Caps: 20 photos per room =============================================
  insert into public.records (id, room_id, kind, ref, envelope)
  select gen_random_uuid(), room, 120, 'photo:' || i, extensions.gen_random_bytes(40) from generate_series(1, 20) i;
  begin
    insert into public.records (id, room_id, kind, ref, envelope)
    values (gen_random_uuid(), room, 120, 'photo:21', extensions.gen_random_bytes(40));
    raise exception 'FAIL a 21st photo was accepted';
  exception when sqlstate 'P0005' then null;
  end;

  -- ==== Keep votes: one vote does nothing, both extend =======================
  ok := public.vote_keep(room, true);
  if ok then raise exception 'FAIL one keep vote extended the room'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.keep_votes where room_id = room;
  if n <> 0 then raise exception 'FAIL the partner can see a keep vote'; end if;
  ok := public.vote_keep(room, true);
  if not ok then raise exception 'FAIL two keep votes did not extend the room'; end if;
  select count(*) into n from public.rooms where id = room and ends_at > now() + interval '50 days';
  if n <> 1 then raise exception 'FAIL the room was not extended by 4 weeks'; end if;
  reset role;

  -- ==== The photo store's checks =============================================
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if public.media_allowed(room) then raise exception 'FAIL a stranger may use the room''s photos'; end if;
  begin
    perform public.vote_keep(room, true);
    raise exception 'FAIL a stranger voted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_backup(room, extensions.gen_random_bytes(32), extensions.gen_random_bytes(60));
    raise exception 'FAIL a stranger saved a backup';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- ==== Recovery: A saves a backup, then recovers on a new account ===========
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if not public.media_allowed(room) then raise exception 'FAIL a member may not use the room''s photos'; end if;
  perform public.save_backup(room, lookup_a, extensions.gen_random_bytes(60));
  begin
    perform 1 from private.key_backups;
    raise exception 'FAIL key backups are readable';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.recover_room(extensions.gen_random_bytes(32));
    raise exception 'FAIL wrong words recovered a room';
  exception when sqlstate 'P0007' then null;
  end;
  select * into rec from public.recover_room(lookup_a);
  if rec.room_id <> room or rec.role <> 'creator' then raise exception 'FAIL recovery returned the wrong room or role'; end if;
  select count(*) into n from public.records where room_id = room and author_id = a2 and kind = 140;
  if n <> 1 then raise exception 'FAIL recovery did not move the person''s records'; end if;
  select count(*) into n from public.members where room_id = room and user_id = a;
  if n <> 0 then raise exception 'FAIL the old account kept its seat'; end if;
  reset role;

  -- ==== Storage guard: size only, callable by anyone =========================
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  j := public.storage_health();
  if (j->>'percent') is null then raise exception 'FAIL storage_health returned no percent'; end if;
  begin
    perform public.media_allowed(room);
    raise exception 'FAIL anon can ask about a room''s photos';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- ==== Erasing queues the room's photos for purging =========================
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.erase_room(room);
  reset role;
  select count(*) into n from private.media_purge where room_id = room;
  if n <> 1 then raise exception 'FAIL erasing did not queue the photo purge'; end if;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select count(*) into n from public.media_purge_list() as t(id) where id = room;
  if n <> 1 then raise exception 'FAIL the purge list does not include the erased room'; end if;
  reset role;

  raise exception 'ALL FEATURE TESTS PASSED';
end
$test$;
