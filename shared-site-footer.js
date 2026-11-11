(function(){
  "use strict";
  let footer=document.querySelector('[data-component="site-footer"],.products-footer');
  if(!footer&&!document.body.matches('[data-page^="admin"],.admin-dashboard-page,.admin-orders-page,.admin-products-page,.admin-bundles-page')){footer=document.createElement('footer');document.body.append(footer)}
  if(!footer)return;
  const storedLanguage=localStorage.getItem("almumez-language"),language=storedLanguage==="en"||storedLanguage==='"en"'?"en":"ar";
  localStorage.setItem("almumez-language",language);
  document.documentElement.lang=language;document.documentElement.dir=language==="ar"?"rtl":"ltr";
  const copy=language==="ar"?{
    description:"متجر AlMumez Online Store موزع إقليمي معتمد للإلكترونيات الأصلية وأجهزة الكمبيوتر المتميزة وتقنيات الحياة الذكية.",company:"الشركة",about:"من نحن",care:"خدمة العملاء",support:"تواصل مع الدعم",payment:"خيارات الدفع",cash:"الدفع عند الاستلام",rights:"جميع الحقوق محفوظة. موزع إقليمي معتمد للتكنولوجيا.",secure:"تشفير آمن 256-Bit",location:"القاهرة، مصر"
  }:{description:"AlMumez Online Store is a certified regional distributor for genuine electronics, premium computing hardware, and smart lifestyle technology.",company:"Company",about:"About Us",care:"Customer Care",support:"Contact Support",payment:"Payment Options",cash:"Cash on Delivery",rights:"All rights reserved. Authorized Regional Tech Distributor.",secure:"256-Bit SSL Encrypted",location:"Cairo, Egypt"};
  Object.assign(copy,language==="ar"?{
    careers:"الوظائف",press:"البيانات الصحفية",privacy:"سياسة الخصوصية",terms:"شروط الخدمة",help:"مركز المساعدة",returns:"الاستبدال والاسترجاع",tracking:"تتبع الطلب",shipping:"الشحن والتوصيل"
  }:{careers:"Careers",press:"Press Releases",privacy:"Privacy Policy",terms:"Terms of Service",help:"Help Center",returns:"Returns & Refunds",tracking:"Track Order",shipping:"Shipping & Delivery"});
  footer.dataset.component="site-footer";
  footer.className="products-footer";
  footer.innerHTML=`<div class="products-footer-grid">
    <section><img src="assets/images/logo-footer.png" alt="AlMumez Online Store" width="150" height="60"><p>${copy.description}</p><div class="products-social">
      <a href="#" aria-label="Facebook"><span class="material-symbols-outlined">public</span></a>
      <a href="#" aria-label="Instagram"><span class="material-symbols-outlined">photo_camera</span></a>
      <a href="#" aria-label="LinkedIn"><span class="material-symbols-outlined">business_center</span></a>
      <a href="#" aria-label="YouTube"><span class="material-symbols-outlined">play_circle</span></a>
    </div></section>
    <section><h2>${copy.company}</h2><a href="about.html">${copy.about}</a><a href="#careers">${copy.careers}</a><a href="#press">${copy.press}</a><a id="privacy" href="#privacy">${copy.privacy}</a><a id="terms" href="#terms">${copy.terms}</a></section>
    <section><h2>${copy.care}</h2><a href="#help">${copy.help}</a><a href="#returns">${copy.returns}</a><a href="#tracking">${copy.tracking}</a><a href="#shipping">${copy.shipping}</a><a href="contact.html">${copy.support}</a></section>
    <section><h2>${copy.payment}</h2><div class="products-payments"><span>Visa</span><span>Mastercard</span><span>Meeza</span><span>ValU</span><span>${copy.cash}</span></div><p><bdi>Commercial Registry: #198273</bdi><br><bdi>Tax Registration: 492-811-002</bdi></p></section>
  </div><div class="products-footer-bottom"><p>© <span data-current-year></span> AlMumez Online Store. ${copy.rights}</p><p><span class="material-symbols-outlined">lock</span> <span>${copy.secure}</span> · <span>${copy.location}</span></p></div>`;
  const year=footer.querySelector('[data-current-year]');if(year)year.textContent=new Date().getFullYear();
})();
