/* Build-time components: static HTML on Pages, no fetch or replacement on load. */
import fs from 'node:fs';
const header = fs.readFileSync('templates/site-header.html', 'utf8').trim();
const footer = fs.readFileSync('templates/site-footer.html', 'utf8').trim();

export function siteComponents(html, page, meta) {
  const home = page === 'index.html';
  if (home || meta.scripts.includes('shared-site-header.js')) {
    let markup = header;
    if (!home) {
      // Preserve the catalog's search and action contracts; appearance is shared.
      markup = markup.replace(/hb-search-input/g, 'products-search-input')
        .replace(/<div\s+class="hb-search([^\"]*)">/, '<form class="products-search$1" role="search" data-search-form>')
        .replace(/(<form\b[\s\S]*?)<\/div>/, '$1<div class="products-suggestions" id="search-suggestions" role="listbox" hidden></div></form>')
        .replace('type="text"', 'type="text" name="q" autocomplete="off" aria-controls="search-suggestions"')
        .replace(/(<form[\s\S]*?<button)/, '$1 type="submit"')
        .replace(/(<form[\s\S]*?)(<button type="submit")/, '$1<button class="products-search-clear" type="button" data-search-clear aria-label="Clear" hidden>×</button>$2')
        .replace(/<a class="home-action-icon" href="auth.html"[\s\S]*?<\/a>/,
          '<div class="home-account-menu"><button class="home-action-icon home-account-trigger" type="button" title="Account" aria-label="Account" aria-expanded="false"><span class="material-symbols-outlined">person</span></button><div class="home-account-dropdown" hidden><a href="auth.html">Login</a><a href="admin.html">Dashboard</a></div></div>')
        .replace(/<div class="home-action-icon home-language-toggle"([\s\S]*?)<\/div>/,
          '<button class="home-action-icon home-language-toggle" type="button" data-language-toggle $1</button>')
        .replace('class="home-language-badge"', 'class="home-language-badge" data-language-label')
        .replace('class="home-wishlist-count"', 'class="home-wishlist-count" data-wishlist-count')
        .replace('title="Wishlist"', 'data-wishlist-open title="Wishlist"')
        .replace('title="Shopping Cart"', 'data-cart-open title="Shopping Cart"')
        .replace('class="home-cart-meta"', 'class="home-cart-meta" data-cart-count')
        .replace('class="home-cart-total"', 'class="home-cart-total" data-cart-total')
        .replace(/(<\/div>\s*<\/nav>)/,
          '<a class="mobile-menu-login text-slate-600 hover:text-navy-dark font-semibold transition-colors duration-150 pb-1" href="auth.html"><span class="material-symbols-outlined">login</span><span>Login</span></a><button class="mobile-menu-language" type="button" data-language-toggle><span class="material-symbols-outlined">language</span><span>العربية</span><b>AR</b></button>$1');
    }
    markup = markup.replace(/<a\b[^>]*href="(?:index|accessories|about|blog|contact)\.html"[^>]*>/g, tag => {
      if (!tag.includes('pb-1')) return tag;
      tag = tag.replace(/text-primary font-bold border-b-2 border-mumez-green pb-1 flex items-center gap-1/, 'text-slate-600 hover:text-navy-dark font-semibold transition-colors duration-150 pb-1');
      return tag.includes(`href="${page}"`) ? tag.replace('class="', 'aria-current="page" class="is-active ') : tag;
    });
    const siteHeader=/<header\b(?=[^>]*(?:data-component="site-header"|data-products-header))[^>]*>[\s\S]*?<\/header>/;
    html = siteHeader.test(html)
      ? html.replace(siteHeader, markup)
      : html.replace(/<body\b[^>]*>/, '$&' + markup);
  }
  if (meta.scripts.includes('shared-site-footer.js')) {
    const siteFooter=/<footer\b(?=[^>]*(?:data-component="site-footer"|class="products-footer"))[^>]*>[\s\S]*?<\/footer>/;
    html = siteFooter.test(html)
      ? html.replace(siteFooter, footer)
      : html.replace('</body>', footer + '</body>');
  }
  return html;
}
