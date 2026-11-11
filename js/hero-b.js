(function () {
  "use strict";
  const host = document.querySelector("[data-hb-slides]");
  if (!host || !window.StoreProducts) return;

  const store = window.StoreProducts;
  const images = {
    "apple-iphone-15-pro-max-256gb": "iPhone_17_Pro_Max-hero.webp",
    "macbook-pro-16-m3-max": "sony-wf-hero.webp",
    "playstation-5-slim-bundle": "iphone-15-showcase.webp"
  };
  const escape = value => String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  function content(product, side) {
    const language = document.documentElement.lang === "ar" ? "ar" : "en";
    const local = store.localized(product, language);
    if (document.body.classList.contains("pg-unified")) {
      const offer = store.getEffectivePrice(product);
      const money = value => `${new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-EG").format(value)} ${language === "ar" ? "ج.م" : "EGP"}`;
      const image = images[product.id] === "accessory-iphone_hero.jpg" ? "accessory-iphone_web.jpg" : images[product.id];
      const discount = offer.originalPrice > offer.price ? Math.round((1 - offer.price / offer.originalPrice) * 100) : 0;
      return `<a class="${side ? "hb-side-link" : "hb-slide is-active"}" href="product.html?id=${encodeURIComponent(product.id)}"><img src="assets/images/${escape(image)}" width="${side ? 210 : 296}" height="${side ? 130 : 290}" ${side ? 'loading="lazy"' : 'fetchpriority="high"'} alt="${escape(local.name)}">${!side && discount ? `<span class="hb-discount"><bdi>−${discount}%</bdi></span>` : ""}<div class="hb-product-copy" aria-hidden="true"><h2>${escape(local.name)}</h2><div><bdi class="hb-price">${escape(money(offer.price))}</bdi>${!side && offer.originalPrice > offer.price ? `<del class="hb-old"><bdi>${escape(money(offer.originalPrice))}</bdi></del>` : ""}</div></div></a>`;
    }
    return `<a class="${side ? "" : "hb-slide is-active"}" href="product.html?id=${encodeURIComponent(product.id)}"><img src="assets/images/${escape(images[product.id])}" width="${side ? 210 : 296}" height="${side ? 130 : 382}" ${side ? 'loading="lazy"' : 'fetchpriority="high"'} alt="${escape(local.name)}"></a>`;
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
