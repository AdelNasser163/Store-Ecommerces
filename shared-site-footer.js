/* Footer structure: templates/site-footer.html. Translation: js/site-theme.js. */
(function(){
  'use strict';
  const footer=document.querySelector('[data-component="site-footer"]');
  const year=footer?.querySelector('[data-current-year]');
  if(year)year.textContent=new Date().getFullYear();
})();
