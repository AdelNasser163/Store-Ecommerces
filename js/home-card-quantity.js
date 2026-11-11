(function () {
  'use strict';
  if (!document.body.classList.contains('pg-page')) return;
  let frame = 0;
  function sync() {
    frame = 0;
    let cart;
    try { cart = JSON.parse(localStorage.getItem('cartItems') || '[]'); } catch { cart = []; }
    if (!Array.isArray(cart)) cart = [];
    const products = window.StoreProducts?.read() || [];
    const ar = document.documentElement.lang === 'ar';
    document.querySelectorAll('main .hb-card[data-product-id]').forEach(card => {
      const actions = card.querySelector('.hb-card-actions');
      const product = products.find(item => String(item.id) === card.dataset.productId);
      let add = actions?.querySelector('[data-add-to-cart]');
      if (actions && !add && product) {
        const template = document.createElement('template');
        template.innerHTML = window.AlMumezProductCard.render(product);
        add = template.content.querySelector('[data-add-to-cart]');
        if (add) actions.prepend(add);
      }
      if (!add) return;
      const lines = cart.filter(item => String(item.id) === card.dataset.productId && !item.isBundle && Number(item.quantity) > 0);
      const quantity = lines.reduce((sum, item) => sum + Number(item.quantity), 0);
      let stepper = actions.querySelector('[data-home-card-quantity]');
      const focused = document.activeElement;
      add.hidden = quantity > 0;
      // The original button remains mounted for the existing cart and fly-to-cart handlers.
      if (!quantity) {
        const restoreFocus = stepper?.contains(focused);
        stepper?.remove();
        if (restoreFocus) add.focus({preventScroll:true});
        return;
      }
      if (!stepper) {
        stepper = document.createElement('div');
        stepper.className = 'product-stepper hb-card-stepper';
        stepper.dataset.homeCardQuantity = '';
        stepper.innerHTML = '<button type="button" data-quantity="1" data-delta="1">+</button><b></b><button type="button" data-quantity="-1" data-delta="-1">−</button>';
        add.after(stepper);
      }
      const first = lines[0], last = lines[lines.length - 1];
      const variant = product?.variants?.find(item => String(item.id) === String(first.storage));
      const plus = stepper.firstElementChild, minus = stepper.lastElementChild;
      plus.dataset.id = first.key || first.id;
      minus.dataset.id = last.key || last.id;
      plus.disabled = Number(first.quantity) >= Math.max(0, Number(variant?.stock ?? product?.stock ?? 0));
      plus.setAttribute('aria-label', ar ? 'زيادة الكمية' : 'Increase quantity');
      minus.setAttribute('aria-label', ar ? 'تقليل الكمية' : 'Decrease quantity');
      stepper.querySelector('b').textContent = quantity;
      if (focused === add) plus.focus({preventScroll:true});
    });
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(sync); }
  function mount() {
    const drawer = document.querySelector('[data-cart-items]');
    if (drawer) new MutationObserver(schedule).observe(drawer, {childList:true, subtree:true});
    new MutationObserver(schedule).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
    window.addEventListener('storage', schedule);
    window.addEventListener('pageshow', schedule);
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
