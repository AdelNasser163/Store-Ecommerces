/* Shared footer presentation and existing bilingual copy; no commerce logic. */
(function(){
 'use strict';
 const footer=document.querySelector('footer.products-footer');if(!footer)return;
 const logo=footer.querySelector('.products-footer-grid>section:first-child>img');if(logo)logo.src='assets/images/logo-footer.png';
 footer.querySelectorAll('a[href^="#"]').forEach(link=>{
  const text=document.createElement('span');text.append(...link.childNodes);
  if(link.id)text.id=link.id;
  const label=link.getAttribute('aria-label');if(label){text.setAttribute('role','img');text.setAttribute('aria-label',label)}
  link.replaceWith(text);
 });
 footer.querySelectorAll('.products-footer-grid>section>span').forEach(text=>text.classList.add('site-footer-label'));
 const sections=footer.querySelectorAll('.products-footer-grid>section');
 const copy={
  en:{description:'AlMumez Online Store is a certified regional distributor for genuine electronics, premium computing hardware, and smart lifestyle technology.',company:'Company',care:'Customer Care',payment:'Payment Options',companyLinks:['About Us','Careers','Press Releases','Privacy Policy','Terms of Service'],careLinks:['Help Center','Returns & Refunds','Track Order','Shipping & Delivery','Contact Support'],cash:'Cash on Delivery',rights:'All rights reserved. Authorized Regional Tech Distributor.',secure:'256-Bit SSL Encrypted',location:'Cairo, Egypt'},
  ar:{description:'متجر AlMumez Online Store موزع إقليمي معتمد للإلكترونيات الأصلية وأجهزة الكمبيوتر المتميزة وتقنيات الحياة الذكية.',company:'الشركة',care:'خدمة العملاء',payment:'خيارات الدفع',companyLinks:['من نحن','الوظائف','البيانات الصحفية','سياسة الخصوصية','شروط الخدمة'],careLinks:['مركز المساعدة','الاستبدال والاسترجاع','تتبع الطلب','الشحن والتوصيل','تواصل مع الدعم'],cash:'الدفع عند الاستلام',rights:'جميع الحقوق محفوظة. موزع إقليمي معتمد للتكنولوجيا.',secure:'تشفير آمن 256-Bit',location:'القاهرة، مصر'}
 };
 function translate(){
  const text=copy[document.documentElement.lang==='ar'?'ar':'en'];
  const set=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value};
  set(sections[0]?.querySelector('p'),text.description);
  [text.company,text.care,text.payment].forEach((title,index)=>set(sections[index+1]?.querySelector('h2'),title));
  [text.companyLinks,text.careLinks].forEach((labels,index)=>sections[index+1]?.querySelectorAll(':scope>a,:scope>.site-footer-label').forEach((node,i)=>set(node,labels[i])));
  set(footer.querySelector('.products-payments>span:last-child'),text.cash);
  const bottom=footer.querySelectorAll('.products-footer-bottom>p');
  set(bottom[0],`© ${new Date().getFullYear()} AlMumez Online Store. ${text.rights}`);
  if(bottom[1]){
   let icon=bottom[1].querySelector('.material-symbols-outlined');
   if(!icon){icon=document.createElement('span');icon.className='material-symbols-outlined';icon.textContent='lock'}
   bottom[1].replaceChildren(icon,document.createTextNode(` ${text.secure} · ${text.location}`));
  }
 }
 translate();
 new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
