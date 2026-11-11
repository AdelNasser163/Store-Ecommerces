# Homepage mobile product navigation

Flash Deals and Featured Tech Collections now have native horizontal scrolling and previous/next buttons below 768px. Existing desktop grids and product-card markup remain unchanged.

- Buttons follow the current language and direction, disable at either end, and disappear when fewer than two visible products remain.
- Filtering and card replacement reset the rail to its first visible product.
- Touch scrolling and keyboard arrow navigation remain available. Reduced motion uses immediate scrolling.
- Styles and behavior are isolated in `mobile-product-rails.css` and `js/mobile-product-rails.js`.

Playwright checked both sections at 390px in English/Arabic, with normal/reduced motion: navigation, boundary states, no vertical jump, filtering, language changes, and no page JavaScript errors. Additional checks covered 320/767/820/1440px, no page horizontal overflow, and unchanged desktop grid flow. Results and mobile screenshots are saved alongside this file.

Existing Arabic category filtering can leave the featured grid empty; navigation correctly hides for an empty grid. Filtering logic was not changed.
