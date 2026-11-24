# MyStore first database deployment — prepared, NOT executed

**2026-11-24 update:** the revised full deployment was executed successfully on
isolated PostgreSQL 17.12, not production. See POSTGRES17_DEPLOYMENT_REVIEW.md and
backend-audit/postgres17-results.json. Migration 009 now projects public catalog
fields and adds public_products/public_bundles views; 011 safely bypasses the
ordinary rate limit for exact admin restores. There are now 45 public routine
names (including public_catalog_json), plus the internal support routine. The
earlier source-only validation statements below describe the preceding revision.

Current task: source inspection and generation only. No production connection,
SQL execution (including local SQL), migration, restore, push, bucket creation or
settings change was performed. Do not interpret grammar parsing as deployment.

## Entry points and exact execution instructions

1. STOP until the owner approves the database operation. The verified external
   backup is `D:\MyStore-Backups\MyStore-PG17-Session-20261123-134758-63c3ee64\MyStore.database.dump`.
   It contains 386919 bytes and the verified SHA256 is
   `4B75B7F1FD2A42329B7090E83C35DB3E0A3759590EDC738B8AAB33DB20BE0D81`.
   The owner confirmed the Storage Dashboard currently has no buckets. Do not
   infer Auth users or other managed platform data are empty.
2. After approval, open the EXISTING MyStore project in Supabase Dashboard and
   check reference `gsgbbhvbxfloyrhnywol`. Do not create another project.
3. SQL Editor → New query. Copy ALL of `supabase/DEPLOY_TO_SUPABASE.sql` from the
   CURRENT local file, including its first-install guard and final verification
   SELECTs. Do not reuse the older pasted version ending in migration 010.
4. Review the selection, then (only after approval) Run the entire query, not a
   selected fragment. It includes preflight + migrations 001–011 in ONE transaction.
   Do NOT separately run setup.sql, preflight.sql or the individual migrations.
   Never use support-setup.sql, db/admin-schema.sql, supabase/tests or stub.sql here.
5. If the first-install guard, preflight or assertions fail, STOP and retain the
   complete error. Do not remove guards, manually commit partial work, drop objects,
   seed data or rerun arbitrary fragments. If an error leaves an open transaction
   in an interactive client, it must be rolled back before another attempt.
6. Inspect the verification result sets after COMMIT. Alternatively use the full
   `supabase/VERIFY_DEPLOYMENT.sql`, which contains SELECTs only. Expected tables,
   routine names and policy presence must be true; there must be 11 migration rows,
   messages.customer_id, security_invoker=true, and COD-only payment settings.
7. STOP again. Provisioning a verified administrator, importing the real catalog,
   enabling frontend cloud mode and publishing are later approved operations.
   No administrator, fake product, customer or order is seeded by this script.

The first-install entry point intentionally refuses existing application
relations/routines or application Auth/Storage objects. It also refuses nonempty
Storage, missing platform roles/schemas/publication, or a different database name.
It does not certify project identity by database name alone: the owner must verify
the Dashboard project reference. Re-running it AFTER success is expected to abort;
use verification SELECTs instead. General setup repeatability is a separate concern.

## Consolidation and duplicate/conflicting definitions

The entry point embeds complete migration history, preserving dependency order,
instead of flattening definitions into a newly untested dependency graph:

| Definition | Revisions in setup | Final authority |
| --- | --- | --- |
| is_support_admin | 001, 006 | public.user_roles through admin_access; no legacy private admin list |
| workspace_order_sync | 001, 006 | immutable commercial/request/customer fields, staff operation restrictions and lifecycle/stock guards |
| message_customer_sync | 002, 010, 011 | verified customer ownership plus admin-only archived-row restore |
| apply_verified_payment | 002, 006 | service-only settlement, event deduplication, mismatch/late-payment handling |
| customer_summary | 004, 006 | operational role check and bounded IDs |
| messages view | 001, 011 | final view exposes customer_id and invoker security; column-only anon INSERT |
| support_manage policy | 001 → 007 | broad ALL policy removed; separate staff read/update and admin delete |
| customer order policies | 002 → 005 | raw own-order access removed; sanitized customer_orders RPC |
| demo order delete policy | 001 → 011 | dead delete authorization removed; preservation guards unchanged |

The history contains DROP POLICY/TRIGGER and CREATE OR REPLACE statements for
definitions introduced earlier IN THE SAME transaction. The new guard aborts
before application definitions if existing target objects are detected; it does
not use these statements to replace previously installed business objects. No
DROP TABLE, DROP SCHEMA, TRUNCATE, wholesale business DELETE or seeding is present.
Normal future RPC operations can perform deliberately authorized deletes; defining
a function is not invoking it. Managed Supabase schemas/data are retained.

## Dependencies and review results

- 001: base tables, verified role helpers, checkout, triggers, Storage contracts.
- 002: customer ownership columns, product images, replies, transaction/shipment
  tables, relational synchronization, paged dashboard queries and reporting.
- 003–005: overview, order operations/search, sanitized customer history.
- 006: stock reservation/release, status guards, service-only settlement, privacy
  and explicit grants. No reservations guessed for historical orders.
- 007: separated support permissions, COD-only guard, private future carrier
  requests, relationship-preservation FKs and BEFORE DELETE guards.
- 008: duplicate prechecks, validated unique request ID index and legacy lookup.
- 009: server catalog/bootstrap/facets and operational summaries.
- 010: verified admin assignments, catalog/variant validation, explicit guest
  linking (not auto-run), categories/notifications and own support history.
- 011: complete view/anon INSERT grants, full message/reply archive and admin
  restore, remove dead order-delete authorization. This review additionally fixes
  category Realtime publication to match the actual frontend subscription.

The three additive preserve_* FKs remain NOT VALID by design for legacy
compatibility; they still enforce new operations, and parent BEFORE DELETE guards
protect existing relationships. Verification displays their status explicitly.
Unique checkout/SKU/contact keys have duplicate checks; independently maintained
image, bundle and order-line metadata is not deleted/reinserted by synchronization.

## Expected 22 application tables (all RLS enabled)

```text
store_schema_migrations profiles user_roles categories products bundles
bundle_items customers orders order_items notifications settings support_messages
product_images inventory_transactions message_replies payment_transactions
provider_events shipments order_stock_reservations shipment_requests
deleted_support_messages
```

Also: `public.messages` compatibility VIEW, and `support_private.limit_submissions`
internal trigger routine. Existing Supabase auth/storage/realtime tables remain
platform-owned and are not recreated by this deployment.

## Expected 44 public routine names

```text
admin_access admin_analytics admin_category_page admin_customer_detail
admin_notifications admin_operational_summary admin_overview admin_page
admin_report admin_role admin_search admin_set_order_status admin_summary
apply_verified_payment archive_deleted_support_message backfill_guest_customers
catalog_match catalog_page customer_orders customer_summary
customer_support_messages effective_product_price guard_catalog_shape
guard_category_delete guard_payment_settings guard_preserved_children
is_support_admin list_support_messages message_customer_sync new_admin_profile
order_customer_sync product_relations_sync protect_reserved_variants
reserve_order_record restore_deleted_support_message restore_order_stock
site_bootstrap submit_store_order support_submission_guard
verified_administrative_role workspace_bundle_sync workspace_order_items
workspace_order_sync workspace_product_sync
```

These include internal trigger functions: presence does NOT imply browser EXECUTE.
Checkout is public; admin APIs require verified roles; stock restoration is internal;
payment settlement is server-only. No frontend payment confirmation is trusted.

## Storage: exactly one required bucket

Frontend `js/admin/cloud-operations.js` uploads to and reads public URLs from
`product-images`. SQL provisions exactly this bucket:

- public product imagery only; WebP; maximum 12582912 bytes (12 MiB).
- `admin_image_read`: SELECT scoped to product-images (public imagery).
- `admin_image_insert` / `admin_image_update`: authenticated verified admin/staff,
  scoped to product-images, with checks for both original/new rows on UPDATE.
- `admin_image_delete`: verified administrators only, scoped to product-images.

No avatars, documents, payment or order attachment buckets are required. No actual
files are uploaded by this SQL. Existing bucket mismatch aborts the first-install
entry point. The dashboard converts accepted image input into WebP before upload.

## Static functional contract review (not executed tests)

| Flow | Source contract checked | Remaining execution check |
| --- | --- | --- |
| Checkout | stable UUID retry, pending guard; submit_store_order prices/locks/fingerprint/atomic stock | actual Supabase response and error/cart behavior |
| COD | settings guard locks cod=true/card=false/valu=false; server rejects online methods | real device purchase and disabled UI |
| Inventory | product/variant/component quantities; reservations; release once; consumed stock not restored | actual DB transactions/concurrent live sessions |
| Orders | admin_set_order_status + workspace guard, immutable fields, server timeline and terminal rules | real admin/staff JWT operations |
| Customers | verified owner association; sanitized own-order/support RPCs and RLS | two distinct customer sessions |
| Admin | confirmed Auth user + public.user_roles only, no auto-promotion | first admin provisioning and session revocation |
| Support | anon insert without select; staff read/limited update; admin delete/restore with replies | actual REST grants and authenticated role checks |
| Realtime | published/subscribed operational tables, including corrected categories | real event delivery and reconnect |

## Validation and blockers

All 26 supabase source files (including generated entry points, tests and Edge
Function scaffolds) were read. All 21 SQL files passed grammar parsing; the entry
point also passed PL/pgSQL parsing and source invariants. The verification file
has 17 SELECT statements and no DDL/DML. No SQL was executed in this review.

Earlier 145 PostgreSQL 16 checks apply to the previous setup revision, NOT the
new first-install guard/assertions or new category publication correction. This
revision is source-validated but runtime-unexecuted, as requested. No deployment
success, actual Supabase compatibility or end-to-end acceptance is claimed.

Remaining gates: owner approval, hosted application/verification, verified admin,
real catalog creation/import (cloud catalog otherwise empty), Auth URL setup,
Storage upload/RLS testing, real JWT isolation, Realtime delivery, and live
multi-device COD acceptance. Frontend cloud mode is still disabled and frontend
changes remain uncommitted; no release or push was performed. Card/ValU/carrier
API scaffolds stay unconfigured and are NOT required to deploy COD database tables.
