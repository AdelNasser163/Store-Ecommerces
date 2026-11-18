# Shared storefront components

- `templates/site-header.html`: the homepage header is the canonical markup.
- `templates/site-footer.html`: the canonical storefront footer.
- `tools/site-components.mjs`: injects the templates during `npm run build:performance`. Search IDs and action attributes remain compatible with each page's existing handlers. Drawer/filter footers are never replaced.
- `shared-site-header.js`: hydrates labels and binds existing menu/account/language behavior on secondary pages. It no longer replaces the header HTML.
- `shared-site-footer.js`: updates the year; `js/site-theme.js` retains the existing bilingual footer presentation.
- `site-navigation.css` and `site-theme.css`: shared header/footer appearance.
- `shared-ui.css`: reusable `.site-button` foundation. Page classes retain their existing size, colors, responsive rules and interaction variants.
- `js/product-card.js` and `product-card.css`: the existing shared product card renderer and variants; cart buttons use the same button foundation.

The repeated HTML in published pages and the hashed `dist` bundles are **generated output**, required for static GitHub Pages. Change the source templates/styles, then run `npm run build:performance`; do not edit `dist` manually. There is no runtime template request, new dependency or loading placeholder.

Login remains without storefront navigation/footer, as previously requested. Password recovery pages retain the storefront shell. Dashboard pages retain their existing shared admin shell (`admin-ui.js`, `admin-shell.css`) rather than acquiring storefront navigation.

Verification:

```text
node tools/site-components-verify.cjs
node tools/site-components-home-verify.cjs
node tools/perf-css-regression.cjs --content-only
node tools/perf-verify.cjs
node tools/shared-drawers-verify.cjs
```

The content-only CSS comparison excludes the header whose source is being unified, while retaining all other content, buttons, cards and footer. The separate shell comparison checks the header/footer against the homepage on nine pages, in both languages at 390, 820 and 1440 pixels.

The homepage screenshot comparison uses commit `e6a4a0a` as the pre-refactor reference (or a commit passed as its first argument). The published logo's original 95px desktop width and cover fit are now represented in the source stylesheet, so rebuilding cannot discard that adjustment.
