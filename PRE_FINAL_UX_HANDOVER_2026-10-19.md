# Sunday School pre-final UX handover — 19 October 2026

## Implemented in this checkout

- Student percentage displays use two decimal places. The class register keeps one SSS dispatch workspace with compact member cards, WhatsApp, Mark Done, and View Card. The old lesson-points entry and duplicate dispatch flow were removed.
- SSS completion uses an authenticated, atomic server write and a confirmed response. It updates immediately, rolls back a failed save with an error, and is merged with newer completion records on subsequent class saves.
- Private profile links are prepared by the server with cryptographically random tokens. A member without a secure token cannot be sent a WhatsApp report containing a predictable member ID. New members complete their profile and photo first; registered members are directed to the live report card. The public card reads current-quarter grades, including legacy records whose indexed columns were empty, and reports read failures rather than displaying stale zeroes.
- Report Card has its own navigation entry. Phone navigation has four direct items and a More panel, with no sideways scrolling in the local 320 px and 390 px review.
- Visitor follow-up controls were removed from Student Registration. SSS and follow-up wording now asks a respectful, direct question to invite a reply.
- Visitation assignments freeze one weekly slate of at most four people. Completing a visit changes progress within that slate; it does not insert a replacement. Concurrent class updates preserve newer visitation records.
- Worker clock-in totals use the live attendance state, exclude absent placeholders and duplicate rows, and keep eligible workers such as an unclocked Alayo in the queue. The 12-week roster scores on-time arrivals as 1, late arrivals as 0.5, and missed eligible sessions as 0. Future and pre-joining sessions do not count.
- Background tab switches retain page state. A full refresh on focus is deferred until a meaningful absence or a failed live connection. Cloud reads now reject incomplete pagination and report failures. Authenticated client writes carry a revision and protocol marker; the prepared database trigger rejects older cached clients and stale revisions.
- Approval fallback now requires a confirmed database response before recording local success. It cannot create a missing class as a side effect.

## Verification completed locally

- `npm test`: 219 passed, 0 failed.
- `npm run lint`: passed.
- `npm run build`: passed. The build still reports bundle-size and mixed static/dynamic import warnings; these are performance follow-up items, not build errors.
- `npm start` local production smoke test: server launched; `/api/health` and `/` both returned HTTP 200. The local server was then stopped.
- Local browser fixture `tests/ui/ux-review.html`: checked 320 px, 390 px, and 1280 px widths; no document overflow. Checked mobile More panel, View Card dialog, immediate Mark Done progress, separate Report Card navigation, and return to SSS Report retaining completion. The fixture contains invented members and never contacts the live database.
- No production database records, accounts, or passwords were modified during this work.

## Deployment gate

The local code is ready for a staging rollout. The two new SQL migrations have **not** been run against a database, and the production app has **not** been deployed or smoke-tested. Do not describe the live issue as fixed until those steps pass.

1. Take and verify a recoverable backup using the existing database backup process. Apply `supabase/migrations/202610180001_atomic_sssr_delivery_persistence.sql` to staging and check that its three service-role RPCs work with disposable staging members.
2. Deploy the matching API and client to staging. Verify new and already-registered private links, live current-quarter cards, SSS Mark Done after a fresh login, the four-person visitation slate, live worker counters, and approval error handling. Confirm no password or unrelated member field changes.
3. Apply `supabase/migrations/202610180002_reject_obsolete_client_writes.sql` to staging. Verify a current client can write and an older cached client receives `APP_UPDATE_REQUIRED` or `STALE_WRITE_REJECTED` without changing the stored record.
4. Repeat the backup and staged sequence for production, then perform a read-only comparison of member/class/grade counts and a controlled smoke test. Deploy the client and API together; apply migration 002 promptly after the new client is available.

The user's six-week production data was deliberately not used as test data. Performance on the live network and live Supabase instance, worker Alayo's exact stored status, real cross-device synchronization, and the reported occasional lost-password symptom still require production observation after rollout. No credential-setting code was changed.
