-- pgTAP tests for the todos table, RLS, push_todos and the tombstone purge (REED-62).
-- Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

-- ------------------------------------------------------------------ fixtures

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.todo(id text, title text, updated_at text, deleted_at text default null)
returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', id, 'title', title, 'completed', false, 'priority', 'medium',
    'created_at', '2026-01-01T09:00:00.000Z', 'updated_at', updated_at, 'deleted_at', deleted_at));
$$;

create function pg_temp.seq(owner uuid, todo_id text) returns bigint language sql security definer as $$
  select server_seq from public.todos where user_id = owner and id = todo_id;
$$;

-- ------------------------------------------------------------------ schema

select has_table('public', 'todos', 'todos table exists');
select columns_are('public', 'todos', array[
  'id', 'user_id', 'title', 'notes', 'completed', 'priority', 'due_date', 'reminder', 'recurrence',
  'completed_at', 'created_at', 'updated_at', 'deleted_at', 'server_seq'], 'todos has the typed columns');
select col_is_pk('public', 'todos', array['user_id', 'id'], 'primary key is (user_id, id)');
select has_index('public', 'todos', 'todos_user_id_server_seq_idx', array['user_id', 'server_seq'],
  'pull index on (user_id, server_seq)');
select is((select relrowsecurity from pg_class where oid = 'public.todos'::regclass), true, 'RLS is enabled');
select policies_are('public', 'todos', array[
  'Owners can select their todos', 'Owners can insert their todos', 'Owners can update their todos'],
  'only select/insert/update policies, no delete');
select ok(exists (select 1 from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'todos'),
  'todos is in the supabase_realtime publication');
select is(has_function_privilege('anon', 'public.push_todos(jsonb)', 'execute'), false, 'anon cannot call push_todos');
select is(has_function_privilege('authenticated', 'public.purge_todo_tombstones(interval)', 'execute'), false,
  'clients cannot call the purge');

-- ------------------------------------------------------------------ push return value

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

create temp table pushed on commit drop as
select * from public.push_todos(jsonb_build_array(
  pg_temp.todo('a1', 'Buy milk', '2026-01-01T10:00:00.000Z'),
  pg_temp.todo('a2', 'Call mom', '2026-01-01T10:00:00.000Z') || '{"user_id": "00000000-0000-0000-0000-00000000000b", "server_seq": 999999}'
));
grant all on pushed to authenticated;

select is((select count(*)::int from pushed), 2, 'push returns one stored row per pushed id');
select is((select array_agg(distinct user_id) from pushed), array['00000000-0000-0000-0000-00000000000a'::uuid],
  'user_id comes from auth.uid(), not the input');
select ok((select bool_and(server_seq < 999999) from pushed), 'server_seq in the input is ignored');
select is((select array_agg(id order by server_seq) from pushed), array['a1', 'a2'], 'rows come back ordered by server_seq');
select is((select title from pushed where id = 'a1'), 'Buy milk', 'returned row has the stored fields');
select is((select count(distinct server_seq)::int from pushed), 2, 'each row in one push gets its own server_seq');

-- ------------------------------------------------------------------ last writer wins

create temp table seqs (step text primary key, seq bigint) on commit drop;
grant all on seqs to authenticated;
insert into seqs values ('a1 initial', pg_temp.seq('00000000-0000-0000-0000-00000000000a', 'a1'));

select is((select title from public.push_todos(jsonb_build_array(
    pg_temp.todo('a1', 'Older edit', '2026-01-01T09:30:00.000Z')))),
  'Buy milk', 'a push with an older updated_at is ignored and returns the stored row');
select is((select title from public.push_todos(jsonb_build_array(
    pg_temp.todo('a1', 'Same time edit', '2026-01-01T10:00:00.000Z')))),
  'Buy milk', 'a push with an equal updated_at is ignored');
select is(pg_temp.seq('00000000-0000-0000-0000-00000000000a', 'a1'), (select seq from seqs where step = 'a1 initial'),
  'an ignored push does not change server_seq');

select is((select title from public.push_todos(jsonb_build_array(
    pg_temp.todo('a1', 'Buy oat milk', '2026-01-01T11:00:00.000Z')))),
  'Buy oat milk', 'a push with a newer updated_at wins');
insert into seqs values ('a1 edited', pg_temp.seq('00000000-0000-0000-0000-00000000000a', 'a1'));
select cmp_ok((select seq from seqs where step = 'a1 edited'), '>', (select seq from seqs where step = 'a1 initial'),
  'an applied push increases server_seq');

select is((select title from public.push_todos(jsonb_build_array(
    pg_temp.todo('a2', 'Older dup', '2026-01-01T10:30:00.000Z'),
    pg_temp.todo('a2', 'Newer dup', '2026-01-01T12:00:00.000Z')))),
  'Newer dup', 'the same id twice in one push keeps the newer version');

-- ------------------------------------------------------------------ tombstones win

select isnt((select deleted_at from public.push_todos(jsonb_build_array(
    pg_temp.todo('a1', 'Buy oat milk', '2026-01-01T08:00:00.000Z', '2026-01-01T08:00:00.000Z')))),
  null, 'a tombstone applies even with an older updated_at');
insert into seqs values ('a1 deleted', pg_temp.seq('00000000-0000-0000-0000-00000000000a', 'a1'));
select cmp_ok((select seq from seqs where step = 'a1 deleted'), '>', (select seq from seqs where step = 'a1 edited'),
  'a tombstone increases server_seq');

create temp table after_tombstone on commit drop as
select * from public.push_todos(jsonb_build_array(pg_temp.todo('a1', 'Resurrected', '2026-02-01T00:00:00.000Z')));
select is((select title from after_tombstone), 'Buy oat milk', 'a tombstone beats a newer edit');
select isnt((select deleted_at from after_tombstone), null, 'the todo stays deleted after a newer edit');
select is(pg_temp.seq('00000000-0000-0000-0000-00000000000a', 'a1'), (select seq from seqs where step = 'a1 deleted'),
  'an edit ignored by a tombstone does not change server_seq');

select is((select title from public.push_todos(jsonb_build_array(
    pg_temp.todo('a3', 'Dup with delete', '2026-01-01T12:00:00.000Z'),
    pg_temp.todo('a3', 'Dup with delete', '2026-01-01T11:00:00.000Z', '2026-01-01T11:00:00.000Z')))
    where deleted_at is not null),
  'Dup with delete', 'the same id twice in one push keeps the tombstone');

-- Direct table writes follow the same rules as push_todos.
update public.todos set title = 'Direct stale', updated_at = '2026-01-01T00:00:00Z' where id = 'a2';
select is((select title from public.todos where id = 'a2'), 'Newer dup', 'a direct update with an older updated_at is ignored');
update public.todos set title = 'Direct newer', updated_at = '2026-03-01T00:00:00Z', server_seq = 1 where id = 'a2';
select is((select title from public.todos where id = 'a2'), 'Direct newer', 'a direct newer update applies');
select cmp_ok(pg_temp.seq('00000000-0000-0000-0000-00000000000a', 'a2'), '>',
  (select max(seq) from seqs), 'a direct update cannot set server_seq; the server assigns the next value');

-- ------------------------------------------------------------------ server_seq strictly increases

select is((select count(*)::int from (
    select server_seq, lag(server_seq) over (order by server_seq) as prev from public.todos) s
  where prev is not null and server_seq <= prev), 0, 'server_seq is unique and strictly ordered');

-- ------------------------------------------------------------------ pull

select results_eq(
  format('select id from public.todos where server_seq > %s order by server_seq limit 10',
    (select seq from seqs where step = 'a1 deleted')),
  $$ values ('a3'), ('a2') $$,
  'pull returns rows written after the cursor, in server_seq order');

-- ------------------------------------------------------------------ cross-user isolation

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');

select is((select count(*)::int from public.todos), 0, 'user B cannot read user A''s todos');
select is((select count(*)::int from public.push_todos(jsonb_build_array(
    pg_temp.todo('a2', 'B''s own todo', '2026-05-01T00:00:00.000Z')))
    where user_id = '00000000-0000-0000-0000-00000000000b'),
  1, 'user B pushing A''s id creates B''s own row');
select is((select count(*)::int from public.todos), 1, 'user B sees only their own row');

update public.todos set title = 'Hijacked', updated_at = '2027-01-01T00:00:00Z'
where user_id = '00000000-0000-0000-0000-00000000000a';
select throws_ok(
  $$ insert into public.todos (id, user_id, title, completed, priority, created_at, updated_at)
     values ('x', '00000000-0000-0000-0000-00000000000a', 'Spoof', false, 'low', now(), now()) $$,
  '42501', null, 'user B cannot insert a row for user A');
select throws_ok($$ delete from public.todos $$, '42501', null, 'clients cannot hard-delete');

reset role;
select is((select title from public.todos where user_id = '00000000-0000-0000-0000-00000000000a' and id = 'a2'),
  'Direct newer', 'user B''s writes did not touch user A''s rows');

-- ------------------------------------------------------------------ anon

set local role anon;
select throws_ok($$ select * from public.todos $$, '42501', null, 'anon cannot read todos');
select throws_ok($$ select public.push_todos('[]') $$, '42501', null, 'anon cannot push');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.push_todos('{}') $$, '22023', null, 'push_todos rejects a non-array');
reset role;

-- ------------------------------------------------------------------ tombstone purge

-- a1 and a3 were deleted on 2026-01-01; a4 is deleted now.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.push_todos(jsonb_build_array(pg_temp.todo('a4', 'Recently deleted', now()::text, now()::text)));
reset role;
select is(public.purge_todo_tombstones(), 2::bigint, 'purge deletes tombstones older than 30 days');
select is((select array_agg(id order by id) from public.todos where user_id = '00000000-0000-0000-0000-00000000000a'),
  array['a2', 'a4'], 'purge keeps live todos and recent tombstones');

select case
  when exists (select 1 from pg_extension where extname = 'pg_cron') then
    is((select schedule from cron.job where jobname = 'purge-todo-tombstones'), '17 3 * * *',
      'the purge runs daily via pg_cron')
  else skip('pg_cron is not installed', 1)
end;

select * from finish();
rollback;
