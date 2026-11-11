# Opaque navigation and product detail theme

Restored the previous navigation layout and solid navy background (`#0f1e2f`), including its active underline, compact search and original action styling. Home and catalog cache references were updated. The next page completed is `product.html`; no subsequent page has been started.

## Product page

- Shared header/footer presentation, aligned containers, navy/green palette, rounded gallery and detail panels, pill controls, consistent specification and review surfaces.
- Existing gallery, zoom, color/storage choices, quantity, wishlist, purchase and bundle DOM hooks remain in place. `main.js`, `catalog.js`, `bundle-cart.js`, product data and checkout logic were not changed.
- Presentation hooks are isolated in `js/product-detail-theme.js`; styles are scoped to `.pd-page` in `product-detail.css`. Important declarations override the existing compiled Tailwind utilities without editing `style.css`.
- Breadcrumb links use the selected product category and brand. Help links point to contact; footer items without implemented destinations are text rather than fake links.
- Product-page cart flight now uses the displayed gallery image instead of accidentally selecting the site logo. Reveals keep the existing readable fallback.
- Existing bundle pricing, product descriptions and specifications are retained. Some existing auxiliary product copy remains English in Arabic mode; this task does not rewrite product data or its translation logic.

## Validation

Static server + Chromium/Playwright: English and Arabic at 1440, 1024, 820 and 390px. All eight functional cases passed with no JavaScript page errors and no horizontal overflow. Google Fonts requests were blocked during testing; local fonts remained available.

Verified gallery thumbnails and zoom/Escape, 512GB pricing from StoreProducts, quantity three, cart data, correct image flight, cart drawer, wishlist, review tab and language switch after rendering. Also checked Sony WF and MacBook pages, bundle addition, Buy Now navigation to checkout, and solid home/catalog navigation. Reduced-motion screenshots cover both languages at desktop, tablet and mobile widths. No invisible reveal elements remained after scrolling.

- [Machine-readable results](results.json)
- [Home navigation](home-nav.png) / [Catalog navigation](catalog-nav.png)
- Before: [English desktop](before/en-1440.png), [Arabic mobile](before/ar-390.png)
- After English: [1440](after/en-1440.png), [820](after/en-820.png), [390](after/en-390.png)
- After Arabic: [1440](after/ar-1440.png), [820](after/ar-820.png), [390](after/ar-390.png)

No push. Existing unrelated workspace edits are excluded from this change.
