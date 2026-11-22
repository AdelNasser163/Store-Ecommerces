/* Before first paint: apply only the saved admin theme, never storefront colors. */
(function(){try{const raw=localStorage.getItem('almumez-admin-theme'),theme=raw?JSON.parse(raw):'light';document.documentElement.dataset.adminTheme=theme==='dark'?'dark':'light'}catch{document.documentElement.dataset.adminTheme='light'}})();
