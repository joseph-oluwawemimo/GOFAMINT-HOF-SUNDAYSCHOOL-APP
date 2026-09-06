-- Migration: 202609060001_allow_all_admin_special_events_and_prep.sql
-- Description: Grant all administrative roles (is_any_admin) full access to
-- special_events, special_event_attendance, worker_attendance, and worker_prep_attendance.

-- 1. Special Events Table Permissions
drop policy if exists special_events_read on public.special_events;
drop policy if exists special_events_create on public.special_events;
drop policy if exists special_events_update on public.special_events;
drop policy if exists special_events_delete on public.special_events;

create policy special_events_read on public.special_events for select using (
  auth.uid() is not null
);

create policy special_events_create on public.special_events for insert with check (
  public.is_any_admin()
);

create policy special_events_update on public.special_events for update using (
  public.is_any_admin()
) with check (
  public.is_any_admin()
);

create policy special_events_delete on public.special_events for delete using (
  public.is_any_admin()
);

-- 2. Special Event Attendance Permissions
drop policy if exists special_event_attendance_read on public.special_event_attendance;
drop policy if exists special_event_attendance_create on public.special_event_attendance;
drop policy if exists special_event_attendance_update on public.special_event_attendance;
drop policy if exists special_event_attendance_delete on public.special_event_attendance;

create policy special_event_attendance_read on public.special_event_attendance for select using (
  public.is_any_admin() or public.is_own_worker(worker_id)
);

create policy special_event_attendance_create on public.special_event_attendance for insert with check (
  public.is_any_admin() or public.is_own_worker(worker_id)
);

create policy special_event_attendance_update on public.special_event_attendance for update using (
  public.is_any_admin()
) with check (
  public.is_any_admin()
);

create policy special_event_attendance_delete on public.special_event_attendance for delete using (
  public.is_any_admin()
);

-- 3. Worker Attendance Permissions
drop policy if exists worker_attendance_read on public.worker_attendance;
drop policy if exists worker_attendance_create on public.worker_attendance;
drop policy if exists worker_attendance_update on public.worker_attendance;
drop policy if exists worker_attendance_delete on public.worker_attendance;

create policy worker_attendance_read on public.worker_attendance for select using (
  public.is_any_admin() or public.is_own_worker(worker_id)
);

create policy worker_attendance_create on public.worker_attendance for insert with check (
  public.is_any_admin() or public.is_own_worker(worker_id)
);

create policy worker_attendance_update on public.worker_attendance for update using (
  public.is_any_admin()
) with check (
  public.is_any_admin()
);

create policy worker_attendance_delete on public.worker_attendance for delete using (
  public.is_any_admin()
);

-- 4. Worker Preparatory Attendance (Thursday Prep Class) Permissions
drop policy if exists worker_prep_attendance_read on public.worker_prep_attendance;
drop policy if exists worker_prep_attendance_create on public.worker_prep_attendance;
drop policy if exists worker_prep_attendance_update on public.worker_prep_attendance;
drop policy if exists worker_prep_attendance_delete on public.worker_prep_attendance;

create policy worker_prep_attendance_read on public.worker_prep_attendance for select using (
  public.is_any_admin() or public.is_own_worker(worker_id)
);

create policy worker_prep_attendance_create on public.worker_prep_attendance for insert with check (
  public.is_any_admin()
);

create policy worker_prep_attendance_update on public.worker_prep_attendance for update using (
  public.is_any_admin()
) with check (
  public.is_any_admin()
);

create policy worker_prep_attendance_delete on public.worker_prep_attendance for delete using (
  public.is_any_admin()
);
