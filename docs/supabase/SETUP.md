# Supabase integration — deployment checkpoint

**Historical checkpoint. Current instructions:** [DEPLOYMENT.md](../DEPLOYMENT.md)
and [TEST_REPORT.md](../TEST_REPORT.md) supersede this document. The current setup
contains ten migrations; disposable local SQL testing has now been performed.
Production SQL and hosted Supabase integration have not been performed.

**Earlier correction:** [FINAL-SQL-CORRECTIONS.md](FINAL-SQL-CORRECTIONS.md)
supersedes this checkpoint and earlier production review. Setup now includes seven
migrations. No SQL execution or hosted database verification was performed.

**Superseded by [PRODUCTION-REVIEW.md](PRODUCTION-REVIEW.md).** Do not follow the
older execution instructions below before staging review. The reviewed setup now
contains six migrations plus compatibility preflight, in one transaction. Its SQL
has been parsed but not executed, as explicitly requested. Earlier database test
results do not validate the current revision.

The public Project URL and publishable key are configured in `supabase-config.js`.
`enabled` remains `false`: the hosted project currently has Auth available but
`products` and `user_roles` returned PGRST205 (missing tables). Do not enable the
integration or publish cloud mode before the setup and authorization checks below.

## Database setup

1. In the existing project's Supabase SQL Editor, run `supabase/setup.sql`.
   This file combines the five ordered migrations. It does not insert demo products
   or orders. Do not run `db/admin-seed.sql` against a production project.
2. Create/invite the first administrator under Authentication → Users. Copy that
   user's UUID and run this SQL with the actual UUID:

   ```sql
   insert into public.user_roles(user_id,role)
   values ('REPLACE_WITH_AUTH_USER_UUID'::uuid,'admin')
   on conflict(user_id) do update set role=excluded.role;
   ```

3. Set Auth's Site URL to the GitHub Pages project URL and allow the exact
   `auth.html`, `reset-password.html`, and `admin-login.html` callback URLs.
   Add localhost callback URLs only for your development environment.
4. Complete the pending integration work listed below and test using separate
   administrator, staff and customer accounts before switching `enabled` to `true`.
5. Run `npm run build:performance` after changing configuration. Runtime bundles
   are hashed; editing configuration alone does not update a deployed bundle.

No secret, service-role key, or database password belongs in browser files.
The first-admin role assignment must be performed from the SQL Editor, never
from an anonymous registration form.

## Verified locally

- All five migrations execute twice without error in PostgreSQL via PGlite.
- Server pagination, summaries, reports and overview RPCs execute with fixture data.
- A customer cannot directly read orders or invoke administrator pagination.
- The protected customer-orders function returns only the authorized customer's data.
- Existing local administrator setup, remember-session, recovery and sign-out pass.
- Existing dashboard browser suite passes 80 responsive/workflow cases.
- The official Supabase v2 browser client bundles successfully.

Database fixtures run only inside the local test database. None of these checks
proves that hosted migrations, hosted authentication, realtime or Storage work.

## Implementation status

| Area | Status | Remaining work |
| --- | --- | --- |
| Central client/configuration | IMPLEMENTED BUT NOT TESTED | Hosted login/session/recovery verification |
| Migrations and aggregate RPCs | COMPLETED AND TESTED locally | Apply to existing hosted project |
| Existing local-mode compatibility | COMPLETED AND TESTED | Repeat after subsequent changes |
| Administrator SDK authentication | IMPLEMENTED BUT NOT TESTED | Hosted users/roles and callback setup |
| Customer SDK authentication | IMPLEMENTED BUT NOT TESTED | Hosted signup, confirmation, recovery and OAuth configuration |
| Orders/products server pagination | IMPLEMENTED BUT NOT TESTED | Hosted CRUD and authorization tests |
| Overview/reports server aggregates | IMPLEMENTED BUT NOT TESTED | Browser tests using hosted results |
| Customer editing/history | IMPLEMENTED BUT NOT TESTED | Hosted verification of directory pagination and editing |
| Message replies | IMPLEMENTED BUT NOT TESTED | Hosted thread/send verification; outbound email is not configured |
| Realtime | IMPLEMENTED BUT NOT TESTED | Cross-device verification and connection-error UI |
| Image Storage | IMPLEMENTED BUT NOT TESTED | Hosted upload/delete and image replacement lifecycle |
| Bundles | NOT IMPLEMENTED completely | Paginated selection, related-product queries and server metrics |
| Storefront catalogue/checkout bridge | NOT IMPLEMENTED completely | Replace legacy full-catalog REST refresh with scoped queries |
| Payment/shipping Edge Functions | NOT IMPLEMENTED | Provider decision, server adapters and webhook verification |
| Data migration/import | REQUIRES MANUAL CONFIGURATION | Deliberate import of existing real local catalogue/data |
| Hosted end-to-end tests | REQUIRES MANUAL CONFIGURATION | Tables, administrator and callback URLs first |

The integration is a work in progress. Do not treat this checkpoint as a completed
production backend or enable cloud mode merely because a public key is present.

## Checks

```text
node tools/supabase-migrations.test.cjs
node tools/admin-logic.test.cjs
npm run build:performance
node tools/admin-login-verify.cjs
node tools/admin-workspace-verify.cjs
```

Rollback before activation: keep `enabled:false` and rebuild. Existing local
data remains intact. Do not drop hosted tables to roll back a frontend release.
