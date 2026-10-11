-- delete_account() (REED-72). Contract: spec/server.md.
--
-- Deletes the signed-in caller's todos and their auth.users row (which also ends their sessions and
-- refresh tokens). Security definer because clients can't hard-delete todos or touch auth.users; it
-- only ever acts on auth.uid(), so no argument can target another user.
create function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'delete_account requires a signed-in user' using errcode = '42501';
  end if;
  delete from public.todos where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
