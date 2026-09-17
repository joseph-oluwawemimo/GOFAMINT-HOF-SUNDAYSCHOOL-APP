# Application Audit Checkpoint

Updated: 2026-09-13

## Completed

- Workers Directorate recursive cloud-refresh/realtime loop fixed.
- Duplicate Workers realtime refresh handling removed.
- Background Workers refreshes no longer replace the screen with the initial loader.
- Workers data-load and attendance-write failures are visible and optimistic attendance updates roll back.
- App update checker now cleans up focus, visibility, and interval listeners.
- Duplicate concurrent profile resolution is suppressed.
- Local IndexedDB data can no longer override a server profile's unapproved status.
- Teacher/Class Secretary access uses an exact assigned class ID, never a partial ID match.
- Remembered class sessions restore only the signed-in user's assigned, explicitly approved class.
- Teacher/Class Secretary class-directory results are scoped server-side to their assigned class.
- Teacher/Class Secretary roles can read the worker directory required by class registration.
- Missing class approval status is fail-closed, including backup imports.
- Staff approval, API error handling, AI server boundary, calculations, dates, PWA assets, and fatal server errors were audited and corrected earlier in this same audit.
- Every generic database save/delete now commits locally before returning and durably records its cloud operation before attempting Supabase.
- Pending local saves, creates, and deletes are protected from being overwritten by an older realtime/cloud hydration snapshot.
- Cloud retry operations are revision-safe, serialized per record, and survive an IndexedDB outage through a localStorage outbox fallback.
- Class registrations, lessons, departments, Workers data, attendance, offerings, grades, members, and administrative records use the durable write path without duplicate cloud writes.
- Local and Supabase realtime changes now update active Workers, Treasurer, Record Officer, Enrollment Officer, and administration views without page navigation.
- Returning to the browser no longer performs an app-version or service-worker forced reload; focus only performs a throttled background sync.
- Editable unsaved fields activate the browser's accidental refresh/close warning until a durable local save completes.
- First-run setup is fail-closed: request failures open normal sign-in, existing profiles/year/classes imply an initialized system, and bootstrap rechecks this server-side before creating anything.
- Special Training events use one authoritative cache; the stale backup that resurrected deleted events was removed. Create/edit/archive/restore/honors/delete and attendance writes/deletes now surface server failures.
- General Superintendent has an audited password-free switcher into every approved administrative officer portal, plus existing Workers and class oversight.
- General Superintendent and General Secretary can edit permitted staff display names/login emails and reset passwords; class login IDs remain immutable while their display name/password can be updated.
- Class creation is restricted to Assistant General Secretary roles, and the General Superintendent class-login creation control is removed.
- Quarter settings no longer get overwritten by hard-coded 2025 dates during reads; a missing local year is recovered from Supabase before a local-only blank setup shell is created.
- General Secretary archive-and-transition now archives the selected active quarter and activates the next quarter even before lesson distribution. Teacher/Class Secretary accounts can only view quarter status; the obsolete class-side global archive path was removed.
- Department create/rename/delete no longer replaces the full year state with a string array (the direct cause of the `quarters.find` application crash); linked class reassignment is persisted to Supabase.
- New member creation, profile editing, CSV/paste import, templates, and row adjustment cannot manually assign Student status. New records are always Visitors.
- Conversion requests are unavailable before three consecutive attendances. The separate 50% eligibility rule is evaluated only at Week 12 against the member's eligible attendance window and remains subject to Enrollment Officer approval.
- Member-profile forms now stay open and expose the exact save error until their durable write succeeds.
- Realtime INSERT/UPDATE handling now merges event rows directly into IndexedDB instead of re-downloading the entire affected table after every event.
- Workers realtime subscriptions are attached only for Workers/Assistant General Secretary scope, rather than for every administrative login.
- General Superintendent authorized-officer counts are derived from unique created profiles, cannot display an impossible numerator, and identify pending officer titles.
- General Superintendent now has a visible Database Control entry point to the existing export/restore/reset facility.
- Weekly quarter analysis now displays an explicit Absent column.
- Quarter forwarding presents only Forward to Next Quarter or Exempt, preserves Student/Visitor type, retains historical quarter data, and persists visitor consecutive-attendance progress across quarter boundaries.
- The six-week welfare workflow now presents exactly Continue Monitoring, Temporary Exit, or Permanent Exit; weeks 1–5 remain follow-up only. Permanent exits record the quarter/week/reason, retain history, and are excluded only from the departure week onward.
- Record Officer and Enrollment Officer portals now include a searchable Departed Members register with preserved former class/department details.
- Welfare actions now await durable log and status writes, remain open on failure, and display the exact error. Quarter-enrollment status is synchronized during member saves instead of silently restoring an older status.
- Enrollment certification audit records moved from localStorage to versioned IndexedDB plus the durable Supabase outbox/realtime pipeline. A migration adds the protected central table and imports legacy browser audit records once.
- Predefined printable return, quarter, Record Officer, and Enrollment Officer reports identify signature roles only; hard-coded or live personal names were removed from official templates.
- Fresh local-cache initialization no longer attempts unauthorized Supabase writes for every default worker category/clock-in setting, eliminating a repeated RLS-error and retry-queue traffic source visible in browser diagnostics.
- Departmental Superintendent is now a first-class account type. Provisioning requires a real department, permits only one superintendent per department, and the server scopes class results to that department.
- Departmental Superintendent hydration clears cross-login cached operational stores, Supabase RLS limits members/grades/classes to assigned-department rows, and the new dashboard exposes read-only class/member/attendance/score analytics without Workers or edit access.
- Archived quarters can be explicitly unlocked for authorized corrections while retaining ARCHIVED status, then saved and re-locked read-only; archived class registers never become active during correction mode.
- General Superintendent Database Control now includes archive-first Classes, Workers, and Admin reset scopes with exact confirmation phrases. Admin reset preserves the General Superintendent; each scope is transactionally isolated.
- Full factory reset now has a reviewed server/RPC implementation, remains disabled unless `FACTORY_RESET_ENABLED=true`, and is not to be executed until demo verification is complete and the user expressly authorizes it.
- Historical server archive metadata can be listed without downloading the stored snapshot, and a selected archive can be downloaded on demand.
- Annual year rollover is now archive-first and transactional: it retains classes/workers, clears assignments and annual operational data, removes class-login identities safely, and initializes the new year with preserved departments.
- Profile loading and server authorization now fall back safely while the new `department_id` migration is pending, so an existing installation is not forced back into setup or an application-error screen during deployment.
- The Workers portal, all five administrative oversight portals, the staff credential directory/edit dialog, Assistant General Secretary class creation, and General Superintendent read-only class oversight were verified live without repeating completed flows.
- Ordinary Workers are restricted to their own attendance screen; Departmental Superintendents and unrelated officers cannot enter Workers management APIs. Read-only class oversight no longer exposes add/import/edit/delete/conversion controls.
- A stale configured Sharing Week date can no longer place Week 13 in an earlier year; the schedule derives the correct Sunday/Thursday dates after the lesson weeks.
- Special-event cloud state is authoritative, so permanently deleted events cannot be resurrected by stale browser data; parent deletion is a single database operation backed by the attendance cascade.
- Unsaved non-sensitive form values are preserved in session storage across accidental reloads, restored without a reload loop, and can be cleared normally. Password, file, hidden, and button inputs are never persisted.
- Silent error swallowing found in the final sweep was replaced with explicit operation-specific reporting or logging.
- Authoritative cloud refreshes now preserve durable pending writes but remove stale browser-only rows even when the server returns an empty collection; a forced refresh propagates authentication/network failures instead of presenting cached data as current.
- Worker profile editing no longer reinitializes on background realtime attendance changes, generated worker IDs remain stable for the full edit session, and the attendance ledger no longer contains a hard-coded 2025 fallback.
- Realtime publication/listeners now cover lessons, departments, clock configuration, and Special Training attendance. Database policy independently enforces that only Assistant General Secretary roles may create classes.
- The fresh Supabase project was linked, migrations `202609020001` through `202609130002` were applied, and direct read-only verification found one bootstrap GS identity/profile and zero workers before demo records were added.
- A safe development-only authentication diagnostic identified an obsolete service-worker-controlled browser tab whose JWT issuer belonged to the former Supabase project. That tab was closed and replaced with a clean new-project sign-in tab.
- Fresh-project live Workers verification passed: the demo worker survived reload/restart, profile edits persisted to Supabase, and Week 1 Sunday plus Thursday Prep attendance survived a full browser/server restart.
- The complete Special Training lifecycle passed against Supabase using a temporary demo event: create, clean-tab reload, roster/manual attendance, archive, restore, retained attendance, delete, and foreign-key cascade cleanup. Direct database verification found zero remaining event or attendance rows after deletion.
- General Superintendent live UI verification passed for staff-login creation, active-account listing, editable name/email/password controls, officer oversight entry, Workers entry, and absence of the class-login creation control.
- The Teacher/Secretary portal boundary loaded successfully as General Superintendent and correctly reported that no class is assigned/available in the fresh database instead of exposing an unauthorized or partial class match.
- Live Assistant General Secretary class creation now passed against Supabase for `Adult A / ADULT_A`: the protected server created the class, approved combined Teacher/Class Secretary Auth identity, and exact profile assignment without storing a readable password.
- The class creator no longer falls back to a browser-only ghost after an API rejection, supplies no weak default password, and never displays or stores the class password in directory data.
- Live class-login and registration verification exposed and fixed a false-success upsert. Class registration now uses a protected assigned-class endpoint, validates selected workers, waits for the database result, clears stale retries, and cannot change lifecycle approval directly from a browser session.
- The corrected `ADULT_A` registration persisted `DEMO WORKER TEST` as secretary and teacher, `PENDING_APPROVAL`, and `isSetupComplete=true` in Supabase and survived a full browser refresh.
- General Superintendent approval of `ADULT_A` persisted `APPROVED`, the approving identity, and approval timestamp in Supabase without storing a readable class password.
- The approved Teacher/Class Secretary register unlocked successfully. A fake visitor, Week 1 grade (40/50), and ₦1,000 pending-remittance offering persisted to Supabase and all survived a full browser reload.
- A live approved `Adult` Departmental Superintendent test identity was created. Its JWT could read only `ADULT_A` class/member/grade analytics, returned `403` for Workers and Special Training APIs, returned zero worker rows through RLS, and could not update a member record.
- General Secretary quarter lifecycle passed live against Supabase: Quarter 1 was archived, Quarter 2 activated, Quarter 1 temporarily unlocked for an authorized correction, the correction persisted, and Quarter 1 was re-locked with its original theme restored.
- Database policies now independently reject grade and offering creation/update/deletion outside the active quarter. Live class-JWT attempts to modify the archived Quarter 1 grade and offering were denied with zero rows changed.
- Quarter headers use the stored per-quarter status, not only the active-quarter number. The class archive command and confirmation UI were removed, and archived attendance, score, offering, visitor, and referral controls are disabled.
- Durable offline retry records are bound to the Supabase user that created them. A different account can neither replay nor overlay those writes during hydration; legacy unowned retries are quarantined with an explicit diagnostic.
- Final clean-origin production UI verification passed on port 3300: `ADULT_A` signed in, the approved class directory loaded, Quarter 2 displayed Active, Quarter 1 displayed Archived/Read-Only, the stored demo member/40-point grade/₦1,000 offering remained visible after full reload, and browser diagnostics recorded successful hydration with no errors.

## Verification passed

- `npm run lint` (`tsc --noEmit`)
- 45/45 Node automated regression tests, including class provisioning/registration persistence, cross-quarter visitor streak continuity, pending-save/create/delete hydration protection, account-bound retry protection, archived-quarter database integrity, first-run gating, special-event deletion, forced-refresh error propagation, worker form stability, worker-manager authorization, department RLS/reset-boundary checks, annual reset invariants, three-visit conversion gating, quarter-end eligible-window calculations, realtime row merging, and Workers egress-scope isolation
- Vite production client build
- esbuild production server bundle
- Production `/api/health`, `/api/system/status`, `/manifest.json`, and unknown-API JSON 404 smoke checks
- Live localhost production boot with the latest server changes on port 3300
- In-app browser boot with no console errors and tab-away/tab-return without reload
- Live `/api/system/status` returned initialized=true for the existing Supabase installation; a clean browser opened normal secure sign-in with no console errors

## Functional audit status

All planned code, database-policy, automated regression, production-build, and demo lifecycle checks are complete. The eventual pre-Vercel factory reset remains explicitly deferred until the user separately authorizes that destructive reset. Do not repeat completed Workers, Special Training, static, automated, build, initialization-gating, General Superintendent oversight, credential-dialog, class creation/registration, quarter lifecycle/correction, archived-write denial, class read-only, draft-recovery, focus-return, grade/offering, or Departmental Superintendent checks.

## Remaining deployment / live verification

- All repository migrations through `202609130002` are applied to the linked fresh Supabase project; no reset has been executed.
- Archive download and staged-reset implementations have automated/server-boundary coverage. Their destructive reset step is intentionally not executed against the demo database without separate user authorization.
- After Vercel deployment, observe the Supabase dashboard/logs over a representative usage period to measure real-world egress. This operational measurement cannot be completed on localhost and is not an outstanding code defect.
