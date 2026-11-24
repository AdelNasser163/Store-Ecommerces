# Release checklist

Local PostgreSQL 16.11 gate: 145 checks passed; evidence in
backend-audit/postgres16-results.json. This does not certify hosted services.
Statuses below refer to the requested LIVE MyStore acceptance, not mocks.

| Item | Status | Evidence / remaining gate |
| --- | --- | --- |
| Supabase connection (real read + write) | Requires my manual action | No production connection/write performed |
| Migrations | Passed and tested | Full setup twice + sorted individual migrations twice on disposable PostgreSQL 16.11; hosted apply still manual |
| Authentication | Requires my manual action | SDK mock tests exist; real Auth confirmation/session/logout pending |
| Admin access & roles | Passed and tested | Actual local PostgreSQL role/RLS scenarios; hosted JWT tests pending |
| Products | Implemented but not tested | Cloud RPC/UI mock tested, no hosted product query |
| Product images (Storage upload/public read) | Requires my manual action | Storage HTTP service not exercised |
| Cart | Passed and tested | Prior local storefront/cart browser suite; no hosted checkout claim |
| COD checkout | Implemented but not tested | Local SQL scenarios passed; live COD purchase pending |
| Order creation | Passed and tested | Local actual submit_store_order scenarios; no production order |
| Inventory deduction | Passed and tested | Local quantities/variants/bundles/restoration scenarios |
| Idempotency (duplicate requestId) | Passed and tested | Independent PostgreSQL connections: one order, one deduction |
| Order management | Passed and tested | Local lifecycle/status guards; live dashboard flow pending |
| Customers | Passed and tested | Local A/B isolation and ownership scenarios; real JWTs pending |
| Support messages | Passed and tested | Local anon insert/read denial, staff denial, admin archive/restore with replies |
| Reports | Implemented but not tested | Local aggregate SQL/mock screens pass; hosted totals unverified |
| Settings (Card/ValU cannot be enabled) | Passed and tested | Local server guard and checkout rejection; COD only |
| Realtime | Requires my manual action | Publication DDL tested locally; hosted two-device delivery unverified |
| Multi-device synchronization | Requires my manual action | MULTI_DEVICE_TEST.md not executed |
| GitHub Pages deployment (live URL verified) | Requires my manual action | No push/merge/new release verification performed |
| Auth URL configuration | Requires my manual action | Exact URLs below; Dashboard changes not performed |

Site URL: `https://adelnasser163.github.io/Store-Ecommerces/`

Allowed redirects:
- `https://adelnasser163.github.io/Store-Ecommerces/**`
- `https://adelnasser163.github.io/Store-Ecommerces/admin-login.html`
- `https://adelnasser163.github.io/Store-Ecommerces/auth.html`
- `https://adelnasser163.github.io/Store-Ecommerces/reset-password.html`
- `http://localhost:5500/**`
- `http://127.0.0.1:5500/**`

Keep browser cloud mode disabled until manual backup/schema/Auth gates pass.
