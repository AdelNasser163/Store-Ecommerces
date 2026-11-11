# Mobile-only navigation layout

At 767px and below, the header now has equal outside grid columns and a centered logo. The menu sits at the leading edge; wishlist and an icon-only cart sit at the opposite edge. The top-bar language and account controls are hidden, and cart price/count text stays in the DOM for the existing totals logic but is visually hidden.

The existing menu language/login controls remain. Dashboard is copied from the existing account dropdown only when that destination exists, with the same URL/attributes; it is visible only in the phone menu. Desktop account/menu controls and admin authentication are unchanged. Cart has an explicit localized accessible label. The menu icon now reflects its closed state after changing language.

The catalog wishlist drawer already had its handler, but its anchor also navigated away. The shared presentation hook now prevents that anchor's default navigation when the catalog drawer exists, allowing its existing drawer handler to finish. No cart, checkout, account, data or main.js logic was modified.

## Validation

- Nine storefront headers × English/Arabic × 390/1440px: 36 cases. Checked phone logo centering, hidden controls/cart copy, menu language/login/dashboard, same dashboard destination, desktop controls remaining visible and no horizontal overflow/errors.
- Additional 320/767/820px breakpoint checks.
- Home/catalog: language from the menu, localized Dashboard, cart updates with text still hidden, wishlist drawer, and closed menu icon.
- Cart drawer checked on pages that load the existing commerce controllers; password recovery pages were checked for header layout only.
- Standalone login remains without navigation/footer.

[Results](results.json) / [Functional checks](function-results.json)

- English: [closed](en-closed.png) / [menu open](en-open.png)
- Arabic: [closed](ar-closed.png) / [menu open](ar-open.png)

User changes in other styles/files are excluded. No push.
