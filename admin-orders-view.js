(function(){
 'use strict';
 const list=document.querySelector('[data-orders-list]');if(!list||sessionStorage.getItem('almumez-admin')!=='1')return;
 const ar=window.AdminUI?.language!=='en',t=(a,b)=>ar?a:b;
 const states=['new','processing','shipping','completed'],labels=ar?['جديد','قيد التجهيز','جاري التوصيل','مكتمل']:['New','Preparing','Shipping','Completed'];
 const toolbar=document.createElement('div');toolbar.className='ao-toolbar';toolbar.setAttribute('translate','no');
 toolbar.innerHTML=`<div><h2>${t('سجل الطلبات','Order register')}</h2><p data-ao-count role="status"></p></div><label>${t('ترتيب الطلبات','Sort orders')}<select aria-label="${t('ترتيب الطلبات','Sort orders')}"><option value="newest">${t('الأحدث أولًا','Newest first')}</option><option value="oldest">${t('الأقدم أولًا','Oldest first')}</option><option value="highest">${t('الأعلى قيمة','Highest value')}</option></select></label>`;list.before(toolbar);
 const intro=document.createElement('p');intro.className='ao-intro';intro.textContent=t('بيانات العميل والمنتجات وخطوات التنفيذ، بشكل واضح لكل طلب.','Review customer details, ordered products and fulfilment steps for every order.');intro.setAttribute('translate','no');document.querySelector('.orders-admin-header h1').parentElement.append(intro);
 const badge=document.querySelector('.orders-breadcrumb i');badge.textContent=t('بيانات هذا المتصفح','Data from this browser');badge.setAttribute('translate','no');
 const search=document.querySelector('[data-orders-search]'),filters=document.querySelector('[data-orders-filters]'),reset=document.querySelector('.orders-search button');reset.title=t('مسح البحث والفلاتر','Clear search and filters');reset.setAttribute('aria-label',reset.title);reset.innerHTML='<span class="material-symbols-outlined" aria-hidden="true">close</span>';reset.onclick=()=>{search.value='';toolbar.querySelector('select').value='newest';filters.querySelector('[data-status="all"]').click();search.focus();};
 function data(){try{const rows=JSON.parse(localStorage.getItem('store-orders-v1')||'[]');return Array.isArray(rows)?rows:[];}catch{return[];}}
 const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;};
 const money=value=>`${Math.round(Number(value)||0).toLocaleString('en-US')} ${t('ج.م','EGP')}`;
 function enhance(){observer.disconnect();try{
  const rows=data(),cards=Array.from(list.querySelectorAll('.order-admin-card'));
  for(const card of cards){if(card.dataset.organized)continue;card.dataset.organized='true';card.classList.add('ao-order');
   const order=rows.find(o=>String(o.id)===card.dataset.orderId)||{},header=card.querySelector('header'),customer=card.querySelector('.order-customer'),products=card.querySelector('.order-products'),footer=card.querySelector('footer'),status=card.querySelector('.order-status');
   const current=states.findIndex(s=>status?.classList.contains(s));const progress=document.createElement('ol');progress.className='ao-progress';progress.setAttribute('translate','no');progress.setAttribute('aria-label',t('مراحل الطلب','Order progress'));
   states.forEach((s,i)=>{const li=document.createElement('li');li.className=i<=current?'is-done':'';if(i===current){li.classList.add('is-current');li.setAttribute('aria-current','step');}const dot=document.createElement('span');dot.textContent=i<current?'✓':String(i+1);dot.setAttribute('aria-hidden','true');li.append(dot,labels[i]);progress.append(li);});header.after(progress);
   const body=document.createElement('div');body.className='ao-order-body';progress.after(body);body.append(customer,products);
   const heading=document.createElement('h3');heading.textContent=t('بيانات العميل','Customer details');heading.className='ao-section-label';heading.setAttribute('translate','no');customer.prepend(heading);
   const tracking=card.querySelector('.order-tracking');if(tracking)customer.append(tracking);
   const total=document.createElement('section');total.className='ao-total';total.append(footer.firstElementChild);body.append(total);
   const details=footer.querySelector('[data-details]');if(details)total.append(details);
   const actionHint=document.createElement('span');actionHint.className='ao-action-hint';actionHint.textContent=labels[current]||labels[0];actionHint.setAttribute('translate','no');footer.prepend(actionHint);
   // Preserve customer text exactly; the shared dashboard translator owns labels only.
   customer.querySelectorAll('b,small').forEach(n=>{if(!n.querySelector('.material-symbols-outlined'))return;if(n.closest('.order-customer>div:first-of-type'))n.setAttribute('translate','no');});
   products.querySelectorAll('div>span').forEach(n=>n.setAttribute('translate','no'));
   if(!footer.querySelector('[data-next]')){const done=document.createElement('span');done.className='ao-done';done.textContent='✓ '+labels[3];done.setAttribute('translate','no');footer.lastElementChild.append(done);}
   // A clear order identity, itemized products and a separate financial summary.
   card.classList.add('ao-order--refined');
   const identity=header.firstElementChild;identity.classList.add('ao-identity');
   const reference=identity.querySelector('strong');reference.setAttribute('dir','ltr');reference.setAttribute('translate','no');
   const referenceLabel=node('span','ao-reference-label',t('رقم الطلب','Order reference'));referenceLabel.setAttribute('translate','no');identity.prepend(referenceLabel);
   const orderIcon=node('span','ao-order-icon','#');orderIcon.setAttribute('aria-hidden','true');header.prepend(orderIcon);
   const payment=customer.querySelector('div:nth-of-type(2) b')?.textContent||'—';
   customer.replaceChildren();customer.setAttribute('translate','no');customer.append(node('h3','ao-section-label',t('العميل والتوصيل','Customer & delivery')));
   const customerIdentity=node('div','ao-customer-identity'),avatar=node('span','ao-customer-avatar',Array.from(String(order.customer?.name||'?'))[0]);avatar.setAttribute('aria-hidden','true');const person=node('div');person.append(node('b','',order.customer?.name||'—'),node('small','ao-customer-caption',t('صاحب الطلب','Order customer')));customerIdentity.append(avatar,person);customer.append(customerIdentity);
   for(const [label,value] of [[t('رقم الهاتف','Phone number'),order.customer?.phone],[t('التوصيل إلى','Deliver to'),[order.customer?.city,order.customer?.address].filter(Boolean).join('، ')],[t('طريقة الدفع','Payment method'),payment]]){const field=node('div','ao-customer-field');field.append(node('small','',label),node('span','',value||'—'));customer.append(field);}
   if(order.tracking){const field=node('div','ao-customer-field');field.append(node('small','',t('مندوب الشحن','Courier')),node('span','',order.tracking));customer.append(field);}
   products.replaceChildren();products.setAttribute('translate','no');const items=Array.isArray(order.items)?order.items:[];
   const productsTitle=node('div','ao-items-title');productsTitle.append(node('h3','',t('ملخص المنتجات','Product summary')),node('span','',`${items.length} ${t('منتج','products')}`));products.append(productsTitle);
   const columns=node('div','ao-items-columns');[t('المنتج','Product'),t('الكمية','Qty'),t('الإجمالي','Total')].forEach(label=>columns.append(node('span','',label)));products.append(columns);
   let subtotal=0;items.forEach((item,index)=>{const quantity=Number(item.quantity)||1,line=Number(item.price||0)*quantity;subtotal+=line;const row=node('div','ao-item-row'),description=node('div','ao-item-description'),number=node('span','ao-item-number',String(index+1).padStart(2,'0')),copy=node('div');copy.append(node('b','',item.name||'—'),node('small','',`${t('سعر الوحدة','Unit price')}: ${money(item.price)}`));description.append(number,copy);row.append(description,node('span','ao-item-quantity',String(quantity)),node('strong','ao-item-amount',money(line)));products.append(row);});
   const breakdown=node('div','ao-breakdown');breakdown.setAttribute('translate','no');const subtotalRow=node('div');subtotalRow.append(node('span','',t('قيمة المنتجات','Products subtotal')),node('b','',money(subtotal)));breakdown.append(subtotalRow);const adjustment=Number(order.total||0)-subtotal;if(adjustment!==0){const fees=node('div');fees.append(node('span','',t('الشحن والتعديلات','Shipping & adjustments')),node('b','',money(adjustment)));breakdown.append(fees);}total.prepend(breakdown);total.setAttribute('translate','no');
   const amount=total.querySelector(':scope>div:not(.ao-breakdown)');amount.classList.add('ao-grand-total');amount.querySelector('small').textContent=t('إجمالي الطلب','Order total');
   const nextHint=[t('ابدأ تجهيز المنتجات المطلوبة','Start preparing the ordered items'),t('الطلب في مرحلة التجهيز','Order preparation in progress'),t('أكّد التسليم عند استلام العميل','Confirm delivery once the customer receives it'),t('اكتمل تسليم هذا الطلب','This order has been delivered')];actionHint.textContent=nextHint[current]||labels[0];
   const print=footer.querySelector('[data-print]');print.append(document.createTextNode(t('طباعة الطلب','Print order')));print.setAttribute('translate','no');
   body.after(progress);
   card.dataset.sortDate=String(Date.parse(order.createdAt)||0);card.dataset.sortTotal=String(Number(order.total)||0);
  }
  const sort=toolbar.querySelector('select').value;cards.sort((a,b)=>sort==='highest'?Number(b.dataset.sortTotal)-Number(a.dataset.sortTotal):sort==='oldest'?Number(a.dataset.sortDate)-Number(b.dataset.sortDate):Number(b.dataset.sortDate)-Number(a.dataset.sortDate));const fragment=document.createDocumentFragment();cards.forEach(c=>fragment.append(c));list.append(fragment);
  toolbar.querySelector('[data-ao-count]').textContent=`${cards.length} ${t('طلب مطابق للعرض الحالي','orders in the current view')}`;
 }finally{observer.observe(list,{childList:true});}}
 const observer=new MutationObserver(enhance);toolbar.querySelector('select').onchange=enhance;enhance();
 const modal=document.querySelector('[data-order-modal]'),content=modal.querySelector('[data-modal-content]');
 const detailObserver=new MutationObserver(()=>{detailObserver.disconnect();try{const title=content.querySelector('h2');if(!title)return;title.id='ao-order-detail-title';modal.setAttribute('aria-labelledby',title.id);const order=data().find(o=>title.textContent.endsWith(String(o.id)));const card=Array.from(list.children).find(c=>c.dataset.orderId===String(order?.id));if(!card)return;const meta=document.createElement('div');meta.className='ao-detail-meta';Array.from(content.querySelectorAll(':scope>p')).forEach(p=>meta.append(p));title.after(card.querySelector('.ao-progress').cloneNode(true),meta);const items=card.querySelector('.order-products').cloneNode(true);items.className='ao-detail-products';content.append(items);}finally{detailObserver.observe(content,{childList:true});}});detailObserver.observe(content,{childList:true});
})();
