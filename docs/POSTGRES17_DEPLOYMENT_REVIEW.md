# Final PostgreSQL 17 deployment correction — 2026-11-24

**Latest platform compatibility correction:** see RLS_AUTO_ENABLE_DEPLOYMENT_FIX.md.
The generated first-install guard now permits only the verified existing RLS
platform routine/event trigger. That revision passed 185 PostgreSQL 17.12 checks;
the earlier 160-check count/hash below describe the preceding revision.

## Findings and corrections

1. Restore executed the ordinary support rate trigger, so a legitimate admin
   restore could fail after three recent messages. Migration 011 now bypasses
   that one rate check only for admin_role()=admin, an active restore flag and
   an exact unrestored archive payload matching the inserted row. The SECURITY
   DEFINER RPC still checks admin first; a customer's forged flag is insufficient.
   Ordinary submissions retain the existing rate limit and ownership guards.
2. catalog_page and site_bootstrap returned raw product JSON, including arbitrary
   future private fields. Raw products/bundles REST reads were also public.
   Migration 009 now provides recursive explicit public-field projection and
   security-barrier public_products/public_bundles views. Public RPC search, facets
   and output use those views; hidden fields cannot affect public search results.
   Anonymous raw SELECT grants and customer public raw-row policies are removed.
   Staff/admin still read original data through existing operational RLS; nothing
   in the product payload is deleted or overwritten. Frontend details now read
   public_products. Nested offers/variants/labels/placements are sanitized too.
   Existing public relatedIds, placement ranks and legacy variant selling prices
   remain supported. Descriptions/specifications are intentionally public copy;
   do not enter confidential text into a deliberately public display field.
3. The generated deployment now emits MIGRATION_COMMITTED AFTER COMMIT, then runs
   SELECT-only verification, then emits POST_DEPLOY_QUERIES_COMPLETED_REVIEW_RESULTS.
   Precommit structural assertions abort/roll back migration failures. Errors in
   later SELECTs do NOT undo a successful COMMIT: inspect the verification error,
   do not blindly rerun the first-install entry point. A completion marker alone
   does not mean every boolean result passed; review each expected result.

## Executed local verification

**Final result: 160/160 checks passed on PostgreSQL 17.12.** Tested deployment
SHA256: `f48f0c8b0f5544dc1e024ab600b109a0bbed36f66f810c63cc67efd8874cedab`.
The final verification file contains 18 SELECT-only queries; the two deployment
phase markers are separate statements. SQL source/PLpgSQL checks also passed
(13 setup/preflight/migration files, 106 function definitions across revisions).
The official-SDK intercepted browser suite passed. No actual hosted integration
is counted in these results.

- PostgreSQL 17.12, independent fresh loopback-only cluster, actual SQL execution.
- Full first-deployment file including final result queries, not fragments.
- Repeated first-install attempt safely rejected; general setup reapplied; source
  migrations applied in correct order twice. Data fixtures are local and rollback.
- COD checkout, authoritative pricing, product/variant/bundle stock, retries,
  independent concurrent connections (one order/one deduction), lifecycle and
  restoration, admin/staff/customer privacy: existing SQL scenarios executed.
- New public-catalog-privacy.sql: private fields at root/nested levels and unknown
  future keys excluded; no inference via search; raw anonymous reads denied,
  customer raw rows hidden, administrator's original internal fields retained.
- Updated support-archive.sql: restore after three recent messages succeeds with
  replies and ownership preserved; customer forged restore flag is rate-limited;
  staff/anonymous restore denied; repeated restore does not duplicate replies.
- New storage-policy-boundary.sql: public image reads, anon/customer upload denied,
  staff insert allowed but delete/cross-bucket move denied, admin delete allowed.
  These are actual PostgreSQL RLS tests on fixture Storage tables, not file uploads.
- All 13 frontend Realtime subscription tables present in local publication.
  Actual Supabase websocket delivery, JWT filtering and reconnect remain untested.
- Official SDK/browser suite uses fully intercepted fixture HTTP and websocket
  routes on a .invalid domain. No production connection is performed by it.

See `backend-audit/postgres17-results.json` for the final count/outcome. The exact
new SQL bytes were tested locally; previous PostgreSQL 16 results are historical.

## Files and deployment procedure

Authoritative changes: migrations 009/011; js/store-cloud.js; updated archive
scenario; new privacy/Storage scenarios; PostgreSQL 17 runner; source generator
and source test; cloud browser fixture; generated setup.sql, DEPLOY_TO_SUPABASE.sql
and VERIFY_DEPLOYMENT.sql; local test results and this report.

After explicit approval, use the CURRENT complete DEPLOY_TO_SUPABASE.sql ONCE in
the EXISTING MyStore SQL Editor. It contains migrations 001–011 and verification.
Do not also run setup.sql or individual migrations. Existing-object/state guards
must not be bypassed. No production SQL, Supabase configuration change, restore,
data deletion, Git staging, commit or push was performed in this task.

The script is a tested local first-install candidate, not a completed production
deployment. Remaining gates: owner approval, real Supabase application and result
review, actual Auth/Storage/Realtime service checks, verified admin provisioning,
catalog population, cloud build and real multi-device COD purchase. Cloud remains
disabled. No online payment or carrier integration is enabled or required for COD.
