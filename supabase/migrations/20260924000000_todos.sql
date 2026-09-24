-- Todos are stored one row per todo, with the full shared `Todo` JSON in `data`
-- so the schema does not need a migration every time the client model grows.
-- Frequently filtered fields are mirrored into typed columns.

create table if not exists public.todos (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  completed boolean not null default false,
  due_date date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists todos_user_id_idx on public.todos (user_id);
create index if not exists todos_user_due_idx on public.todos (user_id, due_date);

alter table public.todos enable row level security;

create policy "todos: owner can select" on public.todos
  for select using (auth.uid() = user_id);
create policy "todos: owner can insert" on public.todos
  for insert with check (auth.uid() = user_id);
create policy "todos: owner can update" on public.todos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "todos: owner can delete" on public.todos
  for delete using (auth.uid() = user_id);
