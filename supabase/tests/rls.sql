-- Database security tests: isolation, joining, the reveal rule, locks, erase, and that the API
-- roles cannot touch tables directly. Runs as one DO block that acts as three different users,
-- then raises 'ALL RLS TESTS PASSED' so everything is rolled back (nothing is left behind).
--   psql "$SUPABASE_DB_URL" -f supabase/tests/rls.sql
-- Any message starting with FAIL, or any other error, means a test failed.

do $test$
declare
  a uuid := gen_random_uuid();   -- creator
  b uuid := gen_random_uuid();   -- invitee
  c uuid := gen_random_uuid();   -- a stranger
  token bytea := extensions.gen_random_bytes(32);
  room uuid;
  room_c uuid;
  n int;
  r text;
begin
  insert into auth.users (id, aud, role, is_anonymous, created_at, updated_at)
  values (a, 'authenticated', 'authenticated', true, now(), now()),
         (b, 'authenticated', 'authenticated', true, now(), now()),
         (c, 'authenticated', 'authenticated', true, now(), now());

  -- ==== A creates a room and answers warm.1 =================================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  room := public.create_room(pg_catalog.sha256(token));
  select count(*) into n from public.members where room_id = room;
  if n <> 1 then raise exception 'FAIL creator should see 1 member, saw %', n; end if;

  begin
    insert into public.rooms default values;
    raise exception 'FAIL direct insert into rooms was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.members (room_id, user_id, role) values (room, c, 'invitee');
    raise exception 'FAIL direct insert into members was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from private.join_verifiers;
    raise exception 'FAIL join verifiers were readable';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_room('\x00'::bytea);
    raise exception 'FAIL create_room accepted a bad verifier';
  exception when sqlstate '22023' then null;
  end;

  insert into public.records (id, room_id, kind, ref, envelope)
  values (gen_random_uuid(), room, 1, 'warm.1', extensions.gen_random_bytes(60));

  begin
    insert into public.records (id, room_id, kind, ref, envelope)
    values (gen_random_uuid(), room, 1, 'bad ref with spaces', extensions.gen_random_bytes(60));
    raise exception 'FAIL a free-text ref was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.records (id, room_id, kind, ref, envelope)
    values (gen_random_uuid(), room, 1, 'warm.9', '\x01'::bytea);
    raise exception 'FAIL an envelope shorter than IV + tag was accepted';
  exception when check_violation then null;
  end;
  reset role;

  -- ==== C, a stranger, sees nothing and cannot get in =======================
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.rooms where id = room;
  if n <> 0 then raise exception 'FAIL isolation: stranger can see the room'; end if;
  select count(*) into n from public.members where room_id = room;
  if n <> 0 then raise exception 'FAIL isolation: stranger can see members'; end if;
  select count(*) into n from public.records where room_id = room;
  if n <> 0 then raise exception 'FAIL isolation: stranger can see records'; end if;
  select count(*) into n from public.room_answers(room);
  if n <> 0 then raise exception 'FAIL isolation: stranger can see answer status'; end if;
  begin
    perform public.join_room(room, extensions.gen_random_bytes(32));
    raise exception 'FAIL joined with a wrong token';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    insert into public.records (id, room_id, kind, ref, envelope)
    values (gen_random_uuid(), room, 1, 'warm.1', extensions.gen_random_bytes(60));
    raise exception 'FAIL stranger wrote a record';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.erase_room(room);
    raise exception 'FAIL stranger erased the room';
  exception when insufficient_privilege then null;
  end;
  -- C's own room is invisible to A and B later.
  room_c := public.create_room(pg_catalog.sha256(extensions.gen_random_bytes(32)));
  reset role;

  -- ==== B joins with the key-derived token ==================================
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  r := public.join_room(room, token);
  if r <> 'invitee' then raise exception 'FAIL join returned %', r; end if;
  r := public.join_room(room, token);
  if r <> 'invitee' then raise exception 'FAIL joining again was not idempotent'; end if;

  select count(*) into n from public.room_answers(room) where not mine;
  if n <> 1 then raise exception 'FAIL invitee should see 1 partner answer status, saw %', n; end if;
  select count(*) into n from public.records where room_id = room;
  if n <> 0 then raise exception 'FAIL reveal: saw the partner''s answer before answering (% rows)', n; end if;

  insert into public.records (id, room_id, kind, ref, envelope)
  values (gen_random_uuid(), room, 1, 'warm.1', extensions.gen_random_bytes(60));
  select count(*) into n from public.records where room_id = room;
  if n <> 2 then raise exception 'FAIL reveal: after answering, invitee should see 2 records, saw %', n; end if;

  select count(*) into n from public.rooms where id = room_c;
  if n <> 0 then raise exception 'FAIL isolation: member of one room sees another room'; end if;
  reset role;

  -- ==== A: new card hidden, shared record visible, answer locked ============
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.records (id, room_id, kind, ref, envelope)
  values (gen_random_uuid(), room, 1, 'warm.2', extensions.gen_random_bytes(60)),
         (gen_random_uuid(), room, 100, 'love', extensions.gen_random_bytes(40));

  begin
    update public.records set envelope = extensions.gen_random_bytes(61)
    where room_id = room and ref = 'warm.1' and author_id = a;
    raise exception 'FAIL an answer changed after both had answered';
  exception when insufficient_privilege then null;
  end;
  update public.records set envelope = extensions.gen_random_bytes(61)
  where room_id = room and ref = 'warm.2' and author_id = a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL could not change an answer before the partner answered'; end if;

  begin
    update public.records set ref = 'warm.3' where room_id = room and ref = 'warm.2';
    raise exception 'FAIL a record''s ref could be changed';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- ==== B: sees the shared record, not the unanswered card ==================
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.records where room_id = room and kind = 100;
  if n <> 1 then raise exception 'FAIL shared record not visible to partner'; end if;
  select count(*) into n from public.records where room_id = room and ref = 'warm.2';
  if n <> 0 then raise exception 'FAIL reveal: unanswered card visible to partner'; end if;
  select count(*) into n from public.records where room_id = room and author_id = a and ref = 'warm.1';
  if n <> 1 then raise exception 'FAIL partner answer not visible after both answered'; end if;
  begin
    delete from public.records where room_id = room and author_id = a;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL deleted the partner''s records'; end if;
  end;
  reset role;

  -- ==== C cannot take a third seat, even with the right token ===============
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.join_room(room, token);
    raise exception 'FAIL a third person joined';
  exception when sqlstate 'P0003' then null;
  end;
  reset role;

  -- ==== B erases the room: everything is gone ===============================
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.erase_room(room);
  reset role;

  select count(*) into n from public.records where room_id = room;
  if n <> 0 then raise exception 'FAIL erase left % records', n; end if;
  select count(*) into n from public.members where room_id = room;
  if n <> 0 then raise exception 'FAIL erase left members'; end if;
  select count(*) into n from private.join_verifiers where room_id = room;
  if n <> 0 then raise exception 'FAIL erase left the join verifier'; end if;

  -- ==== The anon role (not signed in) can do nothing ========================
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    perform 1 from public.records;
    raise exception 'FAIL anon can read records';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_room(pg_catalog.sha256(token));
    raise exception 'FAIL anon can create rooms';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise exception 'ALL RLS TESTS PASSED';
end
$test$;
