# Controlled Firebase-to-Supabase data migration runbook

This runbook prepares a future data migration only. It must not be run against production, and it must not create, reset, or delete real users without separate written approval.

## Preconditions

1. Identify the target Supabase project by its project reference and confirm in the Supabase dashboard that it is the designated development project.
2. Apply and verify every schema migration in that development project, including the application Realtime migration if browser subscriptions are being tested.
3. Export Firebase data with a read-only credential into an encrypted, access-controlled location. Do not place exports or credentials in this repository.
4. Take a Supabase development-project backup and record the migration operator, source export timestamp, target project reference, and schema migration versions.
5. Run the migration first in `--dry-run` mode. The tool must refuse to run unless an explicit target project reference and an operator-supplied approval flag are provided.

## Required migration behavior

- The migration is a server-side, one-time process. Browser code must never receive Firebase admin credentials or the Supabase service-role key.
- It must use an explicit collection-to-table mapping and retain original Firebase document IDs where they are compatible with the target primary keys.
- It must process records in bounded batches, with resumable checkpoints stored outside browser-accessible tables.
- It must validate required fields, normalize timestamps and legacy role values, and write rejects to a protected review report rather than silently dropping them.
- It must create Supabase Auth identities only in a separately approved identity-provisioning phase; importing application records must not create or reset real credentials.
- It must be idempotent: rerunning a completed batch must upsert the same row values without duplicating data.
- It must write an immutable operator audit record for each run and batch outcome.

## Validation gates before cutover

1. Compare source and target counts for every migrated collection/table.
2. Compare IDs and foreign-key coverage; investigate every missing parent or orphaned child.
3. Sample records across each role and class scope, then verify RLS with real development test accounts.
4. Verify data hashes or normalized field-level checksums for each batch.
5. Re-run the migration against the same development export and confirm it produces zero unexpected inserts or updates.
6. Obtain explicit approval before any production data or project is ever in scope.

## Rollback

Do not delete or reset Firebase. If validation fails, stop the run, preserve the reports and checkpoints, and restore only the development Supabase project from the recorded backup. The Firebase reference/rollback copy and source export remain read-only evidence.
