-- The Directorate's approved administrative roles may operate the worker
-- directory and attendance terminals. Teachers and class secretaries remain
-- excluded unless they are assigned as the worker record owner.
drop policy if exists workers_read on public.workers;
create policy workers_read on public.workers for select using (
  public.is_any_admin() or public.is_own_worker(id)
);

drop policy if exists worker_attendance_read on public.worker_attendance;
drop policy if exists worker_attendance_create on public.worker_attendance;
drop policy if exists worker_attendance_update on public.worker_attendance;
create policy worker_attendance_read on public.worker_attendance for select using (
  public.is_any_admin() or public.is_own_worker(worker_id)
);
create policy worker_attendance_create on public.worker_attendance for insert with check (
  public.is_any_admin() or public.is_own_worker(worker_id)
);
create policy worker_attendance_update on public.worker_attendance for update using (
  public.is_any_admin()
) with check (public.is_any_admin());

drop policy if exists worker_prep_attendance_read on public.worker_prep_attendance;
drop policy if exists worker_prep_attendance_create on public.worker_prep_attendance;
drop policy if exists worker_prep_attendance_update on public.worker_prep_attendance;
create policy worker_prep_attendance_read on public.worker_prep_attendance for select using (
  public.is_any_admin() or public.is_own_worker(worker_id)
);
create policy worker_prep_attendance_create on public.worker_prep_attendance for insert with check (
  public.is_any_admin()
);
create policy worker_prep_attendance_update on public.worker_prep_attendance for update using (
  public.is_any_admin()
) with check (public.is_any_admin());

drop policy if exists special_event_attendance_read on public.special_event_attendance;
drop policy if exists special_event_attendance_create on public.special_event_attendance;
drop policy if exists special_event_attendance_update on public.special_event_attendance;
create policy special_event_attendance_read on public.special_event_attendance for select using (
  public.is_any_admin() or public.is_own_worker(worker_id)
);
create policy special_event_attendance_create on public.special_event_attendance for insert with check (
  public.is_any_admin() or public.is_own_worker(worker_id)
);
create policy special_event_attendance_update on public.special_event_attendance for update using (
  public.is_any_admin()
) with check (public.is_any_admin());
