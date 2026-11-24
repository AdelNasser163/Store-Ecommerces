# Backend implementation and verification — 2026-11-23

## Latest deployment correction (migration 011)

Real disposable **PostgreSQL 16.11: 145 checks passed**, recorded in
`backend-audit/postgres16-results.json`. New `tests/postgres16/tests.py` and
`stub.sql` were created at the user's request because the referenced original
files did not exist. No claim is made about running the absent 113-test suite.
The gate applies the complete setup twice, individual migrations twice, checks
schema/grants/publications, executes six SQL scenario files, and exercises two
independent concurrent connections: one order and one stock deduction.

Migration 011 refreshes the messages projection after customer_id exists,
restricts anonymous view INSERT to the seven permitted columns, archives full
message/reply data before admin deletion and restores only through an admin RPC.
The dead demo-order delete policy is removed without weakening preservation
guards. New pgcrypto installation targets extensions; existing installations are
not moved. Initial missing runtime files and Windows pg_ctl pipe timeout were
fixed before the successful run. All local test clusters were stopped.

Build: 23 bundled pages; HTML separation: 24 pages passed; grammar/source checks:
13 files / 102 function definitions passed. Hosted Auth/Storage/Realtime, live COD
purchase and publication remain unexecuted. Supabase browser mode stays disabled.
The older limitations table below is historical for the preceding revision;
its independent-connection limitation is superseded by this PostgreSQL 16 run.

**No production SQL, hosted Supabase connection, provider charge or carrier API
call was performed.** The browser backend flag is restored to `enabled:false`.
The final production definition of done is blocked by staging/hosted validation
and actual provider configuration. This report separates executed evidence from
implementation and unexecuted integration tests.

## Executed tests

| Check | Environment | Result |
| --- | --- | --- |
| Complete setup, applied twice | Disposable in-memory PostgreSQL via PGlite; Auth/Storage schemas are fixtures; publication statements excluded | PASS |
| Anonymous contact INSERT via table and compatibility view; private SELECT denial | Disposable PostgreSQL with actual GRANT/RLS enforcement | PASS |
| Staff read/update, DELETE denial on table/view, admin DELETE, staff role-escalation denial | Disposable PostgreSQL | PASS |
| Customer A/B record/order isolation, own support history, browser settlement denial | Disposable PostgreSQL | PASS |
| Idempotency replay with different generated ID, request conflict, reused order ID | Disposable PostgreSQL | PASS |
| Products/variants/bundle component quantities, insufficient stock rollback, cancel twice, shipping/complete guards | Disposable PostgreSQL | PASS |
| Failed/replayed/late payment events, restoration once and late-payment reconciliation | Disposable PostgreSQL; provider association is test-only | PASS |
| Independent image/component/order-line metadata preserved; invalid bundle lists rejected | Disposable PostgreSQL | PASS |
| Request-ID/SKU conflicts in preexisting fixtures stop preflight and preserve both rows | Separate disposable PostgreSQL databases | PASS |
| Explicit historical guest grouping skips owned customers, never assigns an Auth owner, preserves contact data | Disposable PostgreSQL | PASS |
| Catalog filtering/sorting/facets/pages; category, summary/report/overview/notification RPC execution | Disposable PostgreSQL | PASS |
| Unverified administrator role assignment rejected | Disposable PostgreSQL trigger | PASS |
| Official SDK cloud behavior: catalog/search, accepted contact request, invalid/valid login, protected routes, expired-user rejection, dashboard modules, image upload, own account, uncertain checkout retry and service failure without demo fallback | Chromium + official SDK + intercepted HTTP to `.invalid`; NOT hosted integration | PASS |
| Server payment/carrier boundary | Mocked adapter unit tests: unconfigured=503, invalid signatures/events rejected, settlement rejection propagated, no fabricated tracking | PASS |
| Query/recent-search/filter injection; missing category | Chromium against local static site | PASS |
| Disconnected customer login/register/Google/reset | VM executes actual auth.js fallback methods | PASS: rejects with BACKEND_NOT_CONFIGURED, no fabricated session/reset token |
| Existing cart/wishlist, headers/footers, AR/EN, mobile, reduced motion, dashboard local workflows and accessibility suites | Local Chromium; local mode/role fixtures where stated | See final suite summary below |
| SQL/PLpgSQL syntax and source invariants | PostgreSQL grammar parser; no SQL execution in this check | PASS |

`npm run test:backend` is reproducible using the development-only pinned PGlite
dependency. It never reads Supabase production configuration. Its authenticated
roles and JWT helper are local fixtures, not GoTrue tokens. Source-owned temporary
fixtures roll back; no production records are imported or modified.

`npm run test:cloud-mock` temporarily builds a fixture configuration pointing only
to `https://almumez-fixture.supabase.invalid`, intercepts every request and restores
the original configuration/build in `finally`. It is intentionally run sequentially
with other browser suites because it rebuilds shared assets.

## Failures encountered and corrected

- Initial aggregate-query parentheses failed SQL compilation; corrected and the
  complete local setup/scenarios passed afterward.
- Initial search security test tried the hidden mobile navbar search; corrected
  the test viewport to exercise the actual visible control. Injection and unknown
  category handling then passed without changing the responsive navbar.
- Initial cloud login test expected the dashboard homepage instead of the requested
  protected return page; corrected its expectation and verified return routing.
- One intermediate test run overlapped an external fixture rebuild with local UI
  tests: wishlist/accessibility timed out (29/31). The fixture config was restored;
  the complete final run is sequential. That intermediate run is not counted as a
  passing result and does not prove a production failure.

## NOT EXECUTED / blocked

| Test | Reason |
| --- | --- |
| Real Supabase Auth signup/confirmation/reset/OAuth/session refresh and role revocation | No approved disposable Supabase service/credentials; Docker/CLI unavailable |
| Real Supabase Storage HTTP/RLS and public bucket settings | Local fixture schema and mocked upload are not the actual Storage service |
| Two-device Realtime publication and reconnect/event delivery | Local embedded PostgreSQL lacks the Supabase Realtime service; publication DDL excluded from the local runner |
| Truly concurrent checkout using independent PostgreSQL connections | PGlite serializes access; queued requests are not independent connections. No disposable standalone PostgreSQL/Docker available |
| Payment provider signature cryptography, merchant API, real settlement/refund and reservation expiry | Provider not selected/configured; endpoints return 503 |
| Carrier shipment creation, tracking and signed callbacks | No configured carrier/API credentials; endpoint returns 503 |
| Deno Edge Functions runtime/deployment | Deno/Supabase CLI unavailable; pure shared adapter unit tests only |
| Production migration/custom-schema compatibility, backup restoration, real performance under hosted load | Production access prohibited; requires an approved staging copy |

The previous `admin-schema.test.cjs` and `supabase-migrations.test.cjs` represent
earlier schema assumptions and are superseded by `backend-database.test.cjs` for
this complete setup. They are not silently counted as passed. Old historical test
JSON under `docs/supabase/` does not validate the new revision.

## Fix-by-fix report

| Problem | Root cause | File modified | Correction | Test performed | Result | Remaining limitation |
| --- | --- | --- | --- | --- | --- | --- |
| Backend map unclear | Multiple legacy/local contracts | AUDIT.md, source-inventory.json | Read/hash every source and map features | Source inventory | Recorded | Separate named baseline text not supplied |
| Split inbox/table/view contract | Legacy support names | migration 008; support-api.js | One table; invoker compatibility view with column INSERT only | Local anon table/view tests | PASS | Hosted API NOT EXECUTED |
| Staff could delete messages | Permissive ALL policy | migration 007; messages.js | Explicit SELECT/UPDATE/admin DELETE; hidden staff control | Local RLS + mocked UI roles | PASS | Hosted JWTs NOT EXECUTED |
| Inbox undo could lose reply history | Only parent restored | messages.js | No misleading cloud undo for permanent deletion | Source/local inbox | PASS locally | No full deleted-thread restoration feature |
| Replay tied to generated order ID | Request ID only in JSON | migrations 001/008; store-cloud.js | Dedicated unique request ID + SHA256 canonical fingerprint and request lock | Local replay/conflict tests; uncertain-response browser fixture | PASS | True parallel connections NOT EXECUTED |
| Unique adoption could mask conflicts | Existing legacy identifiers | preflight builder, migration 008 | Duplicate prechecks; verify request index definition; abort without merge | Conflicting legacy fixtures | PASS | Real production metadata unknown |
| Variant/bundle stock errors | Per-component quantity/state | checkout SQL, reservations/guards | Authoritative deduction, reserve/release once, terminal guards | Local lifecycle scenarios | PASS | Concurrency NOT EXECUTED |
| Guest checkout could attach to owned customer | Contact-key match alone | order_customer_sync | Verified owner check; otherwise no Auth linkage | Local isolation/backfill | PASS | Guest has no signed-in history until verified/link reviewed |
| Historical contact grouping absent | No safe explicit process | migration 010 | Bounded admin-only cursor action, never assigns Auth ownership | Local guest-backfill scenario | PASS | Manual action; not run on real data |
| New support account lacked history | No customer record yet | migration 010; account.js | Verified email association and own-history RPC | Local SQL + mocked account page | PASS locally | Real signup/confirmation NOT EXECUTED |
| Admin role on unverified account | Role table trusted without verification | role helpers and verified-role trigger | Confirmed Auth account required server-side | Local role test | PASS | Existing unverified role rows retained but unauthorized |
| Catalog loaded everything/cached demo on failure | Legacy full-table REST bridge | store-cloud.js; catalog_page/site_bootstrap | Shared SDK; bounded server queries; in-memory only; fail closed | Local SQL + cloud browser fixture | PASS locally | Hosted network NOT EXECUTED |
| Product view could use stale demo fallback | local selected/catalog records | main.js | Cloud view requires authoritative requested product | Source/cloud error fixture | PASS locally | Missing product displays unavailable |
| Search could inject markup | Raw query/recent-history HTML | products-page.js | Escape attributes/chips, DOM text for suggestions | Browser malicious query/history | PASS | Full unrelated application security scan not claimed |
| Stale catalog response overwrote newer filter | Async race | products-page.js | Request generation guard | Source/cloud query fixture | Implemented | Multiple delayed-response stress test NOT EXECUTED |
| Bundle editor had no products in cloud | Page cache only | data.js, cloud-operations.js, bundles.js | Batch related IDs; server product search; page controls | Cloud browser + local bundle SQL | PASS locally | Very large explicit export can be expensive |
| Catalog create/edit incomplete | No variant UI/server guard | products.js; migration 010 | Variant editor, SKU uniqueness, price/stock/variant validation | Existing product actions; local SQL | Partially tested | Cloud variant-edit end-to-end NOT EXECUTED |
| Upload replacement hid earlier gallery | Replacement array | products.js | Preserve older image URLs while adding uploaded gallery | Source + local image upload | Implemented | Asset deletion/retention cleanup intentionally not automated |
| Category management missing | Only derived IDs | admin-categories.html, categories.js, migration 010 | Shared-shell bilingual CRUD, bounded query and referenced-delete guard | Cloud mock + SQL category queries | PASS locally | Hosted mutation NOT EXECUTED |
| Operational totals reflected current page | Browser aggregation of caches | operational summary, app/orders/customers/bundles | Server aggregate totals and bounded notifications/search | Local RPC + cloud screens | PASS locally | Notification-read preference remains browser-local |
| Exports/backup missed later pages | Cached page-only exports | cloud-operations/products/customers/settings | Explicit export paginates server records | Existing export tests + source | Partially tested | Dashboard JSON is not a full DB/Storage/Auth backup |
| Cloud demo tools unsafe | Seed/cleanup available | data.js/settings.js | Hidden/blocked seed/cleanup in cloud | Source + local compatibility | Implemented | Local mode deliberately remains demo |
| Payment checkbox implied integration | UI-only availability flags | settings.js/storefront-settings + guard SQL | COD only; Card/ValU disabled and server refused | Local SQL + cloud settings | PASS locally | Actual online providers absent |
| No clean provider boundary | Settlement SQL without HTTP adapter | functions/_shared, payment-webhook, create-payment | Fail-closed adapter interface; service-only settlement after verification | Mock adapter unit tests | PASS mocked | No provider implementation or deployed webhook |
| Shipping fees mistaken for carrier | Shared conceptual configuration | shipment_requests/create-shipment/adapter contract | Unconfigured until actual API response; no fake tracking | Source + adapter unit | PASS mocked | Carrier credentials/API absent |
| No customer profile/history view | Auth page only | account.html/customer-account.js | Own profile/orders/support/replies with server ownership | Local SQL + official-SDK browser mock | PASS locally | Real customer JWT/service NOT EXECUTED |
| Customer auth invented success offline | Legacy fake AuthAPI | auth.js | Reject disconnected operations instead of fabricating identities/reset links | customer-auth-boundary.test.cjs | PASS | Real Auth service remains a manual gate |
| Account forms remained Arabic in English mode | No shared account translation | auth-language.js and page manifest | External shared static/dynamic form copy | Dedicated browser language check | See final results | Real email/reset flow NOT EXECUTED |
| Unsafe deployment guidance | Old schema/seed/config references | settings + deployment/admin/rollback docs | Complete setup source, verified admin steps, staging/rollback gates | Source/docs checks | Written | Operator must perform approved deployment |

## Final suite summary

The complete sequential `npm run test:integration-local` run completed with
**32/32 checks passing**. The machine-readable result is copied to
`backend-audit/test-results.json`; its rows identify the individual checks and
their actual output. After that run, the additional
`node tools/auth-language-verify.cjs` check passed all **12** Arabic/English,
mobile/desktop account-form cases, including dynamic English validation and
overflow checks. This additional check is not included in the 32/32 count.

`node tools/perf-css-regression.cjs --storefront-only` also passed **33**
page/viewport comparisons at 390, 820 and 1440 pixels against the saved CSS
baseline, with zero computed-style/layout differences for the compared DOM.
This is a CSS regression check, not a claim that backend integration or every
possible dynamic state is visually identical. `git diff --check` passed; Git
reported line-ending conversion warnings only.

The isolated database runner applied the complete setup twice and executed five
SQL scenario files, plus two incompatible-existing-data fixtures. These are real
local PostgreSQL executions with fixture roles, not real Supabase service tests.

Real hosted integration, independent-connection concurrency and provider tests
remain **NOT EXECUTED**, regardless of how many local tests pass. No production
connection, SQL execution, business-data import or deployment was performed.
