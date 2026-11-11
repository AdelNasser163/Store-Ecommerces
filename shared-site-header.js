(function () {
  "use strict";

  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  let host = document.querySelector('[data-component="site-header"], [data-products-header]');
  if (!host && !document.body.matches('[data-page^="admin"], .admin-dashboard-page')) {
    host=document.createElement("header");
    document.body.prepend(host);
  }
  if (!host) return;

  const LANGUAGE_KEY = "almumez-language";
  const normalizeLanguage = value => {
    if (value === "ar" || value === "en") return value;
    try { const parsed = JSON.parse(value); return parsed === "ar" || parsed === "en" ? parsed : "ar"; }
    catch { return "ar"; }
  };
  const language = normalizeLanguage(localStorage.getItem(LANGUAGE_KEY));
  localStorage.setItem(LANGUAGE_KEY, language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  const copies = {
    ar: { home:"الرئيسية", products:"المنتجات", about:"من نحن", contact:"اتصل بنا", dashboard:"لوحة التحكم", search:"ابحث عن المنتجات والإكسسوارات واللابتوب...", searchButton:"بحث", menu:"فتح القائمة", wishlist:"المفضلة", account:"الحساب", language:"تغيير اللغة", cart:"السلة", item:"منتج" },
    en: { home:"Home", products:"Products", about:"About", contact:"Contact", dashboard:"Dashboard", search:"Search genuine electronics, accessories, laptops...", searchButton:"Search", menu:"Open menu", wishlist:"Wishlist", account:"Account", language:"Change language", cart:"Cart", item:"items" }
  };
  const copy = copies[language];
  const formatCurrency = (value, selectedLanguage = language) => {
    const locale = selectedLanguage === "ar" ? "ar-EG" : "en-EG";
    const amount = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(value) || 0);
    return selectedLanguage === "ar" ? `${amount} \u062c.\u0645` : `EGP ${amount}`;
  };
  window.AlMumezFormatCurrency = formatCurrency;
  const nav = [
    ["index.html", copy.home],
    ["about.html", copy.about],
    ["accessories.html", copy.products],
    ["blog.html", language === "ar" ? "المدونة" : "Blog"],
    ["contact.html", copy.contact]
  ];
  const isActive = href => page === href || (page === "products.html" && href === "accessories.html");
  const links = nav.map(([href,label,icon]) => `<a href="${href}" class="text-slate-600 hover:text-navy-dark font-semibold transition-colors duration-150 pb-1${isActive(href)?" is-active text-primary font-bold border-b-2 border-mumez-green":""}"${isActive(href)?' aria-current="page"':""}>${icon?`<span class="material-symbols-outlined">${icon}</span>`:""}<span>${label}</span></a>`).join("");

  host.dataset.component = "site-header";
  host.className = "sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-sm";
  host.innerHTML = `<div class="site-header-layout w-full max-w-7xl mx-auto px-margin py-3 flex flex-col gap-3">
    <div class="flex items-center justify-between gap-space-lg">
      <button class="mobile-menu-button md:hidden inline-flex items-center justify-center size-10 rounded-full border border-slate-200 text-navy-dark" type="button" aria-label="${copy.menu}" aria-expanded="false" aria-controls="mobile-navigation"><span class="material-symbols-outlined">menu</span></button>
      <a class="flex items-center shrink-0 transition-transform duration-200 active:scale-95" href="index.html" title="AlMumez Online Store"><div class="bg-white rounded-lg px-2 py-0.5 flex items-center justify-center"><img alt="AlMumez Online Store" class="h-10 md:h-12 w-auto object-contain block" src="assets/images/logo.png"></div></a>
      <form class="products-search flex-1 max-w-xl hidden md:flex items-center bg-slate-50 hover:bg-slate-100/90 rounded-full border border-slate-200 focus-within:border-mumez-green focus-within:ring-2 focus-within:ring-mumez-green/25 transition-all duration-200 px-4 py-1.5 shadow-inner" role="search" data-search-form><span class="material-symbols-outlined text-slate-400 text-xl mr-2">search</span><label class="sr-only" for="products-search-input">${copy.search}</label><input id="products-search-input" class="bg-transparent border-0 text-slate-800 placeholder:text-slate-400 focus:ring-0 w-full text-sm font-medium py-0.5" name="q" autocomplete="off" placeholder="${copy.search}" aria-controls="search-suggestions"><button class="products-search-clear" type="button" data-search-clear aria-label="Clear" hidden>×</button><button class="bg-mumez-green hover:bg-mumez-green-dark text-navy-dark hover:text-white font-extrabold px-5 py-1.5 rounded-full text-xs transition-all ml-1 shadow-sm flex items-center gap-1" type="submit"><span>${copy.searchButton}</span></button><div class="products-suggestions" id="search-suggestions" role="listbox" hidden></div></form>
      <div class="home-header-actions flex items-center gap-space-md shrink-0">
        <a class="home-header-wishlist home-action-icon" href="#" data-wishlist-open title="${copy.wishlist}" aria-label="${copy.wishlist}"><span class="material-symbols-outlined">favorite</span><span class="home-wishlist-count" data-wishlist-count>0</span></a>
        <div class="home-account-menu"><button class="home-action-icon home-account-trigger" type="button" title="${copy.account}" aria-label="${copy.account}" aria-expanded="false"><span class="material-symbols-outlined">person</span></button><div class="home-account-dropdown" hidden><a href="auth.html">${language === "ar" ? "تسجيل الدخول" : "Login"}</a><a href="admin.html">${copy.dashboard}</a></div></div>
        <button class="home-action-icon home-language-toggle" data-language-toggle title="${copy.language}" aria-label="${copy.language}" type="button"><span class="material-symbols-outlined">language</span><b class="home-language-badge" data-language-label>${language === "ar" ? "EN" : "AR"}</b></button>
        <button class="home-cart-button" type="button" data-cart-open title="${copy.cart}"><span class="material-symbols-outlined home-cart-icon">shopping_bag</span><span class="home-cart-copy"><span class="home-cart-meta" data-cart-count>0 ${copy.item}</span><strong class="home-cart-total" data-cart-total>${formatCurrency(0)}</strong></span></button>
      </div>
    </div>
    <nav id="mobile-navigation" class="home-navigation flex items-center justify-between border-t border-slate-100 pt-2 text-sm overflow-x-auto no-scrollbar" aria-label="${language === "ar" ? "التنقل الرئيسي" : "Main navigation"}"><div class="flex items-center gap-space-lg whitespace-nowrap">${links}<a class="mobile-menu-login text-slate-600 hover:text-navy-dark font-semibold transition-colors duration-150 pb-1" href="auth.html"><span class="material-symbols-outlined">login</span><span>${language === "ar" ? "تسجيل الدخول" : "Login"}</span></a><button class="mobile-menu-language" type="button" data-language-toggle><span class="material-symbols-outlined">language</span><span>${language === "ar" ? "English" : "العربية"}</span><b>${language === "ar" ? "EN" : "AR"}</b></button></div></nav>
  </div>`;
  const syncWishlistCount = () => {
    let items = [];
    try {
      const stored = JSON.parse(localStorage.getItem("almumez-wishlist") || "[]");
      if (Array.isArray(stored)) items = stored;
    } catch (_) {}
    host.querySelectorAll("[data-wishlist-count]").forEach(badge => {
      badge.textContent = String(items.length);
      badge.hidden = items.length === 0;
    });
  };
  window.AlMumezSyncWishlistCount = syncWishlistCount;
  syncWishlistCount();
  host.querySelectorAll(".home-language-badge, .home-wishlist-count").forEach(badge => {
    badge.style.setProperty("inset-inline-start", "auto", "important");
    badge.style.setProperty("inset-inline-end", "auto", "important");
    badge.style.setProperty("top", "-8px", "important");
    badge.style.setProperty("right", "-12px", "important");
    badge.style.setProperty("bottom", "auto", "important");
    badge.style.setProperty("left", "auto", "important");
    badge.style.setProperty("transform", "none", "important");
  });
  window.addEventListener("storage", event => {
    if (event.key === "almumez-wishlist") syncWishlistCount();
  });
  const menu=host.querySelector(".mobile-menu-button"),navigation=host.querySelector(".home-navigation");
  host.dataset.sharedNavigation="true";
  menu.addEventListener("click",()=>{const open=navigation.classList.toggle("is-open");menu.setAttribute("aria-expanded",String(open));menu.querySelector(".material-symbols-outlined").textContent=open?"close":"menu"});
  navigation.addEventListener("click",event=>{if(!event.target.closest("a,button"))return;navigation.classList.remove("is-open");menu.setAttribute("aria-expanded","false");menu.querySelector(".material-symbols-outlined").textContent="menu"});
  document.addEventListener("click",event=>{if(host.contains(event.target)||!navigation.classList.contains("is-open"))return;navigation.classList.remove("is-open");menu.setAttribute("aria-expanded","false");menu.querySelector(".material-symbols-outlined").textContent="menu"});
  const accountTrigger=host.querySelector(".home-account-trigger"),accountDropdown=host.querySelector(".home-account-dropdown");
  accountTrigger?.addEventListener("click",()=>{const open=accountDropdown.hidden;accountDropdown.hidden=!open;accountTrigger.setAttribute("aria-expanded",String(open))});
  document.addEventListener("click",event=>{if(!accountDropdown||accountDropdown.hidden||event.target.closest(".home-account-menu"))return;accountDropdown.hidden=true;accountTrigger.setAttribute("aria-expanded","false")});
  host.querySelectorAll("[data-language-toggle]").forEach(toggle=>toggle.addEventListener("click",event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    localStorage.setItem(LANGUAGE_KEY, language === "ar" ? "en" : "ar");
    location.reload();
  }));
  const settings = (() => { try { return JSON.parse(localStorage.getItem("almumez-site-settings") || "{}"); } catch { return {}; } })();
  const configuredNumber = String(settings.whatsappNumber || window.ALMUMEZ_CONFIG?.whatsappNumber || localStorage.getItem("almumez-whatsapp-number") || "").replace(/\D/g, "");
  document.querySelectorAll(".site-whatsapp-button").forEach(button => button.remove());
  const whatsapp = document.createElement("a");
  whatsapp.className = "site-whatsapp-button";
  whatsapp.href = configuredNumber ? `https://wa.me/${configuredNumber}` : "contact.html";
  if (configuredNumber) {
    whatsapp.target = "_blank";
    whatsapp.rel = "noopener noreferrer";
  }
  if (!configuredNumber) whatsapp.dataset.missingConfiguration = "true";
  whatsapp.setAttribute("aria-label", language === "ar" ? "تواصل معنا عبر واتساب" : "Contact us on WhatsApp");
  whatsapp.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3a13 13 0 0 0-11.1 19.8L3 29l6.4-1.8A13 13 0 1 0 16 3Zm0 23.6a10.6 10.6 0 0 1-5.4-1.5l-.4-.2-3.8 1 1-3.7-.2-.4A10.6 10.6 0 1 1 16 26.6Zm5.8-7.9c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1a8.7 8.7 0 0 1-4.3-3.8c-.3-.5.3-.5.9-1.7.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.6-.5-.8-.5h-.7c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9s1.2 3.3 1.4 3.5c.2.2 2.4 3.7 5.9 5.2 2.2.9 3.1 1 4.2.8.7-.1 1.9-.8 2.2-1.5.3-.7.3-1.3.2-1.5-.1-.1-.3-.2-.6-.4Z"/></svg>';
  document.body.append(whatsapp);
})();
