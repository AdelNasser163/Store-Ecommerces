# Navigation and card consistency

- One final stylesheet, `site-navigation.css`, now controls the navigation across all ten storefront pages. It standardizes the opaque navy pill, logo, link order, search, icons, wishlist badge and cart. `js/site-navigation.js` preserves existing bound nodes and page-owned interactions, and normalizes the displayed cart count/total. The legacy wrapper class no longer introduces a second layout during loading.
- The catalog now uses the same `hb-card--navy` renderer and styles as the homepage. Default desktop cards match the homepage width (approximately 293px at 1440px) and height for the same product. Tablet/mobile layouts remain three/two columns. Existing alternative density controls still work.
- Filters use their existing drawer on desktop as well, leaving enough room for four full-sized cards. The catalog's claimed-progress slot and extra express label are visually hidden to match the homepage, rather than adding a second card height; product data is retained.
- Internal page navigation no longer replays the hero/card entrance reveals. Navigation now uses ordinary immediate links, without a curtain, delayed redirect or cross-document crossfade. Pages still load as separate static documents; no SPA router or page-script swapping was introduced.
- Shared asset URLs now use the same cache versions, avoiding duplicate fetches caused by different query versions between pages.

No edits to `main.js`, `catalog.js`, data, compiled `style.css`, checkout logic or admin pages. Existing unrelated workspace changes are excluded from this commit.

## Validation

Chromium/Playwright static-server checks passed for ten pages × English/Arabic × 1440/820/390px: 60 cases. Compared header dimensions, background, radius, logo and controls; checked no horizontal overflow or page JavaScript errors. Mobile menu/search opens on every page. Catalog cart, wishlist, cart drawer and filter drawer work. Compared the same Sony card between home/catalog; desktop dimensions and visual tokens match. Navigating home → catalog → home keeps content visible without replaying reveals. Google Fonts network requests were blocked during tests.

- [Results](results.json)
- Same card, desktop: [Home](home-card-en-1440.png) / [Catalog](catalog-card-en-1440.png)
- English mobile: [Home](home-en-390.png) / [Catalog](catalog-en-390.png)
- Arabic mobile: [Home](home-ar-390.png) / [Catalog](catalog-ar-390.png)
- Full viewport, desktop: [Home](home-en-1440.png) / [Catalog](catalog-en-1440.png)

The scope here is the storefront navigation and catalog cards. Dashboard navigation remains its existing administrative shell.

Cart color follow-up: explicitly set the icon, count and total to navy `#0b192e` so the legacy `.home-cart-icon { color: var(--brand-red) }` cannot vary with page tokens. The green button stays `#a5d66e` and becomes `#bef264` on hover. Checked computed colors on all ten storefront pages, English/Arabic, 1440/390px, both normal and hover states (40 page cases).

Navigation follow-up: removed the old GSAP curtain handler, including its 280ms animation and delayed location assignments. Disabled native cross-document transitions as well. A short-lived session marker supplements the referrer check, so internal entrances stay still even with `rel="noreferrer"`; reload/back navigation also skips entrance reveals. Verified home → catalog → product → home, reload and Back in English/Arabic at 1440/390px, normal motion enabled. Internal clicks remain unprevented, no curtain is created, and destination content stays visible. [Latest results](still-navigation-results.json).

## First-paint correction

Further measurement reproduced a separate problem: the initially empty About header gained 74px when JavaScript rendered it, pushing the whole page down. Font ligatures also occupied word-sized widths before the icon font arrived. These were layout shifts, independent of the removed page curtain.

- Reserve the final header height before its markup is injected (76/66/62px by breakpoint).
- Initialize saved language/direction in the head, before body content appears. Valid `lang` query parameters keep the existing priority.
- Mark the existing deferred navigation initializer `blocking="render"`, so supporting browsers paint its final layout once. No visibility mask, artificial timer, or extra navigation delay is added. Reserved geometry remains the fallback in other browsers.
- Reserve icon widths during font loading, including category, header and catalog toolbar controls.
- Disable hero/section entrance reveals on storefront pages for every load, including direct visits, rather than relying on referrer detection. Cart flight, hover feedback, smooth anchors and ambient hero effects remain.

Cold-page measurements with a 120ms delay per script request and Google Fonts blocked showed CLS dropping from approximately 0.085/0.26/0.86 on home/catalog/about to below 0.00002 on each page. These are local controlled measurements, not production field metrics. [Before traces](paint-before.json), [after traces](paint-after.json).

Additional normal-motion checks cover the three pages × English/Arabic × desktop/mobile (12 cases). Sampled heading positions after first paint remain constant; tested the mobile home → catalog → about → home sequence and cart drawer. [Results](paint-results.json).
