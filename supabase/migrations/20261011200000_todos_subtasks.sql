-- Subtasks sync (REED-10). Contract: spec/server.md.
--
-- The checklist travels with its todo as one JSON array of { id, title, completed }, so it follows
-- the same last-writer-wins-on-updated_at rule as every other field. Null means no subtasks.

alter table public.todos
add column subtasks jsonb check (subtasks is null or pg_catalog.jsonb_typeof(subtasks) = 'array');

comment on column public.todos.subtasks is 'Ordered checklist ({ id, title, completed }[]); null when empty.';

-- Same as 20261011190000_todos.sql, with subtasks added to the column lists.
create or replace function public.push_todos(rows jsonb)
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
    id, user_id, title, notes, completed, priority, due_date, recurrence,
    completed_at, subtasks, created_at, updated_at, deleted_at
  )
  select distinct on (r.id)
    r.id, uid, r.title, r.notes, r.completed, r.priority, r.due_date, r.recurrence,
    r.completed_at, r.subtasks, r.created_at, r.updated_at, r.deleted_at
  from pg_catalog.jsonb_populate_recordset(null::public.todos, rows) as r
  order by r.id, (r.deleted_at is not null) desc, r.updated_at desc
  on conflict (user_id, id) do update set
    title = excluded.title,
    notes = excluded.notes,
    completed = excluded.completed,
    priority = excluded.priority,
    due_date = excluded.due_date,
    recurrence = excluded.recurrence,
    completed_at = excluded.completed_at,
    subtasks = excluded.subtasks,
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
