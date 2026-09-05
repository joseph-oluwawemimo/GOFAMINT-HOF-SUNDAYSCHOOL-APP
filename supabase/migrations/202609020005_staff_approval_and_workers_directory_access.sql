-- Finalize staff approval synchronization and executive access to the Workers
-- Directorate. This migration is additive and does not delete organizational
-- records or Auth users.

alter table public.admin_profiles
  add column if not exists is_approved boolean not null default false,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz;

-- Backfill from the authoritative profile record before the application begins
-- maintaining both records on subsequent approvals.
update public.admin_profiles ap
set is_approved = p.is_approved,
    approved_by = p.approved_by,
    approved_at = p.approved_at
from public.profiles p
where p.id = ap.profile_id
  and (ap.is_approved is distinct from p.is_approved
       or ap.approved_by is distinct from p.approved_by
       or ap.approved_at is distinct from p.approved_at);

drop policy if exists workers_read on public.workers;
drop policy if exists workers_create on public.workers;
drop policy if exists workers_update on public.workers;
create policy workers_read on public.workers for select using (
  public.is_any_admin() or public.is_own_worker(id)
);
create policy workers_create on public.workers for insert with check (
  public.is_any_admin()
);
create policy workers_update on public.workers for update using (
  public.is_any_admin()
) with check (
  public.is_any_admin()
);
