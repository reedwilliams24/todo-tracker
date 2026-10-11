-- Synced todos (REED-62). Contract: spec/server.md.
--
-- Clients pull with a plain select (`server_seq > cursor order by server_seq limit n`) and write only
-- through push_todos(). The write rules live in the todos_before_write trigger, so they hold for any
-- write path: last writer wins on updated_at, tombstones always win, the server owns server_seq.

create sequence public.todos_server_seq as bigint;

create table public.todos (
  id text not null check (char_length(id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  notes text,
  completed boolean not null,
  priority text not null check (priority in ('low', 'medium', 'high')),
  due_date date,
  reminder text check (reminder in ('at', '1h', '1d')),
  recurrence text check (recurrence in ('daily', 'weekly', 'monthly')),
  completed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_seq bigint not null,
  -- Scoped by user so one account's client-generated ids can never collide with another's.
  primary key (user_id, id)
);

comment on table public.todos is 'One row per todo. deleted_at is a tombstone; server_seq is the pull cursor.';
comment on column public.todos.updated_at is 'Client edit time; last writer wins on it.';
comment on column public.todos.server_seq is 'Server-assigned on every write; strictly increasing per user in commit order.';

create index todos_user_id_server_seq_idx on public.todos (user_id, server_seq);

-- Runs before every insert/update, whoever writes.
create function public.todos_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.user_id := old.user_id;
    -- Tombstones always win: a deleted todo never changes again.
    if old.deleted_at is not null then
      return null;
    end if;
    -- A tombstone beats any edit; otherwise only a strictly newer edit applies.
    if new.deleted_at is null and new.updated_at <= old.updated_at then
      return null;
    end if;
  end if;

  -- One writer per user at a time, held until commit, so server_seq order is commit order and a
  -- pull can never skip a row that commits late with a lower server_seq.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
  new.server_seq := pg_catalog.nextval('public.todos_server_seq');
  return new;
end;
$$;

create trigger todos_before_write
before insert or update on public.todos
for each row execute function public.todos_before_write();

-- RLS: owners can select, insert and update their own rows. Nobody can hard-delete from a client.
-- insert/update are needed because push_todos is security invoker; they can't bypass the write
-- rules, which the trigger enforces on every write.
alter table public.todos enable row level security;

create policy "Owners can select their todos" on public.todos
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Owners can insert their todos" on public.todos
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Owners can update their todos" on public.todos
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.todos from anon, authenticated;
grant select, insert, update on table public.todos to authenticated;
revoke all on sequence public.todos_server_seq from anon, authenticated;
revoke execute on function public.todos_before_write() from public, anon, authenticated;

-- push_todos(rows): upserts the caller's todos and returns the stored version of every pushed id
-- (applied or not), ordered by server_seq. rows is a JSON array of todos with the table's column
-- names; user_id and server_seq in the input are ignored.
create function public.push_todos(rows jsonb)
returns setof public.todos
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'push_todos requires a signed-in user' using errcode = '42501';
  end if;
  if rows is null or pg_catalog.jsonb_typeof(rows) <> 'array' then
    raise exception 'push_todos expects a JSON array of todos' using errcode = '22023';
  end if;

  -- The same id twice in one push: keep the version that would win.
  insert into public.todos (
    id, user_id, title, notes, completed, priority, due_date, reminder, recurrence,
    completed_at, created_at, updated_at, deleted_at
  )
  select distinct on (r.id)
    r.id, uid, r.title, r.notes, r.completed, r.priority, r.due_date, r.reminder, r.recurrence,
    r.completed_at, r.created_at, r.updated_at, r.deleted_at
  from pg_catalog.jsonb_populate_recordset(null::public.todos, rows) as r
  order by r.id, (r.deleted_at is not null) desc, r.updated_at desc
  on conflict (user_id, id) do update set
    title = excluded.title,
    notes = excluded.notes,
    completed = excluded.completed,
    priority = excluded.priority,
    due_date = excluded.due_date,
    reminder = excluded.reminder,
    recurrence = excluded.recurrence,
    completed_at = excluded.completed_at,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at;

  return query
  select t.*
  from public.todos as t
  where t.user_id = uid
    and t.id in (select r.id from pg_catalog.jsonb_to_recordset(rows) as r (id text))
  order by t.server_seq;
end;
$$;

revoke execute on function public.push_todos(jsonb) from public, anon;
grant execute on function public.push_todos(jsonb) to authenticated;

-- Realtime postgres_changes, filtered by clients to user_id=eq.<uid>. Clients only insert and
-- update (deletes are tombstones), and those events carry the full new row. The default replica
-- identity (the primary key) already includes user_id, so old records also carry it.
alter table public.todos replica identity default;
alter publication supabase_realtime add table public.todos;

-- Tombstone purge. Clients whose last pull is older than the retention window must re-pull from
-- cursor 0 (spec/server.md), because purged tombstones can no longer reach them.
create function public.purge_todo_tombstones(retention interval default interval '30 days')
returns bigint
language sql
security definer
set search_path = ''
as $$
  with purged as (
    delete from public.todos where deleted_at < pg_catalog.now() - retention returning 1
  )
  select pg_catalog.count(*) from purged;
$$;

revoke execute on function public.purge_todo_tombstones(interval) from public, anon, authenticated;

-- Daily at 03:17 UTC. Guarded so databases without pg_cron preloaded still migrate; hosted
-- Supabase and the local `supabase start` image both have it.
do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron')
    and pg_catalog.current_setting('shared_preload_libraries') like '%pg_cron%' then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('purge-todo-tombstones', '17 3 * * *', 'select public.purge_todo_tombstones()');
  else
    raise notice 'pg_cron is not available; skipping the purge-todo-tombstones job';
  end if;
end;
$$;
