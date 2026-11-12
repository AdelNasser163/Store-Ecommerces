(function(root) {
  "use strict";
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const local = (value, language2) => typeof value === "object" && value ? value[language2] || value.en || value.ar || "" : String(value || "");
  const language = () => document.documentElement.lang === "ar" ? "ar" : "en";
  const copy = {
    en: { add: "Add to cart", out: "Out of stock", stock: "In stock", wish: "Add to wishlist", unwish: "Remove from wishlist", reviews: "reviews", save: "Save", off: "Off", delivery: "Fast delivery", details: "View details", claimed: "Claimed:", left: "Left", ends: "Ends in", increase: "Increase quantity", decrease: "Decrease quantity", new: "New Arrival", "best-seller": "Best Seller", "official-warranty": "Official Warranty" },
    ar: { add: "أضف للسلة", out: "غير متوفر", stock: "متوفر", wish: "إضافة إلى المفضلة", unwish: "إزالة من المفضلة", reviews: "تقييم", save: "وفّر", off: "خصم", delivery: "توصيل سريع", details: "عرض التفاصيل", claimed: "تم حجز:", left: "متبقي", ends: "ينتهي خلال", increase: "زيادة الكمية", decrease: "تقليل الكمية", new: "وصل حديثًا", "best-seller": "الأكثر مبيعًا", "official-warranty": "ضمان رسمي" }
  };
  copy.en.warranty = "Official warranty included";
  copy.ar.warranty = "يشمل الضمان الرسمي";
  function money(value, lang) {
    return `${new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-EG", { maximumFractionDigits: 0 }).format(value)} ${lang === "ar" ? "ج.م" : "EGP"}`;
  }
  function wished(id) {
    try {
      return JSON.parse(localStorage.getItem("almumez-wishlist") || "[]").some((item) => String(item?.id ?? item) === String(id));
    } catch {
      return false;
    }
  }
  function render(product, options = {}) {
    const store = root.StoreProducts;
    if (typeof product === "string") product = store?.read().find((item) => item.id === product);
    if (!product) return "";
    const source = product.source || product, lang = language(), text = copy[lang];
    const variant = options.variant || (document.body.matches(".pg-unified, .products-catalog-page") ? "navy" : "");
    const effective = store?.getEffectivePrice(source) || { price: Number(source.price) || 0, originalPrice: Number(source.oldPrice) || 0 };
    const price = Number(options.price ?? effective.price) || 0, old = Number(options.oldPrice ?? effective.originalPrice) || 0;
    const discount = old > price ? Math.round((1 - price / old) * 100) : 0;
    const id = String(source.id), name = local(source.name, lang), brand = local(source.brand, lang), category = local(source.categoryLabel || source.subcategory || source.category, lang);
    const stock = Math.max(0, Number(source.stock) || 0), rating = Number(source.rating) || 0, reviews = Number(source.reviewsCount ?? source.reviews) || 0;
    const isWished = options.wished ?? wished(id), url = `product.html?id=${encodeURIComponent(id)}`, fallback = store?.imageFallback || "assets/images/logo.png";
    let reference = String(source.image || fallback);
    if (variant && reference === "assets/images/accessory-iphone.jpg") reference = "assets/images/accessory-iphone_web.jpg";
    const image = reference.startsWith("idb:") ? `src="${escape(fallback)}" data-image-ref="${escape(reference)}"` : root.AlMumezImages?.attributes(reference) || `src="${escape(reference)}"`;
    const badge = text[source.badge] || "", flash = effective.active && source.placements?.["home-flash"] != null;
    const claim = Math.max(0, Math.min(100, Number(effective.claimed) || 0));
    const action = options.actionHtml || `<button class="hb-card-add product-action" type="button" data-add="${escape(id)}" data-add-to-cart="${escape(id)}" aria-label="${escape(stock ? text.add : text.out)} — ${escape(name)}" ${stock ? "" : "disabled"}><span class="material-symbols-outlined" aria-hidden="true">shopping_bag</span><span>${stock ? text.add : text.out}</span></button>`;
    const saving = old > price ? `${text.save} <bdi>${money(old - price, lang)}</bdi>` : source.badge === "official-warranty" ? text.warranty : text.details;
    const hasRating = variant ? rating > 0 : rating || reviews;
    return `<article class="hb-card${options.dark ? " hb-card--dark" : ""}${variant ? ` hb-card--${escape(variant)}` : ""} product-card catalog-product-card" data-product-card data-product-id="${escape(id)}" data-category="${escape(source.category || "")}" data-search="${escape(`${name} ${brand} ${category}`.toLowerCase())}">
      <div class="hb-card-media"><a class="hb-card-image-link" href="${url}" aria-label="${escape(name)}"><img ${image} width="600" height="600" ${options.eager ? 'loading="eager"' : 'loading="lazy"'} decoding="async" alt="${escape(name)}" onerror="this.onerror=null;this.srcset='';this.src='${escape(fallback)}'"></a>
      <button class="hb-card-wish product-wish${isWished ? " is-active" : ""}" type="button" data-wish="${escape(id)}" data-toggle-wishlist="${escape(id)}" aria-label="${escape(isWished ? text.unwish : text.wish)} — ${escape(name)}" aria-pressed="${Boolean(isWished)}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg></button>
      <div class="hb-card-badges">${discount ? `<span class="hb-card-badge hb-card-badge--sale"><bdi>${variant ? "−" : ""}${discount}%</bdi>${variant ? "" : ` ${text.off}`}</span>` : ""}${!stock ? `<span class="hb-card-badge hb-card-badge--out">${text.out}</span>` : badge ? `<span class="hb-card-badge">${escape(badge)}</span>` : ""}</div></div>
      <div class="hb-card-body"><div class="hb-card-meta"><bdi>${escape(brand)}</bdi><span>${escape(category)}</span></div>
      <h2 class="hb-card-title"><a href="${url}">${escape(name)}</a></h2>
      ${hasRating ? `<div class="hb-card-rating"><span class="hb-card-star" aria-hidden="true">★</span><strong><bdi>${rating.toFixed(1)}</bdi></strong>${reviews ? `<span>(${reviews} ${text.reviews})</span>` : ""}</div>` : variant ? `<div class="hb-card-rating">${text.details}</div>` : ""}
      <div class="hb-card-price product-price"><strong><bdi>${money(price, lang)}</bdi></strong>${old > price ? `<del><bdi>${money(old, lang)}</bdi></del>` : ""}${variant ? `<small>${saving}</small>` : old > price ? `<small>${text.save} <bdi>${money(old - price, lang)}</bdi></small>` : ""}</div>
      <div class="hb-card-availability"><span class="hb-card-stock${stock ? "" : " hb-card-stock--out"}">${stock ? text.stock : text.out}</span>${source.express ? `<span class="hb-card-delivery"><span class="material-symbols-outlined" aria-hidden="true">local_shipping</span>${text.delivery}</span>` : ""}</div>
      <div class="hb-card-offer-slot">${flash ? `<div class="hb-card-flash"><div class="hb-card-claim-label"><span>${text.claimed} <bdi>${claim}%</bdi></span><span><bdi>${Number(effective.left) || 0}</bdi> ${text.left}</span></div><div class="hb-card-claim" role="meter" aria-label="${text.claimed}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${claim}"><i style="width:${claim}%"></i></div></div>` : ""}
      ${effective.active && effective.endsAt ? `<small class="hb-card-countdown" data-hb-offer-end="${effective.endsAt}"></small>` : ""}
      </div><div class="hb-card-actions product-card-actions">${action}<a class="hb-card-details" href="${url}" aria-label="${text.details} — ${escape(name)}"><span class="material-symbols-outlined" aria-hidden="true">arrow_outward</span></a></div>
      ${options.extraHtml && !options.extraHtml.includes("catalog-offer-countdown") ? options.extraHtml : ""}</div></article>`;
  }
  function decorate(scope = document) {
    scope.querySelectorAll(".hb-card .product-stepper").forEach((stepper) => {
      stepper.classList.add("hb-card-stepper");
      stepper.querySelectorAll("button").forEach((button) => {
        button.type = "button";
        button.setAttribute("aria-label", copy[language()][Number(button.dataset.delta) > 0 ? "increase" : "decrease"]);
      });
    });
  }
  function refreshLanguage() {
    const products = root.StoreProducts?.read() || [];
    document.querySelectorAll(".hb-card[data-product-id]").forEach((card) => {
      const product = products.find((item) => String(item.id) === card.dataset.productId);
      if (!product) return;
      const template = document.createElement("template");
      const action = card.querySelector(".product-stepper")?.outerHTML;
      template.innerHTML = render(product, { dark: card.classList.contains("hb-card--dark"), variant: card.classList.contains("hb-card--light") ? "light" : card.classList.contains("hb-card--navy") ? "navy" : "", actionHtml: action, eager: card.querySelector("img")?.loading === "eager" });
      const next = template.content.firstElementChild;
      ["[data-toggle-wishlist]", "[data-add-to-cart]"].forEach((selector) => {
        const previous = card.querySelector(selector), replacement = next.querySelector(selector);
        if (!previous || !replacement) return;
        [...replacement.attributes].forEach((attribute) => previous.setAttribute(attribute.name, attribute.value));
        previous.replaceChildren(...replacement.childNodes);
        replacement.replaceWith(previous);
      });
      card.replaceChildren(...next.childNodes);
      card.dataset.search = next.dataset.search;
    });
    decorate();
  }
  new MutationObserver(refreshLanguage).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  function tick() {
    if (document.hidden) return;
    const text = copy[language()];
    let expired = false;
    document.querySelectorAll("[data-hb-offer-end]").forEach((node) => {
      if (Number(node.dataset.hbOfferEnd) <= Date.now()) expired = true;
      const remaining = Math.max(0, Math.floor((Number(node.dataset.hbOfferEnd) - Date.now()) / 1e3));
      const days = Math.floor(remaining / 86400), hours = Math.floor(remaining % 86400 / 3600), minutes = Math.floor(remaining % 3600 / 60), seconds = remaining % 60;
      node.textContent = `${text.ends} ${days}:${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    });
    if (expired) refreshLanguage();
  }
  function mount() {
    decorate();
    tick();
    new MutationObserver((records) => {
      if (records.some((record) => [...record.addedNodes].some((node) => node.nodeType === 1))) {
        decorate();
        tick();
        if(!clock&&document.querySelector('[data-hb-offer-end]'))syncClock();
      }
    }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
  }
  root.AlMumezProductCard = { render };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
  let clock=0;
  function syncClock(){if(clock)clearInterval(clock);clock=0;if(!document.hidden&&document.querySelector('[data-hb-offer-end]')){tick();clock=setInterval(tick,1000)}}
  document.addEventListener('visibilitychange',syncClock);
  window.addEventListener('store:cards-rendered',syncClock);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncClock);else syncClock();
})(globalThis);
