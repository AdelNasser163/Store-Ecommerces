(function() {
  "use strict";
  if (!document.body.classList.contains("pt-page")) return;
  const unified = document.body.classList.contains("pg-page");
  function readFacts() {
    const products = window.StoreProducts?.read?.() || [];
    const brandHost = document.querySelector(".hb-brands");
    const rendered = [...(brandHost?.querySelectorAll(".rb-brand") || [])].map(node => node.textContent.trim());
    const brands = new Set((rendered.length ? rendered : (brandHost?.textContent || "").split("·")).map(name => name.trim().toLowerCase()).filter(Boolean));
    const offers = products.filter(product => window.StoreProducts.getEffectivePrice(product).active && (!document.body.classList.contains("pg-unified") || product.placements?.["home-flash"] != null));
    const uniqueOffers = window.StoreCatalogUI?.unique ? window.StoreCatalogUI.unique(offers) : offers;
    return { products: products.length, brands: brands.size, departments: document.querySelectorAll("[data-pt-category]").length, offers: uniqueOffers.length };
  }
  if (unified) window.AlMumezPageFacts = { read: readFacts };
  function updateCounts() {
    const products = window.StoreProducts?.read?.() || [];
    const arabic = document.documentElement.lang === "ar";
    const facts = { products: products.length, brands: new Set(products.map((product) => String(product.brand?.en || product.brand?.ar || product.brand || "").trim().toLowerCase()).filter(Boolean)).size, departments: new Set(products.map((product) => product.category).filter(Boolean)).size, offers: products.filter((product) => window.StoreProducts.getEffectivePrice(product).active).length };
    if (unified) Object.assign(facts, readFacts());
    document.querySelectorAll("[data-pt-stat]").forEach((node) => {
      node.textContent = new Intl.NumberFormat(arabic ? "ar-EG" : "en-EG").format(facts[node.dataset.ptStat]);
    });
    document.querySelectorAll("[data-pt-category]").forEach((link) => {
      const params = new URL(link.href).searchParams;
      const department = params.get("dept"), query = (params.get("q") || "").toLowerCase();
      const count = products.filter((product) => {
        if (department && product.category !== department) return false;
        const text = [product.name?.en, product.name?.ar, product.brand?.en, product.brand?.ar, product.category, product.categoryLabel?.en, product.categoryLabel?.ar, product.subcategory?.en, product.subcategory?.ar, product.sku].filter(Boolean).join(" ").toLowerCase();
        return !query || text.includes(query);
      }).length;
      link.querySelector("[data-pt-count]").textContent = `${new Intl.NumberFormat(arabic ? "ar-EG" : "en-EG").format(count)} ${arabic ? "منتج" : count === 1 ? "product" : "products"}`;
    });
    const email = document.querySelector("#pt-newsletter-email");
    if (email) email.placeholder = arabic ? "أدخل بريدك الإلكتروني..." : "Enter your email address...";
    if (document.body.classList.contains("pg-unified")) {
      const search = document.querySelector("#hb-search-input");
      if (search) search.placeholder = arabic ? "ابحث عن المنتجات…" : "Search products…";
    }
    document.querySelectorAll(".pt-review-stars").forEach((stars) => stars.setAttribute("aria-label", arabic ? "5 من 5 نجوم" : "5 out of 5 stars"));
    const tabs = document.querySelector(".pt-tabs");
    if (tabs) {
      tabs.setAttribute("aria-label", arabic ? "أقسام المنتجات" : "Product categories");
      tabs.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.classList.contains("filter-active"))));
    }
    if (unified) document.querySelectorAll(".pg-empty").forEach(node => { node.textContent = arabic ? "لا توجد منتجات مطابقة." : "No matching products found."; });
  }
  new MutationObserver(updateCounts).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  window.addEventListener("store:products-changed", updateCounts);
  window.addEventListener("storage", (event) => {
    if (event.key === window.StoreProducts?.KEY) updateCounts();
  });
  window.StoreProducts?.ready?.then(updateCounts);
  document.querySelector(".pt-tabs")?.addEventListener("click", updateCounts);
  updateCounts();
  if (!unified) return;
  if (document.body.classList.contains("pg-unified")) {
    const footerLogo = document.querySelector('.products-footer-grid>section:first-child>img');
    if (footerLogo) footerLogo.src = 'assets/images/logo-footer.png';
    const clock = document.querySelector(".pg-deal-clock");
    function updateDealClock() {
      if (!clock) return;
      const deadlines = (window.StoreProducts?.read?.() || []).filter(product => product.placements?.["home-flash"] != null).map(product => window.StoreProducts.getEffectivePrice(product)).filter(offer => offer.active && offer.endsAt > Date.now()).map(offer => offer.endsAt);
      clock.hidden = !deadlines.length;
      if (!deadlines.length) return;
      const remaining = Math.max(0, Math.floor((Math.min(...deadlines) - Date.now()) / 1000));
      const ar = document.documentElement.lang === "ar", format = value => new Intl.NumberFormat(ar ? "ar-EG" : "en-EG", {minimumIntegerDigits:2}).format(value);
      clock.querySelector("span").textContent = ar ? "ينتهي خلال" : "Ends in";
      const values = [Math.floor(remaining / 3600), Math.floor(remaining % 3600 / 60), remaining % 60];
      clock.querySelectorAll("bdi").forEach((node, index) => { node.textContent = `${format(values[index])}${(ar ? ["س", "د", "ث"] : ["h", "m", "s"])[index]}`; });
    }
    updateDealClock();
    setInterval(updateDealClock, 1000);
    new MutationObserver(updateDealClock).observe(document.documentElement, {attributes:true, attributeFilter:["lang"]});
    window.addEventListener("store:products-changed", updateDealClock);
  }

  // Placeholder footer destinations are text until a real page or social URL exists.
  document.querySelectorAll('.products-footer a[href^="#"]').forEach(link => {
    const text = document.createElement("span");
    text.className = link.closest(".products-social") ? "pg-social-placeholder" : "pg-footer-placeholder";
    text.append(...link.childNodes);
    if (link.id) text.id = link.id;
    const label = link.getAttribute("aria-label");
    if (label) { text.setAttribute("role", "img"); text.setAttribute("aria-label", label); }
    link.replaceWith(text);
  });

  const featured = document.querySelector('[data-products-section="home-featured"]');
  const tabs = document.querySelector(".pt-tabs");
  let animation;
  tabs?.addEventListener("click", event => {
    if (!event.target.closest("button")) return;
    // Keep the existing filter handler and cached card nodes intact.
    featured.style.minHeight = `${Math.ceil(featured.getBoundingClientRect().height)}px`;
    requestAnimationFrame(() => {
      animation?.kill();
      const cards = [...document.querySelectorAll('.pg-page .hb-card:not([hidden])')];
      if (window.gsap && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        animation = window.gsap.fromTo(cards, { opacity: .3, y: 8 }, { opacity: 1, y: 0, duration: .28, stagger: .025, ease: "power3.out", clearProps: "opacity,visibility,transform" });
      }
      tabs.querySelectorAll("button").forEach(button => button.setAttribute("aria-pressed", String(button.classList.contains("filter-active"))));
      let empty = featured.querySelector(".pg-empty");
      if (!featured.querySelector('.hb-card:not([hidden])')) {
        if (!empty) { empty = document.createElement("div"); empty.className = "pg-empty"; empty.setAttribute("role", "status"); featured.append(empty); }
        empty.textContent = document.documentElement.lang === "ar" ? "لا توجد منتجات مطابقة." : "No matching products found.";
      } else empty?.remove();
    });
  }, true);
  window.addEventListener("resize", () => { if (featured) featured.style.minHeight = ""; });
})();
