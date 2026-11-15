(function(){
 const form=document.querySelector('[data-contact-form]');if(!form)return;
 const subject=form.elements.subject,order=form.elements.orderNumber,orderWrap=order.closest('.contact-field');
 form.elements.name.maxLength=100;form.elements.email.maxLength=254;order.maxLength=80;
 const wrap=document.createElement('div');wrap.className='contact-field';
 const label=document.createElement('label');label.htmlFor='contact-product';
 const input=document.createElement('input');input.id='contact-product';input.name='productName';input.maxLength=160;input.type='text';
 wrap.append(label,input);orderWrap.after(wrap);
 function update(){const ar=document.documentElement.lang==='ar';label.textContent=ar?'اسم المنتج (اختياري)':'Product name (optional)';input.placeholder=ar?'اسم أو موديل المنتج':'Product name or model';orderWrap.hidden=!['order','returns'].includes(subject.value);order.disabled=orderWrap.hidden;wrap.hidden=!['product','returns'].includes(subject.value);input.disabled=wrap.hidden;}
 subject.addEventListener('change',update);form.addEventListener('reset',()=>queueMicrotask(update));document.querySelectorAll('[data-topic]').forEach(button=>button.addEventListener('click',update));new MutationObserver(update).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});update();
})();
