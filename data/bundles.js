(function () {
  "use strict";
  const KEY = "store-bundles-v1";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  const write = (bundles) => {
    const clean = bundles.map((bundle, index) => ({
      ...bundle,
      id: String(bundle.id || `bundle-${Date.now()}-${index + 1}`),
      title: {
        ar: bundle.title?.ar || "باقة عرض خاصة",
        en: bundle.title?.en || "Special offer bundle",
      },
      primaryId: String(bundle.primaryId || bundle.productIds?.[0] || ""),
      productIds: [...new Set(bundle.productIds || [])].slice(0, 8),
      price: Math.max(0, Number(bundle.price) || 0),
      discount: Math.max(0, Number(bundle.discount) || 0),
      enabled: bundle.enabled !== false,
      createdAt: bundle.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    localStorage.setItem(KEY, JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent("store:bundles-changed", { detail: clean }));
    return clone(clean);
  };
  const forProduct = (productId) => {
    const now = Date.now();
    const catalog = window.StoreProducts?.read() || [];
    const available = read().filter((bundle) => bundle.enabled && bundle.productIds.length >= 2 && bundle.productIds.every(id=>catalog.some(product=>product.id===id&&product.published!==false&&Number(product.stock)>0)) && (!bundle.startsAt || new Date(bundle.startsAt).getTime() <= now) && (!bundle.endsAt || new Date(bundle.endsAt).getTime() > now));
    return available.find((bundle) => bundle.primaryId === productId) ||
      available.find((bundle) => bundle.productIds.includes(productId)) ||
      null;
  };
  window.StoreBundles = { KEY, read, write, forProduct };
})();
