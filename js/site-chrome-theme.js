/* Opt in one page at a time; preserve the existing header's event handlers. */
(function () {
  'use strict';
  if (!document.body.matches('.catalog-theme')) return;
  const header = document.querySelector('[data-component="site-header"]');
  if (!header) return;
  header.classList.add('hb-header');
  header.querySelector('.shared-site-header-wrap')?.classList.remove('shared-site-header-wrap');
  header.querySelector('[data-search-form]')?.classList.add('hb-search');
  const wishlist = header.querySelector('[data-wishlist-open]');
  if (wishlist) {
    wishlist.querySelector('.material-symbols-outlined')?.remove();
    wishlist.insertAdjacentHTML('afterbegin', '<svg class="hb-wishlist-heart" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>');
    wishlist.setAttribute('href', 'accessories.html?wishlist=1');
  }
  // Use the same navigation order as home, without replacing bound menu nodes.
  const nav = header.querySelector('.home-navigation>div');
  if (nav) {
    const about = nav.querySelector('a[href="about.html"]');
    const products = nav.querySelector('a[href="accessories.html"]');
    if (about && products) products.after(about);
  }
  header.querySelectorAll('img').forEach(img => {
    img.width = 150;
    img.height = 48;
  });
  const ar = document.documentElement.lang === 'ar';
  const views = ar ? ['عرض مضغوط', 'عرض متوازن', 'عرض واسع'] : ['Compact view', 'Balanced view', 'Spacious view'];
  document.querySelectorAll('.products-view button').forEach((button, index) => button.setAttribute('aria-label', views[index]));
})();
