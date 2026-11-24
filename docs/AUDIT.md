# Phase 0 audit — AlMumez backend integration

Before runtime source edits, 231 HTML/CSS/JS/SQL files were read and hashed in
`backend-audit/source-inventory.json`; 73 contain browser storage references.
Generated/vendor files were inventoried as well as first-party sources. This is
an inventory plus focused call-path review, not a claim that every generated line
has been independently security-certified.

The separately named pasted baseline `نص ملصق(5).txt` was not supplied with this
request or found immediately beside the repository. The actual repository's
`supabase/setup.sql`, preflight and migrations 001–007 are the auditable baseline.
Do not assume an unseen text file is byte-identical.

## Frontend → backend contracts and mismatches

| Feature/source | Current backend contract | Mismatch/gap before this phase |
| --- | --- | --- |
| Contact form / support-api.js | support_messages: name,email,subject,order_number,product_name,message,consent | Local demo selected by enabled:false; cloud uses official shared client. Legacy messages compatibility view has no anonymous INSERT grant. |
| Inbox / admin-contact.html | support_messages via messages view; message_replies(message_id,sender_id,body,client_id) | Shared user_roles authorization present; staff delete restricted in 007. Permanent delete undo restores parent only, not replies. |
| Store checkout / main.js | submit_store_order(p_order); orders.payload; order_items | requestId stored only in JSON; no dedicated unique request/fingerprint. Retry under another generated order ID can deduct again. |
| Inventory | products.payload.stock/variants; order_stock_reservations; inventory_transactions | New reservations exist; historical reservations deliberately not inferred. Need actual runtime lifecycle tests. |
| Products / dashboard | products(id,published,payload), categories(id,name), product_images; product-images Storage | Preserve-child guards block deletion; UI error needs archive guidance. No category page; category IDs derived from product writes. |
| Catalog/products page | StoreProducts.read() / AlMumezProductsData.getProducts | Cloud bridge fetches all products/bundles/settings and writes local cache; product filters currently query browser data. |
| Homepage collections/hero | StoreProducts.read(), StoreBundles.read() | Local catalog seeded from data/products.js; cloud errors currently fall back silently to local cached data. |
| Admin authentication | official Auth getUser, user_roles, profiles | Shared SDK present; separate local admin PBKDF2/session mode remains. Recovery flag accepts URL query without recovery event. |
| Customer authentication | official Auth in enabled cloud mode | Demo login/Google/reset remain in disabled local mode. No account history screen. |
| Orders dashboard | admin_page('orders'), admin_set_order_status, admin_customer_detail | Server pagination exists; summary KPI and payment options still use current cached page in some places. |
| Customers | customers + customer_summary + admin_customer_detail | Customer ownership guarded; historical null customer links not backfilled. Directory KPIs/export are current-page-only. |
| Bundles | bundles.payload.productIds; bundle_items.quantity | Dashboard loads bundles but not their products; editor uses empty/current cached product set; metrics use cached orders. |
| Reports | admin_report/admin_overview/admin_analytics | Aggregates exist; shell goal and notifications still calculate from paged caches. |
| Settings | settings(key,value), profiles, user_roles | UI offers old db/admin-schema.sql/server seed; cloud seed and clear-demo still accessible; payment checkboxes not locked to backend-disabled Card/ValU. |
| Notifications | notifications(id,payload), admin_summary | UI synthesizes from current-page orders/messages/products rather than bounded server feed. Read state is browser-local. |
| Payments | payment_transactions, provider_events, apply_verified_payment | Service-only settlement exists; no provider adapter/signature endpoint. Card/ValU must stay disabled. |
| Shipping | settings.shipping fees; shipments; shipment_requests | Fees configured; carrier API is unconfigured; server adapter absent. |
| Realtime | official SDK postgres_changes on managed tables | Publication configured; cross-device runtime not yet verified. No actual project migration performed. |

## Local/demo paths requiring explicit separation

- `supabase-config.js enabled:false` currently selects local mode everywhere.
- `data/products.js`, `data/store.js`, `data/bundles.js`: seeded browser catalog,
  IndexedDB images and localStorage writes; useful only as explicit local demo or
  migration source, not authority in cloud mode.
- `auth.js`: local fake login/register/Google/reset when cloud is disabled.
- `js/admin/auth.js`: local admin setup/session/recovery when cloud is disabled.
- `js/support-api.js`: same-browser demo inbox when disabled.
- `js/admin/data.js seed`, settings demo buttons, `db/admin-seed.sql`: explicit test
  data paths; must be blocked/hidden in cloud mode, not auto-imported.
- `main.js` local order placement/stock mutation when cloud is disabled; cart and
  wishlist browser persistence is legitimate UX state, not backend authorization.
- `js/admin/app.js` notification-read, preferences, language/theme/sound: browser
  preferences are acceptable; business totals and operational records need server
  queries rather than browser caches.

## Environment and verification boundary

Docker and Supabase CLI are not installed. A cached PGlite disposable PostgreSQL
engine is available; it can execute transaction/RLS tests with local auth/storage
fixtures. Such tests are **not real Supabase Auth/Storage/Realtime integration** and
cannot prove parallel PostgreSQL connection behavior. Production SQL is prohibited.
Hosted activation, provider credentials and carrier APIs remain manual gates.

## Outcomes after implementation

The initial map above is preserved as the before-edit audit. The final source now
adds migrations 008–010, a dedicated checkout request/fingerprint, bounded server
catalog/facets and operational queries, verified role checks, explicit guest-only
backfill, category management, own account/support history, variant editing,
server-sourced dashboard totals/search/notifications, cloud seed blocking, and
fail-closed provider interfaces. Disconnected customer AuthAPI no longer invents
successful identities or reset tokens. See `TEST_REPORT.md` for observed results
and remaining hosted/provider/concurrency limitations. The local admin demo is
still explicitly local; it is never a substitute for cloud authorization.
