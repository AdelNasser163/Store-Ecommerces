/*!
 * AlMumez Store — motion layer
 * Lenis (smooth scroll) + GSAP / ScrollTrigger (animation).
 * Self-contained: if GSAP is missing the site simply works without animation.
 */
(function () {
  "use strict";
  var gsap = window.gsap;
  if (!gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  var root = document.documentElement;
  var steadyPage = !!document.querySelector('link[href^="site-navigation.css"]');
  var internalNavigation = false;
  try { internalNavigation = new URL(document.referrer).origin === location.origin; } catch (_) {}
  try {
    var navigation = performance.getEntriesByType("navigation")[0];
    var pendingNavigation = JSON.parse(sessionStorage.getItem("almumez-pending-navigation") || "null");
    sessionStorage.removeItem("almumez-pending-navigation");
    internalNavigation = internalNavigation || navigation && navigation.type !== "navigate" ||
      pendingNavigation && pendingNavigation.path === location.pathname + location.search && Date.now() - pendingNavigation.time < 15000;
  } catch (_) {}
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover:hover) and (pointer:fine)").matches;
  var isHome = !!document.querySelector("main h1") && /(^|\/)(index\.html)?$/.test(location.pathname);
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  root.classList.add("fx-on");
  if (reduce) { root.classList.add("fx-reduce"); }

  /* ------------------------------------------------------------------ *
   * 1. Lenis smooth scroll, driven by the GSAP ticker
   * ------------------------------------------------------------------ */
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true, anchors: { offset: -90 } });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
  }

  // stop page scrolling while a drawer / filter sheet is open; let inner lists scroll natively
  function syncScrollLock() {
    var locked = document.body.classList.contains("drawer-open") ||
      document.body.classList.contains("accessories-filter-open") ||
      document.body.style.overflow === "hidden";
    if (lenis) { locked ? lenis.stop() : lenis.start(); }
    $$(".store-drawer-content, .store-drawer, .products-drawer, .products-filters, #mobile-navigation").forEach(function (n) {
      n.setAttribute("data-lenis-prevent", "");
    });
  }
  new MutationObserver(syncScrollLock).observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
  syncScrollLock();

  /* ------------------------------------------------------------------ *
   * 2. Scroll progress bar + back-to-top
   * ------------------------------------------------------------------ */
  var bar = document.createElement("div");
  bar.className = "fx-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);
  gsap.set(bar, { scaleX: 0, transformOrigin: "0 50%" });
  gsap.to(bar, {
    scaleX: 1, ease: "none",
    scrollTrigger: { start: 0, end: "max", scrub: 0.3 }
  });

  var topBtn = document.querySelector("[data-back-top]") ? null : document.createElement("button");
  if (topBtn) {
  topBtn.type = "button";
  topBtn.className = "fx-top";
  topBtn.setAttribute("aria-label", "Back to top");
  topBtn.innerHTML = '<span class="material-symbols-outlined">arrow_upward</span>';
  document.body.appendChild(topBtn);
  gsap.set(topBtn, { autoAlpha: 0, y: 16 });
  topBtn.addEventListener("click", function () {
    lenis ? lenis.scrollTo(0, { duration: 1.4 }) : window.scrollTo({ top: 0, behavior: "smooth" });
  });
  ScrollTrigger.create({
    start: 700,
    end: "max",
    onToggle: function (self) {
      gsap.to(topBtn, { autoAlpha: self.isActive ? 1 : 0, y: self.isActive ? 0 : 16, duration: 0.35, ease: "power2.out", overwrite: "auto" });
    }
  });
  }

  // Keep navigation visible; only the shadow changes with scroll.
  var header = $('[data-component="site-header"]');
  if (header) {
    ScrollTrigger.create({ start: 8, end: "max", onToggle: function (s) { header.classList.toggle("fx-header-scrolled", s.isActive); } });
  }

  /* ------------------------------------------------------------------ *
   * 4. Home hero intro + parallax
   * ------------------------------------------------------------------ */
  var heroSection = $(".hb-hero");
  if (heroSection && !steadyPage && !reduce && !internalNavigation) {
    gsap.fromTo($$(".hb-eyebrow, .hb-copy h1, .hb-lead, .hb-actions, .hb-stats, .hb-visual, .hb-categories", heroSection),
      { autoAlpha: 0, y: 26 },
      { autoAlpha: 1, y: 0, duration: .9, stagger: .12, ease: "power3.out", clearProps: "all" });
  }

  /* ------------------------------------------------------------------ *
   * 5. Scroll reveals (static sections + dynamically rendered cards)
   * ------------------------------------------------------------------ */
  var queue = [], timer = 0;
  var readableHome = document.body.classList.contains("pg-page") || document.body.classList.contains("pd-page");
  function flush() {
    timer = 0;
    var els = queue.splice(0);
    if (readableHome) gsap.set(els, { autoAlpha: .18, y: 20 });
    gsap.to(els, {
      autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.07, overwrite: "auto",
      clearProps: "transform,opacity,visibility",
      onComplete: function () { ScrollTrigger.refresh(); }
    });
    if (readableHome) setTimeout(function () {
      els.forEach(function (el) { el.style.removeProperty("opacity"); el.style.removeProperty("visibility"); el.style.removeProperty("transform"); });
    }, 1800);
  }
  var io = "IntersectionObserver" in window && new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting || e.boundingClientRect.top < 0) { io.unobserve(e.target); queue.push(e.target); }
    });
    if (queue.length && !timer) timer = setTimeout(flush, 30);
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.01 });

  function prep(el) {
    if (!el || steadyPage || reduce || internalNavigation || !io || el.hasAttribute("data-fx") || el.closest("[data-fx-skip]")) return;
    el.setAttribute("data-fx", "");
    // Home content stays readable until an actual intersection starts its reveal.
    if (!readableHome) gsap.set(el, { autoAlpha: 0, y: 34 });
    io.observe(el);
  }

  function scan(scope) {
    scope = scope || document;
    // product cards (rendered by catalog.js)
    $$(".pt-category-card, .pt-promo, .pt-review, .hb-card, .catalog-product-card, [data-products-section] > *", scope).forEach(function (card) {
      if (card.matches(".pt-category-card, .pt-promo, .pt-review, .hb-card, .catalog-product-card") || card.parentElement.hasAttribute("data-products-section")) prep(card);
    });
    if (scope !== document) return;
    // page sections
    $$("main > section, main > div, main > article").forEach(function (sec) {
      if (sec.hasAttribute("data-fx-skip") || sec.hasAttribute("data-rb")) return;
      var hasCards = sec.querySelector(".pt-category-card, .pt-promo, .pt-review, .hb-card, .catalog-product-card, [data-products-section]");
      if (hasCards && sec.children.length > 1) { prep(sec.firstElementChild); }
      else if (!hasCards) { prep(sec); }
    });
  }
  scan();
  var pending = 0;
  if (document.body) {
    new MutationObserver(function () {
      if (pending) return;
      pending = requestAnimationFrame(function () { pending = 0; scan(document); });
    }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
  }

  // safety net: nothing may stay invisible
  setTimeout(function () {
    $$("[data-fx]").forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0 && getComputedStyle(el).opacity === "0") {
        io && io.unobserve(el); queue.push(el);
      }
    });
    if (queue.length) flush();
  }, 2500);
  if (readableHome) {
    function revealHome() {
      $$(".pg-page [data-fx], .pd-page [data-fx]").forEach(function (el) {
        gsap.killTweensOf(el);
        el.style.removeProperty("opacity"); el.style.removeProperty("visibility"); el.style.removeProperty("transform");
      });
    }
    window.addEventListener("beforeprint", revealHome);
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", function (event) { if (event.matches) revealHome(); });
  }

  /* ------------------------------------------------------------------ *
   * 6. Add-to-cart: product flies to the cart, cart button pops
   * ------------------------------------------------------------------ */
  function cartTarget() { return $(".home-cart-button, .product-cart-button"); }
  function pop(el) {
    if (!el) return;
    gsap.fromTo(el, { scale: 1 }, { scale: 1.18, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out", overwrite: "auto" });
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-add-to-cart]");
    if (!btn || reduce) return;
    var target = cartTarget();
    var card = btn.closest(".hb-card, .catalog-product-card, article, [data-product-card]") || document;
    var img = document.body.classList.contains("pd-page") && btn.closest(".pd-info") ? $("#mainProductImage") : $("img", card) || $("#main-product-image, [data-main-image], main img");
    if (reduce || !target || !img) { setTimeout(function () { pop(target); }, 60); return; }
    var a = img.getBoundingClientRect(), b = target.getBoundingClientRect();
    if (!a.width) { pop(target); return; }
    var ghost = img.cloneNode(false);
    ghost.removeAttribute("id"); ghost.removeAttribute("loading"); ghost.removeAttribute("onerror");
    ghost.className = "fx-fly";
    ghost.style.cssText = "left:" + a.left + "px;top:" + a.top + "px;width:" + a.width + "px;height:" + a.height + "px;";
    document.body.appendChild(ghost);
    var dx = b.left + b.width / 2 - (a.left + a.width / 2);
    var dy = b.top + b.height / 2 - (a.top + a.height / 2);
    gsap.timeline({ onComplete: function () { ghost.remove(); pop(target); } })
      .to(ghost, { scale: 0.7, duration: 0.18, ease: "power2.out" })
      .to(ghost, { x: dx, y: dy, scale: 0.08, opacity: 0.2, rotate: 18, duration: 0.75, ease: "power3.in" });
  }, true);

  /* ------------------------------------------------------------------ *
   * 7. Magnetic primary buttons (desktop only)
   * ------------------------------------------------------------------ */
  if (finePointer && !reduce) {
    $$(".mumez-glow").forEach(function (el) {
      var xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
      var yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.38);
      });
      el.addEventListener("pointerleave", function () { xTo(0); yTo(0); });
    });
  }

  // Internal links use native navigation without a curtain or delayed redirect.

  /* ------------------------------------------------------------------ *
   * 9. Keep ScrollTrigger honest as images/fonts load
   * ------------------------------------------------------------------ */
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });

  window.AlMumezFX = { lenis: lenis, gsap: gsap, refresh: function () { scan(document); ScrollTrigger.refresh(); } };
})();
