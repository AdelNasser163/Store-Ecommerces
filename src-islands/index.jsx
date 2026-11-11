/**
 * React Bits "islands" — small React roots mounted onto the static pages.
 * Components live in ./rb (copied from reactbits.dev, JS + CSS variant).
 * Each island mounts on an element carrying data-rb="<name>"; the original
 * markup inside that element stays as the no-JS fallback.
 */
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import LogoLoop from "./rb/LogoLoop.jsx";
import SpotlightCard from "./rb/SpotlightCard.jsx";
import CountUp from "./rb/CountUp.jsx";
import ClickSpark from "./rb/ClickSpark.jsx";
import Particles from "./rb/Particles.jsx";
import "./islands.css";

const GREEN = "#8bc34a";
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* language follows the store's own switch (it sets <html lang>) */
function useLang() {
  const [lang, setLang] = useState(document.documentElement.lang === "ar" ? "ar" : "en");
  useEffect(() => {
    const mo = new MutationObserver(() =>
      setLang(document.documentElement.lang === "ar" ? "ar" : "en")
    );
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => mo.disconnect();
  }, []);
  return lang;
}

/* ---------- Brands: LogoLoop ---------- */
const BRANDS = ["Apple", "SAMSUNG", "DELL", "SONY", "Lenovo", "LG", "PHILIPS"];
function Brands() {
  const logos = BRANDS.map((name) => ({
    node: <span className="rb-brand">{name}</span>,
    ariaLabel: name,
  }));
  return (
    <LogoLoop
      logos={logos}
      speed={reduced() ? 0 : 70}
      gap={72}
      logoHeight={28}
      fadeOut
      fadeOutWidth={0.12}
      pauseOnHover
      draggable
      ariaLabel="Authorized partner brands"
    />
  );
}

/* ---------- Stats: SpotlightCard + CountUp ---------- */
function Stats() {
  const lang = useLang();
  const ar = lang === "ar";
  const [counts, setCounts] = useState({ products: 0, brands: 0, departments: 0, offers: 0 });
  useEffect(() => {
    const update = () => {
      const products = window.StoreProducts?.read?.() || [];
      if (document.body.classList.contains("pg-page") && window.AlMumezPageFacts) {
        setCounts(window.AlMumezPageFacts.read());
        return;
      }
      const brands = new Set(products.map(product => String(product.brand?.en || product.brand?.ar || product.brand || "").trim().toLowerCase()).filter(Boolean));
      const departments = new Set(products.map(product => product.category).filter(Boolean));
      setCounts({ products: products.length, brands: brands.size, departments: departments.size, offers: products.filter(product => window.StoreProducts.getEffectivePrice(product).active).length });
    };
    update();
    window.StoreProducts?.ready?.then(update);
    window.addEventListener("store:products-changed", update);
    const storage = event => { if (event.key === window.StoreProducts?.KEY) update(); };
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener("store:products-changed", update); window.removeEventListener("storage", storage); };
  }, []);
  const items = [
    { icon: "inventory_2", to: counts.products, en: "Products in our catalog", ar: "منتج في الكتالوج" },
    { icon: "verified", to: counts.brands, en: document.body.classList.contains("pg-page") ? "Partner brands on this page" : "Brands in our catalog", ar: document.body.classList.contains("pg-page") ? "علامة في شريط البراندات" : "علامة تجارية في الكتالوج" },
    { icon: "category", to: counts.departments, en: document.body.classList.contains("pg-page") ? "Shopping categories" : "Catalog departments", ar: document.body.classList.contains("pg-page") ? "قسم للتسوق" : "قسم في الكتالوج" },
    { icon: "local_offer", to: counts.offers, en: document.body.classList.contains("pg-unified") ? "Flash deals live now" : "Current offers", ar: document.body.classList.contains("pg-unified") ? "عرض سريع متاح الآن" : "عرض حالي" },
  ];
  return (
    <div className="rb-stats-grid">
      {items.map(item => (
        <SpotlightCard key={item.icon} theme="light" spotlightColor={GREEN} intensity={0.35} spotlightSize={260} className="rb-stat">
          <div className="rb-stat-inner">
            <span className="material-symbols-outlined rb-stat-icon" aria-hidden="true">{item.icon}</span>
            <div className="rb-stat-num">{document.body.classList.contains("pg-page") && (reduced() || !window.IntersectionObserver) ? new Intl.NumberFormat(ar ? "ar-EG" : "en-EG").format(item.to) : <CountUp to={item.to} duration={1.8} trigger={document.body.classList.contains("pg-page") ? "load" : "view"} />}</div>
            <div className="rb-stat-label">{ar ? item.ar : item.en}</div>
          </div>
        </SpotlightCard>
      ))}
    </div>
  );
}

/* ---------- Hero background: Particles ---------- */
function HeroParticles() {
  if (reduced()) return null;
  const small = window.innerWidth < 768;
  return (
    <Particles
      particleCount={small ? 60 : 130}
      particleSpread={10}
      speed={0.06}
      particleColors={[GREEN, "#ffffff", "#67e8f9"]}
      moveParticlesOnHover={!small}
      particleHoverFactor={0.6}
      alphaParticles
      particleBaseSize={80}
      clickBurst={false}
      disableRotation={false}
    />
  );
}

/* ---------- Click sparks on add-to-cart / buttons ---------- */
function Sparks() {
  const ref = useRef(null);
  useEffect(() => {
    if (reduced()) return;
    const el = ref.current;
    const onClick = (e) => {
      const hit = e.target.closest && e.target.closest("[data-add-to-cart], .mumez-glow, [data-toggle-wishlist]");
      if (!hit || !el) return;
      const target = el.firstElementChild;
      if (!target) return;
      target.dispatchEvent(
        new MouseEvent("click", { clientX: e.clientX, clientY: e.clientY, detail: 1, bubbles: false })
      );
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return (
    <div ref={ref} className="rb-sparks" aria-hidden="true">
      <ClickSpark sparkColor={GREEN} sparkSize={11} sparkRadius={22} sparkCount={10} duration={520} extraScale={1} layer="front" />
    </div>
  );
}

const ISLANDS = {
  brands: () => <Brands />,
  stats: () => <Stats />,
  particles: () => <HeroParticles />,
};

function mount() {
  document.querySelectorAll("[data-rb]").forEach((el) => {
    const make = ISLANDS[el.getAttribute("data-rb")];
    if (!make || el.__rb) return;
    el.__rb = true;
    const node = make(el);
    if (!node) return;
    createRoot(el).render(node);
  });

  if (!document.querySelector(".rb-sparks-root")) {
    const host = document.createElement("div");
    host.className = "rb-sparks-root";
    document.body.appendChild(host);
    createRoot(host).render(<Sparks />);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
else mount();
