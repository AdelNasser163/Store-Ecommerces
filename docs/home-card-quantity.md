# Home card quantity controls

Home product cards now replace the visible Add to cart button with the same quantity stepper used in the catalogue. The original button stays mounted for existing cart references and image-flight effects. Controls delegate to main.js's existing `data-quantity` handler, using actual cart line keys; no cart calculations or persistence logic were changed.

The display follows cart drawer updates, persisted quantities on reload, and language changes. At zero quantity the original button returns. Increasing respects the selected variant's stock. Bundles are excluded from individual product quantities.

Playwright passed at 390px and 1440px: add, increase, decrease, language update, persisted quantity after reload, return to Add to cart at zero, and no page JavaScript errors. Google font requests were blocked during tests.
