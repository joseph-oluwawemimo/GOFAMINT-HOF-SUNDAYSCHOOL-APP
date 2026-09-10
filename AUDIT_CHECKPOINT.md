# Application Audit Checkpoint

Updated: 2026-09-10

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

## Verification passed

- `npm run lint` (`tsc --noEmit`)
- 20/20 Node automated regression tests, including pending-save/create/delete hydration protection, first-run gating, and authentication on new mutation routes
- Vite production client build
- esbuild production server bundle
- Production `/api/health`, `/api/system/status`, `/manifest.json`, and unknown-API JSON 404 smoke checks
- Live localhost production boot and health check on port 3000
- In-app browser boot with no console errors and tab-away/tab-return without reload
- Live `/api/system/status` returned initialized=true for the existing Supabase installation; a clean browser opened normal secure sign-in with no console errors

## Remaining live check

Authenticated click-through remains for Workers, Teacher, Class Secretary, Special Training lifecycle, General Superintendent portal oversight, and staff credential editing. This requires user-created demo accounts; credentials should not be shared in chat. The eventual pre-Vercel factory reset has been explicitly deferred until testing is complete and the user authorizes the destructive reset. Do not repeat completed static, automated, build, unauthenticated browser, database durability, initialization-gating, or focus-return checks.
