# Backup and rollback

No production backup, restore, migration or rollback was performed by this task.

Before deployment, use project-owner backup/export tooling to capture the full
database, Auth configuration/users, role assignments, RLS, functions, publication
and Storage object inventory. Verify restoration in a separate isolated staging
project; a JSON export of one dashboard page is not a complete database backup.
Storage files and server secrets need their own recovery procedures.

The complete setup is one transaction. Preflight errors or failed statements must
roll it back; do not commit a partial selection. Keep the previous frontend release
and previous tested database schema/configuration separately versioned.

If the new frontend fails, restore the previous static HTML and its matching
hashed assets together. Do not delete tables, replace business records, run a demo
seed or remove unknown policies as a frontend rollback. Disabling cloud mode shows
an explicit local/demo environment; it does not restore remote business data.

If a database change fails after a committed release, stop checkout writes and
take another backup before choosing a reviewed forward repair or an approved
restore. Review payments/carriers separately: restoring database state does not
undo a real external charge or shipment. Reconcile provider IDs/events and stock
reservations before reopening checkout. Never restock historical orders by guess.

Request IDs/fingerprints for historical orders are not invented or backfilled.
Conflicting legacy identifiers remain preserved; manual resolution is required.
Independently maintained image/component/order-line metadata is never deleted by
the synchronization triggers. Archive/unpublish products or disable bundles when
preserved relationships block deletion.
