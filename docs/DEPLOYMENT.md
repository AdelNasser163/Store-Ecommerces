# Deployment and activation gates

Production database execution is prohibited in this task. The checked-in browser
configuration remains `enabled:false`; public URL/key are not secrets. No website
release or backend deployment is implied by successful local tests.

## Database source order

`node tools/build-supabase-setup.cjs` generates **one complete transaction** in
`supabase/setup.sql`, in this order:

1. `supabase/preflight.sql` — compatibility, duplicate keys and transaction lock.
2. Migrations 001–007 — corrected base schema, privacy, support, payment/stock guards.
3. `202611230008_checkout_identity.sql` — dedicated request identity indexes and view grants.
4. `202611230009_live_queries.sql` — bounded public catalog and operational queries.
5. `202611230010_privacy_and_roles.sql` — verified administrative roles, catalog
   validation, explicit guest backfill, own support history, notifications/categories.
6. `202611230011_deployment_safety.sql` — refresh messages view after all columns,
   column-only anonymous INSERT, admin-only full-message/reply archive and restore,
   remove dead order-delete authorization. Fresh pgcrypto installs use extensions.

The latest disposable PostgreSQL 16.11 gate passed 145 checks. Hosted execution
still requires the backup/manual gates in SUPABASE_SETUP_STEPS.md; see
FINAL_CHECKLIST.md and REMAINING_ITEMS.md for current release status.

Do not apply selected fragments or use the retired `support-setup.sql` or legacy
`db/admin-schema.sql` as production setup. All new managed policies/triggers are
included in the generated allowlist. Duplicate legacy request IDs, SKUs or natural
keys abort rather than merging/removing records. Existing incompatible/custom
objects must be reviewed; source checks cannot certify an unseen database.

## Required manual staging steps

- Take/verify a backup and restore it to an isolated staging database/project.
- Install the complete setup there and repeat it. Inspect real custom columns,
  indexes, constraints and policies if preflight refuses compatibility.
- Configure Auth Site URL and exact callbacks for `auth.html`,
  `reset-password.html`, `admin-login.html`; configure email/SMTP and optional Google.
- Create verified admin/staff/customer accounts following `FIRST_ADMIN_SETUP.md`.
- Verify Data API access and the explicit Realtime publication. Test two devices,
  expired sessions, role revocation and customer A/B isolation using actual JWTs.
- Review `product-images`: public product imagery only, WebP uploads, maximum
  12 MB. Existing bucket configuration is not overwritten; no private documents.
- Migrate real browser catalog data using an explicit reviewed import. Nothing
  auto-imports local/demo orders, customers or messages into the project.
- Historical customer linking is an explicit bounded admin RPC:
  `backfill_guest_customers(p_limit,p_after)`. It groups reliable email/phone contacts,
  skips missing identifiers and already-owned customer matches, never sets
  auth_user_id and never overwrites existing customer contact fields. Review the
  returned linked/skipped counts and pass its `nextCursor` as `p_after` for the next
  batch. It is not called during setup or on page load.
- Run true concurrent checkout tests with independent PostgreSQL connections.
- Deploy server functions only after reviewing provider configuration. The current
  payment and shipment endpoints return 503 because no actual providers exist.

## Frontend activation

Only after staging passes: set the public URL/publishable key in
`supabase-config.js` and deliberately enable cloud mode, then run
`npm run build:performance`. Publish the generated HTML/dist assets together.
The shared SDK is bundled only in cloud mode; changing a source flag alone does
not alter deployed hashed bundles. Do not mix bundles from separate builds.

Cloud mode uses an in-memory server catalog, bounded server filters/pages and real
SDK authentication. It does not use browser demo records after a service failure.
Cart/wishlist, language/theme and UI preferences remain legitimate local UX state.
Local mode remains explicitly local; it is not evidence of a backend integration.

Card/ValU remain disabled in backend configuration and checkout. Shipping fees
remain configured business prices; no carrier/tracking integration is implied.
See `REMAINING_CREDENTIALS.md`. Never place secrets in frontend or build artifacts.
