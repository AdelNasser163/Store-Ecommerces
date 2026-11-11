(function () {
  "use strict";
  const host = document.querySelector("[data-hb-slides]");
  if (!host || !window.StoreProducts) return;

  const store = window.StoreProducts;
  const images = {
    "apple-iphone-15-pro-max-256gb": "iPhone_17_Pro_Max-hero.webp",
    "macbook-pro-16-m3-max": "macbook-m3-cutout.png",
    "playstation-5-slim-bundle": "ps5-slim-hero.png"
  };
  const escape = value => String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  function content(product, side) {
    const language = document.documentElement.lang === "ar" ? "ar" : "en";
    const local = store.localized(product, language);
    const alt = product.id === "apple-iphone-15-pro-max-256gb"
      ? (language === "ar" ? "آيفون 17 برو ماكس" : "iPhone 17 Pro Max")
      : local.name;
    const unified = document.body.classList.contains("pg-unified");
    return `<div class="${side ? "hb-side-link" : "hb-slide is-active"}"><img src="assets/images/${escape(images[product.id])}" width="${side ? 210 : 296}" height="${side ? 130 : unified ? 290 : 382}" ${side ? 'loading="lazy"' : 'fetchpriority="high"'} alt="${escape(alt)}"></div>`;
  }

  function render() {
    const products = store.read();
    const mainProduct = products.find(product => product.id === "apple-iphone-15-pro-max-256gb");
    host.innerHTML = mainProduct ? content(mainProduct, false) : "";
    document.querySelectorAll("[data-hb-side]").forEach(element => {
      const product = products.find(item => item.id === element.dataset.hbSide);
      element.innerHTML = product ? content(product, true) : "";
      element.hidden = !product;
    });
  }

  new MutationObserver(render).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"]
  });
  render();
  if (document.body.classList.contains("pg-unified")) {
    store.ready?.then(render);
    window.addEventListener("store:products-changed", render);
  }
})();
