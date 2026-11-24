# Final SQL correction — deployment remains disabled

**Historical review. [DEPLOYMENT.md](../DEPLOYMENT.md) and
[TEST_REPORT.md](../TEST_REPORT.md) supersede this document. The current setup has
ten migrations and has been tested in disposable local PostgreSQL. Production SQL
and hosted Supabase integration remain unexecuted.**

This earlier review superseded earlier deployment checkpoints. **At that point no SQL was executed,
no production connection was opened, and no existing business data was modified.**
The complete corrected source is `supabase/setup.sql`. Source parsing and local
browser tests are not hosted Supabase integration tests.

## Changes and preservation

- Support permissions use only `public.user_roles`. The permissive ALL policy is
  removed; staff may SELECT and UPDATE only `status`, `read_at`, `starred`,
  `archived`. DELETE requires `admin`. Customer contact submissions and anonymous
  submissions remain, subject to validation/throttling. Admin restore/undo has an
  explicit INSERT policy. Staff cannot assign roles or change customer ownership.
- The support delete control is also hidden from staff in the frontend. This is
  only UI behavior; database RLS is the authorization boundary.
- Possible inherited Supabase default grants on image/audit/reply tables are reset
  before granting only their intended operations. Browser roles explicitly lose
  TRUNCATE/REFERENCES/TRIGGER on managed tables; RLS alone does not protect TRUNCATE.
- Payment defaults and the final settings guard enforce Card=false, ValU=false,
  COD=true. The only existing-setting change prepared in this migration is this
  explicitly requested payment availability correction; other settings keys and
  metadata are preserved. Browser settings changes cannot re-enable unconfigured
  providers. Existing paid/order/transaction history is not rewritten.
- Online checkout remains refused by the cloud checkout RPC. The existing
  service-only settlement RPC stays protected; it is not an implemented provider
  webhook. Real payment creation, raw-signature verification and provider lookup
  still need a server adapter and secrets before a reviewed enabling migration.
  COD checkout/fulfillment stays available; order fulfillment is not proof of
  collected funds. Automatic reconciliation of collected COD funds is not provided.
- `settings.shipping` contains configured fees only. A separate private
  `shipment_requests` table provides idempotency keys and an initial
  `unconfigured` state. Only trusted server code may write carrier responses.
  Setup inserts no shipments, requests, provider confirmations or tracking numbers.
- All delete/reinsert statements were removed from image, bundle-component and
  order-line synchronization triggers. Conflicting existing rows use DO NOTHING;
  existing UUIDs, positions, quantities, payload fields and independent metadata
  are preserved. Existing relationships are retained, including ones absent from
  current JSON. Checkout filters bundle components against the current validated
  `productIds`, so retained historical components are not purchased accidentally.
- Order item changes are rejected after creation; status/notes updates do not
  rebuild the line table. Catalog parent DELETE is refused while preserved child
  rows exist, before old CASCADE foreign keys can delete them. Archive/unpublish
  products or disable bundles instead. No automatic child-row cleanup is provided.
- Existing historical order/customer associations are left unchanged, including
  null associations. Their ownership must be linked in a separately reviewed import;
  historical customer account history is incomplete until that explicit step.
- Bundle validation rejects missing/null/scalar/object/empty arrays, fewer than 2
  or more than 8 entries, null/non-string/blank IDs, duplicates and unknown products.
  Existing draft products can be selected by administrators; checkout separately
  requires publication and availability. Invalid legacy bundles are not rewritten
  during migration, but must be corrected before their next edit/checkout.
- Stock reservation/restoration and settlement protections remain: authoritative
  quantities/prices, stable locks, one release per reservation, terminal order
  guards, server-managed status audit, event deduplication, amount/currency checks,
  and manual reconciliation for late settlement after cancellation. Historical
  orders without a recorded reservation are not automatically restocked.

## Future execution order — do not run during this review

Use a verified backup restored into an authorized disposable staging database
first. Review unknown schema/policy/constraint conflicts; do not delete business
data or remove unfamiliar policies merely to make the preflight pass.

The generated `supabase/setup.sql` runs these as **one atomic transaction**:

1. `supabase/preflight.sql` — compatibility checks and migration lock.
2. `202611220001_existing_model.sql` — corrected base schema/checkout/sync.
3. `202611220002_relations_and_queries.sql` — corrected non-destructive image sync.
4. `202611220003_overview.sql`.
5. `202611220004_safe_operations.sql`.
6. `202611220005_customer_privacy.sql`.
7. `202611220006_security_review.sql`.
8. `202611220007_final_permissions.sql` — final support/payment/shipping safeguards.

Do not execute selected fragments. The final policies/functions supersede earlier
definitions before COMMIT. There is no DROP TABLE/TRUNCATE, and no support-message,
product, image, bundle, customer or order deletion in setup. Known project-owned
triggers/policies are reinstalled. Unknown structures cause a rollback rather than
being guessed or removed. Runtime repeatability and production schema compatibility
are **not verified by parsing**; they require an authorized staging execution.

Regenerate source with `node tools/build-supabase-setup.cjs` after migration edits.
Never use the retired `support-setup.sql` or legacy `db/admin-schema.sql` as the
production entry point. LocalStorage data is not automatically imported.

## Exact first-administrator initialization (future trusted operator action)

1. Open the existing Supabase project → Authentication → Users → Add user/invite.
2. Create the intended administrator, complete email verification, and copy the
   UUID from Authentication. A user-entered email/metadata is not authorization.
3. After staging approval and complete schema installation, a trusted project
   owner can use the following SQL with that UUID. This is documentation only;
   it was not executed during this review.

```sql
do $$
declare chosen_user uuid := 'REPLACE_WITH_VERIFIED_AUTH_UUID'::uuid;
begin
  if not exists(select 1 from auth.users
                where id=chosen_user and email_confirmed_at is not null) then
    raise exception 'Create and verify this Auth user first';
  end if;
  insert into public.user_roles(user_id,role) values(chosen_user,'admin')
  on conflict(user_id) do update set role=excluded.role;
end $$;
```

4. Sign in through `admin-login.html` with that Auth account. Test staff/customer
   denial separately. Public registration never assigns administrative roles.

### Existing support administrators

`support_private.admins` is retained as historical authorization data but no longer
grants access. **No automatic bulk promotion is performed.** A trusted operator
must inspect each legacy UUID in Authentication, confirm email verification and
current business authorization, then deliberately assign `staff` (inbox operations,
no deletion) or `admin` (broader store access and message deletion).

For each approved, verified legacy UUID, the same guarded initialization block can
be used with the deliberately selected role. For staff, replace the role literal
with `'staff'` and use `ON CONFLICT(user_id) DO NOTHING` to avoid demoting an existing
administrator. Unverified/missing/unapproved users get no new role. Legacy rows
and support messages remain untouched; audit the chosen mappings before applying.

## Remaining manual configuration

- Backup/restore test, staging migration, RLS/grant/concurrency tests, actual
  two-device Realtime, Storage bucket settings, and hosted Auth role verification.
- Auth Site URL/callback allowlist, verified users, email delivery and optional
  Google OAuth provider configuration.
- Real catalog import, remaining scoped/paginated storefront and bundle backend
  work; shared config remains `enabled:false` until this is complete and tested.
- Payment provider selection, server payment creation and signed authenticated
  provider webhook; refunds, reservation expiry scheduler and reconciliation UI.
- Carrier API selection, server credentials, admin authorization on carrier request
  endpoints, real reference/tracking persistence and signed carrier callbacks.
- Outbound support email and server-side distributed-abuse/CAPTCHA protection.

## Verified versus unverified

Final local results: **25/25** source/unit/browser suites passed, plus **30** CSS
page/viewport comparisons, HTML separation checks for **22** pages, repeatable
frontend build, and the production build for **21** bundled pages. An obsolete
loading test initially expected inline critical CSS; it was updated to verify the
current external render-blocking stylesheet before the first visible frame and
then passed. No site styling was changed for that test.

SQL grammar checks passed for **9** files and **72** function definitions. Deferred
database scenarios were parsed, not executed. These counts are local validation
only and do not establish real Supabase integration, runtime SQL correctness or
production migration compatibility.

| Area | Verified now | Still unverified |
| --- | --- | --- |
| SQL setup | SQL/PLpgSQL grammar and source invariants | Actual execution, RLS/grants, idempotence, production compatibility |
| Staff support deletion | Policy/grant source checks and UI permission source | Actual staff/admin DELETE attempts against a database |
| Customer isolation | RLS/RPC ownership paths inspected; deferred regressions added | Hosted cross-customer queries |
| Payment/stock | Source invariants and deferred failed/repeated/late payment tests | Database concurrency, provider signatures and real settlement |
| Data preservation | No trigger child DELETE/reinsert; insert conflicts preserve rows | Staging tests against real custom schemas/data |
| Shipping | Private server-only scaffold; no fabricated tracking | Any carrier integration |
| Frontend | Local browser/unit suites; no SQL calls | Hosted end-to-end backend |

`supabase/tests/final-security-regressions.sql` contains **unexecuted** disposable-
database cases for staff DELETE/UPDATE and privilege escalation, admin DELETE,
anonymous submission, customer SELECT/UPDATE/order isolation, browser settlement
denial, independent image/bundle/order-line metadata, invalid bundle lists,
failed payment restoration exactly once,
replayed events and late-settlement reconciliation. It requires an explicit test
environment flag and rolls back fixtures. It must never be run on production.

`node tools/supabase-final-correction.test.cjs` parses these scenarios and checks
source invariants only. Neither that nor a mocked SDK is a real Supabase test.
SQL execution suites remain skipped because execution is explicitly prohibited.
