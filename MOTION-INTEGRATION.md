# Motion layer integration

Branch: `feat/motion-layer`. Existing work was checkpointed separately in `1d5dcf9`. No push was performed.

## Merge decisions

Compared all 31 source files before copying. Existing HTML was merged by inserting only the two motion stylesheets and five ordered scripts; all original script URLs/order, version parameters, shared header/footer, footer logo, product specifications, and current accessories markup were retained. README received only the motion section. package.json and .gitignore did not previously exist. All source files were included.

The home page also receives hero particles as the first child of the main hero column, stats between Express Delivery and Flash Deals, and a brands island with overflow-hidden replacing flex-wrap. Imports and home islands occur once each.

## Adaptations to supplied motion code

- js/fx.js: skip add-to-cart animation entirely under prefers-reduced-motion.
- js/fx.js: observe body style as well as class for scroll locks, and prevent Lenis handling within the current products drawers/filters. The current accessories page locks via body.style.overflow rather than drawer-open.
- src-islands/islands.css: set the LogoLoop direction to ltr inside the brands island; its list geometry otherwise produces a negative period in the Arabic RTL layout and the brands remain invisible/stationary. Rebuilt js/vendor/rb-islands.css (and JS bundle) with npm run build:fx.

## Validation

- Playwright Chromium opened all seven storefront pages plus admin.html before and after integration: zero JavaScript console/page errors (blocked Google Fonts excluded).
- Home: window.__lenis exists; four stats cards; brands move; a complete scroll leaves no rendered data-fx element at opacity zero.
- Add-to-cart persists items; cart drawer opens; Lenis stops/resumes. A real mouse wheel scrolls inside a populated cart without scrolling the page.
- Arabic/English switches work in both directions. Accessories add-to-cart and its drawer locks work.
- Reduced motion: all seven storefront pages load without JavaScript page errors or Lenis/reveals; home has no particles or add-to-cart flight, brands stay stationary, and stats remain readable.
- Admin login succeeds before and after integration with no JavaScript page errors and no Lenis.
- Original script order and all 19 tracked protected files were verified unchanged against checkpoint (normalizing Git CRLF/LF).
- npm run build:fx passes.

## Environment and existing files

Python/python3 resolve to the Windows Store alias and Python is not installed. Tests therefore served the static files with Node HTTP servers on loopback ports 8765/8766. No production server/dependency was added. Playwright came from the existing local npm cache.

products-page.css and js/products-page.js both exist in the current project and were included unchanged in the initial checkpoint. No replacements were invented. The admin files and protected store/cart/product logic were not edited by this integration.

The source folder ../almumez-changes was read only and was not removed.

## Complete file list

Modified (8):

- accessories.html
- auth.html
- checkout.html
- forgot-password.html
- index.html
- product.html
- README.md
- reset-password.html

Added from source (23):

- .gitignore
- fx.css
- js/fx.js
- js/vendor/gsap.min.js
- js/vendor/lenis.min.js
- js/vendor/rb-islands.css
- js/vendor/rb-islands.js
- js/vendor/ScrollTrigger.min.js
- package-lock.json
- package.json
- src-islands/build.mjs
- src-islands/index.jsx
- src-islands/islands.css
- src-islands/rb/ClickSpark.jsx
- src-islands/rb/CountUp.jsx
- src-islands/rb/LogoLoop.css
- src-islands/rb/LogoLoop.jsx
- src-islands/rb/Particles.css
- src-islands/rb/Particles.jsx
- src-islands/rb/ShinyText.css
- src-islands/rb/ShinyText.jsx
- src-islands/rb/SpotlightCard.css
- src-islands/rb/SpotlightCard.jsx

Additional documentation: MOTION-INTEGRATION.md (this report).

## Follow-up: stable navigation, cart updates and full footer

- Motion imports now also cover about.html, blog.html and contact.html. products.html remains the existing redirect to accessories.html; admin pages stay outside the motion layer.
- Removed the header hide/show animation; navigation stays sticky during scrolling.
- Accessories cart and wishlist actions update only the affected card actions and wishlist state, retaining the entire grid and filters so reveal animations do not replay on every addition.
- Restored the shared footer company/customer-care links, four social icons, footer logo, payment options and registration details. Existing placeholder destinations remain placeholders.
- Bumped motion/footer/products-script query versions to load the updated assets.

Follow-up validation: Playwright passed all ten storefront pages plus admin at 1440px and 390px, with zero JavaScript console/page errors (blocked Google Fonts excluded), sticky visible headers and complete footers. Add/increment/decrement/wishlist retained every product card and filter node with no reload or scroll jump. Legacy products redirect and reduced motion on the newly covered pages passed.
