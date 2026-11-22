/* Shared commerce preferences. Defaults preserve the existing checkout behavior. */
(function(){
 'use strict';let settings={};try{settings=JSON.parse(localStorage.getItem('almumez-site-settings')||'{}')}catch{}
 const shipping={express:150,standard:0,pickup:0,...settings.shipping},paymentMethods={card:true,cod:true,valu:true,...settings.paymentMethods};
 if(!Object.values(paymentMethods).some(Boolean))paymentMethods.card=true;
 window.StorefrontSettings={shipping,paymentMethods};
 document.querySelectorAll('[data-delivery]').forEach(button=>{const price=Number(shipping[button.dataset.delivery])||0;button.dataset.price=String(price);const copy=button.querySelector('strong');if(copy)copy.textContent=price?`${price.toLocaleString('en-EG')} EGP`:'Free'});
 const defaultPayment=Object.keys(paymentMethods).find(key=>paymentMethods[key]);
 document.querySelectorAll('[data-payment]').forEach(button=>{button.hidden=!paymentMethods[button.dataset.payment];button.classList.toggle('is-selected',button.dataset.payment===defaultPayment)});
 window.StorefrontSettings.defaultPayment=defaultPayment;
 const cardFields=document.querySelector('[data-card-fields]');if(cardFields)cardFields.hidden=defaultPayment!=='card';
})();
