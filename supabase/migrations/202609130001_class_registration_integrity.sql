-- Class lifecycle transitions are handled by protected server endpoints. A
-- browser class login may update its assigned class content, but it must never
-- approve itself or change approval state directly.
create or replace function public.enforce_class_status_authority()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(old.data ->> 'approvalStatus', '') is distinct from coalesce(new.data ->> 'approvalStatus', '')
     and coalesce(auth.role(), '') <> 'service_role'
     and public.current_role() not in (
       'SUPER_ADMIN'::public.gofamint_role,
       'GENERAL_SUPERINTENDENT'::public.gofamint_role,
       'GENERAL_SECRETARY'::public.gofamint_role
     ) then
    raise exception 'Only an executive approval endpoint may change class lifecycle status.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_class_status_authority_trigger on public.classes;
create trigger enforce_class_status_authority_trigger
before update on public.classes
for each row execute function public.enforce_class_status_authority();
