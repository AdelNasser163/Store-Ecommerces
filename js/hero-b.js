(function () {
  "use strict";
  const host = document.querySelector("[data-hb-slides]");
  if (!host || !window.StoreProducts) return;

  const store = window.StoreProducts;
  const images = {
    "apple-iphone-15-pro-max-256gb": "f1.png",
    "macbook-pro-16-m3-max": "galaxy-s24.jpg",
    "playstation-5-slim-bundle": "dell-g15-3.jpg",
  };
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );

  function content(product, side) {
    const language = document.documentElement.lang === "ar" ? "ar" : "en";
    const local = store.localized(product, language);
    const alt =
      product.id === "apple-iphone-15-pro-max-256gb"
        ? language === "ar"
          ? "آيفون 17 برو ماكس"
          : "iPhone 17 Pro Max"
        : local.name;
    const unified = document.body.classList.contains("pg-unified");
    const source = "assets/images/" + images[product.id];
    const attributes =
      window.AlMumezImages?.attributes(source, {
        sizes: side ? "220px" : "(max-width:639px) 258px, 284px",
      }) || `src="${escape(source)}"`;
    return `<div class="${side ? "hb-side-link" : "hb-slide is-active"}"><img ${attributes} width="${side ? 210 : 296}" height="${side ? 130 : unified ? 290 : 382}" decoding="async" ${side ? 'loading="lazy"' : 'loading="eager" fetchpriority="high"'} alt="${escape(alt)}"></div>`;
  }

  function render() {
    const products = store.read();
    const mainProduct = products.find(
      (product) => product.id === "apple-iphone-15-pro-max-256gb",
    );
    function update(element, product, side) {
      if (!product) {
        element.replaceChildren();
        return;
      }
      const image = element.querySelector("img");
      if (!image) {
        element.innerHTML = content(product, side);
        return;
      }
      // Reuse the image discovered in HTML; data/language changes must not restart decoding.
      const source = "assets/images/" + images[product.id];
      const optimized = window.AlMumezImages?.source(source) || source;
      if (
        image.getAttribute("src") !== optimized &&
        image.dataset.heroSource !== source
      ) {
        if (window.AlMumezImages) window.AlMumezImages.apply(image, source);
        else image.src = source;
      }
      image.dataset.heroSource = source;
      image.alt =
        product.id === "apple-iphone-15-pro-max-256gb"
          ? document.documentElement.lang === "ar"
            ? "آيفون 17 برو ماكس"
            : "iPhone 17 Pro Max"
          : store.localized(
              product,
              document.documentElement.lang === "ar" ? "ar" : "en",
            ).name;
    }
    update(host, mainProduct, false);
    document.querySelectorAll("[data-hb-side]").forEach((element) => {
      const product = products.find(
        (item) => item.id === element.dataset.hbSide,
      );
      update(element, product, true);
      element.hidden = !product;
    });
  }

  new MutationObserver(render).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  render();
  if (document.body.classList.contains("pg-unified")) {
    store.ready?.then(render);
    window.addEventListener("store:products-changed", render);
  }
})();
