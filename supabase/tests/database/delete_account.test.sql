-- pgTAP tests for delete_account() (REED-72). Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.todo(id text) returns jsonb language sql as $$
  select jsonb_build_object('id', id, 'title', 'Todo ' || id, 'completed', false, 'priority', 'medium',
    'created_at', '2026-01-01T09:00:00.000Z', 'updated_at', '2026-01-01T09:00:00.000Z');
$$;

create function pg_temp.todo_count(owner uuid) returns int language sql security definer as $$
  select count(*)::int from public.todos where user_id = owner;
$$;

create function pg_temp.user_exists(uid uuid) returns boolean language sql security definer as $$
  select exists (select 1 from auth.users where id = uid);
$$;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.push_todos(jsonb_build_array(pg_temp.todo('a1'), pg_temp.todo('a2'), pg_temp.todo('shared')));
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.push_todos(jsonb_build_array(pg_temp.todo('b1'), pg_temp.todo('shared')));
reset role;

select is(has_function_privilege('anon', 'public.delete_account()', 'execute'), false, 'anon cannot call delete_account');
select is(has_function_privilege('authenticated', 'public.delete_account()', 'execute'), true,
  'signed-in users can call delete_account');

-- Not signed in: the authenticated role without a sub claim.
select set_config('role', 'authenticated', true), set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok('select public.delete_account()', '42501', null, 'delete_account without a user is refused');
reset role;
select is(pg_temp.todo_count('00000000-0000-0000-0000-00000000000a'), 3, 'a refused call deletes nothing');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok('select public.delete_account()', 'a signed-in user can delete their account');
reset role;

select is(pg_temp.todo_count('00000000-0000-0000-0000-00000000000a'), 0, 'the caller''s todos are deleted');
select is(pg_temp.user_exists('00000000-0000-0000-0000-00000000000a'), false, 'the caller''s auth user is deleted');
select is(pg_temp.todo_count('00000000-0000-0000-0000-00000000000b'), 2, 'other users keep all their todos');
select ok((select bool_and(user_id = '00000000-0000-0000-0000-00000000000b') from public.todos), 'only b''s rows remain');
select is(pg_temp.user_exists('00000000-0000-0000-0000-00000000000b'), true, 'other users keep their auth user');

-- Calling again with the now-deleted user's token is a no-op.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok('select public.delete_account()', 'a second call after deletion is a harmless no-op');
reset role;

select * from finish();
rollback;
