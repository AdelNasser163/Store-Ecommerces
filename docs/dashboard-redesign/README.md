# AlMumez administration workspace

The dashboard follows the layout of `https://tidy-insight-studio.lovable.app/`, using the existing store identity. The reference's customers, reports and settings routes returned 404 during review; those pages were designed here to fit the same layout.

## Identity and source ownership

`admin/index.css` owns semantic light/dark tokens: primary `#0f354f`, secondary `#8bc34a`, light background `#f4f6f8`, dark background `#091e2c`, and separate success/warning/danger/info foreground/surface pairs. Arabic uses the existing Cairo/Tajawal fonts; English uses Plus Jakarta Sans and Bricolage Grotesque. SVG icons are inline and do not request a new icon library or font. `admin/tailwind.config.cjs` maps the same tokens for optional future tooling; the current static site does not require a Tailwind build.

`js/admin/app.js` owns the shell, navigation, account, search, dialogs and notifications. `js/admin/core.js` owns aggregation, date ranges, exports and small SVG helpers. `js/admin/data.js` and `auth.js` isolate storage and account behavior. Each file in `js/admin/pages/` is a separate ES module, compiled to a hashed asset and loaded only when its page is opened. There are no chart, date-picker, animation or dashboard framework dependencies.

Run `npm run build:performance` after source changes. HTML and hashed `dist` assets are generated deployment output; do not edit them directly. Existing administration URLs are preserved, including `admin-product.html?id=...`.

## Pages and working controls

| Page | Purpose and controls |
| --- | --- |
| `admin.html` | Real order totals, previous-period comparison, period/custom dates, sales/order chart, inspectable points, series toggles, payment distribution links, recent order details, best sellers, quick stock edit, persistent section customization. |
| `admin-orders.html` | Search, status/payment/date filters, date/customer/total sorting, pagination, selection and bulk status changes, filtered CSV, detail dialog, customer links, line items, stored shipping/discount/tax breakdown, timeline, notes, cancellation confirmation and print/save-as-PDF. Cancellation does not automatically restock a product. |
| `admin-products.html` | Grid/table, search/category/stock/published filters, pagination, inline base price and stock, product preview, create/edit drawer, bilingual descriptions, SKU uniqueness, offer price, preserved variants, specs, multi-image upload/drop and WebP compression, publish/draft, duplicate, delete confirmation and Undo, JSON merge import/export. |
| `admin-bundles.html` | Active/paused filtering, create/edit 2–8-product bundles, product search, original/discount calculation, start/end dates, enable toggle, sales calculated from order bundle IDs, delete and Undo. Scheduled/draft/unavailable products are excluded from storefront bundle suggestions. |
| `admin-contact.html` | Shared contact inbox, query/topic/unread/replied/star/archive filters, read/unread, star, archive, deletion and Undo, related order links, email reply draft via `mailto:`, mark replied, mobile list/detail navigation. Mail opens the user's mail client and is not sent automatically. |
| `admin-customers.html` | Derived from actual orders: customers, contact links, city, order count, purchases, last order, order drilldown and CSV. |
| `admin-reports.html` | Period/custom dates, grouping by product/category/city, actual sales/quantity, report CSV, city/category/product bars, weekday activity and order-fulfillment funnel. It does not invent website-visit conversion data. |
| `admin-settings.html` | Profile, store information, monthly sales target, shipping fees, payment-method availability, password update, backup, explicit demo seeding/removal, sound preference. Cloud accounts/roles remain deferred. |
| `admin-login.html` | Local account setup, email/password validation, confirmation, remember-me, saved recovery code, password reset, sign-out and return to the requested admin page. In cloud mode the prepared adapter uses Supabase Auth. |
| `admin-404.html` | Clear missing-page state and return to overview. |

The fixed sidebar collapses on desktop and becomes a focus-managed drawer on mobile. Contact messages and sign-out remain at its foot. Search (`Ctrl/Cmd+K`) searches pages, orders, products and customers. Notifications derive from new orders, unread messages and low stock; their links point to the corresponding filtered/detail view. Light/dark, language, collapsed state and overview layout preferences persist. The small footer uses the current year and configured version.

## Local mode — current delivery

As requested, Supabase is **not enabled**. `admin-config.js` remains `mode: 'local'`, and there are no cloud credentials or active cloud network calls. Data uses the existing products, orders, bundles and support-message storage keys. Existing records are preserved. Demo orders/messages are added only by the explicit Settings action, are marked `demo`, and can be removed without deleting real records.

Open `admin.html`. A signed-out browser redirects to `admin-login.html`. On first setup, create the local administrator and save the displayed recovery code. No new hard-coded default password is introduced. Passwords and recovery codes are PBKDF2 hashes with a random salt. This is a **same-browser development account**, not server authorization; browser data and local sessions are inherently user-controlled. A remembered local session lasts seven days.

Changes to products and inventory propagate to an open catalog tab through existing storage/events. Draft products are excluded from catalog listings and direct product pages show an unavailable state. The contact form and inbox share the same local message store. Shipping and enabled payment methods are read by checkout, retaining the original defaults when no setting exists. Enabling a payment method changes the options; it does not connect a payment gateway or verify payment.

## Deferred cloud connection

The user explicitly deferred this step. `db/admin-schema.sql`, `db/admin-seed.sql`, `js/store-cloud.js` and the inactive adapter are prepared, but no remote deployment, account provisioning, email delivery or WebSocket transport has been verified against a live Supabase project.

When requested later: run the schema in Supabase, create an Auth user, assign the first admin UUID manually in `user_roles`, configure Auth redirect/email settings, then supply only the Project URL and Publishable key in `admin-config.js`, select cloud mode and rebuild. Never place a service-role or secret key in website files. The build includes the storefront cloud bridge only in cloud mode. Import the real product backup before enabling a live catalog; seed files are optional test data. The schema has server-side order pricing/stock reservation, separate roles and RLS, private order/message access, public published catalog access, image upload policies and Realtime publication setup. Tests use local PostgreSQL/WASM with Supabase auth/storage fixtures; they do not prove hosted setup or delivery.

## Verification and limits

See the adjacent JSON reports and screenshots. Test runners cover aggregation, previous periods, date ranges, SQL policies and pricing, browser workflows, responsive layouts, light/dark accessibility, and the shared-store integration. The responsive matrix is 360/390/768/1024/1440 pixels in Arabic/English. Public-store CSS comparisons exclude deliberately redesigned administration pages. External services such as a real mail client, a payment gateway and Supabase remain outside the local tests.

Lighthouse reports are local measurements, not an asserted production score. The supplied production score of 99 cannot be guaranteed from local tests. Keep the before/after report values and environment together; report variance honestly instead of substituting the requested target. Admin routes carry `noindex,nofollow`; no storefront color, header, hero or card redesign is included here.

Useful checks:

```text
npm run build:performance
node tools/admin-logic.test.cjs
node tools/admin-workspace-verify.cjs
node tools/admin-actions-verify.cjs
node tools/admin-login-verify.cjs
node tools/admin-store-integration.cjs
node tools/admin-accessibility.cjs
node tools/admin-schema.test.cjs
node tools/perf-css-regression.cjs --storefront-only
node tools/perf-verify.cjs
node tools/admin-redesign-audit.cjs --before
node tools/admin-redesign-audit.cjs
```

Final local paired Lighthouse sample: performance **52 → 51**, accessibility **100 → 100**, best practices **100 → 100**, SEO **100 → 100**, CLS **0 → 0**. LCP was 3,795 → 4,438 ms and TBT 7,377 → 2,108 ms. Repeated samples had large unattributed long-task variance, so these timings do not establish a production improvement or regression. Public homepage CSS is byte-identical to the previous build; the new dashboard styles/modules are not dependencies of storefront pages. Raw reports and `performance-summary.json` are preserved for review.

PGlite and axe are development-only tools resolved from the npm cache; neither is a deployed dependency. Reference screenshots are evidence only, not website assets.
