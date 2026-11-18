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
  // Markup is generated from templates/site-header.html at build time.
  const labels=[copy.home,copy.products,copy.about,language==='ar'?'المدونة':'Blog',copy.contact];
  host.querySelectorAll('.home-navigation>div>a:not(.mobile-menu-login)').forEach((link,index)=>{link.textContent=labels[index]||link.textContent});
  host.querySelector('.mobile-menu-button').setAttribute('aria-label',copy.menu);
  host.querySelector('.home-navigation').setAttribute('aria-label',language==='ar'?'التنقل الرئيسي':'Main navigation');
  const search=host.querySelector('input');search.placeholder=copy.search;
  host.querySelector('label').textContent=copy.search;
  host.querySelector('[data-search-form] button[type=submit] span').textContent=copy.searchButton;
  const wish=host.querySelector('[data-wishlist-open]');wish.title=copy.wishlist;wish.setAttribute('aria-label',copy.wishlist);
  const account=host.querySelector('.home-account-trigger');account.title=copy.account;account.setAttribute('aria-label',copy.account);
  const login=language==='ar'?'تسجيل الدخول':'Login';
  host.querySelector('.home-account-dropdown a').textContent=login;
  host.querySelector('.home-account-dropdown a[href="admin.html"]').textContent=copy.dashboard;
  host.querySelector('.mobile-menu-login span:last-child').textContent=login;
  host.querySelector('[data-language-label]').textContent=language==='ar'?'EN':'AR';
  host.querySelector('.mobile-menu-language span:not(.material-symbols-outlined)').textContent=language==='ar'?'English':'العربية';
  host.querySelector('.mobile-menu-language b').textContent=language==='ar'?'EN':'AR';
  host.querySelector('.home-language-toggle').setAttribute('aria-label',copy.language);
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
