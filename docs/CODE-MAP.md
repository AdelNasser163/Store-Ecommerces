# خريطة ملفات المشروع

## الصفحات ومصدر التنسيق

صفحات HTML في الجذر لها عناوين ثابتة حتى لا تتغير روابط GitHub Pages. لا تُنقل الصفحات أو الصور الأصلية لتنظيف شكلي يكسر الروابط.

| الجزء | الملفات المصدر |
|---|---|
| هيدر وهوية مشتركة | `site-navigation.css`, `site-theme.css`, `js/site-navigation.js`, `js/site-theme.js` |
| هيرو الرئيسية | `hero-b.css`, `js/hero-b.js` |
| باقي الرئيسية | `page-theme.css`, `js/page-theme.js`, `mobile-product-rails.css` |
| كروت المنتجات المشتركة | `product-card.css`, `js/product-card.js` |
| عرض السلة والمفضلة المشترك | `cart-drawer.css`, `js/shared-drawers.js`؛ بناء الصفوف واحد لكل الصفحات، وأزراره تستخدم معالجات الصفحة الأصلية دون تغيير حساب الأسعار أو بيانات المنتجات |
| الكتالوج وصفحة المنتج | `products-page.css`, `js/products-page.js`, `product-detail.css` |
| صفحات المحتوى | `about-page.*`, `blog-page.*`, `contact-page.*` |
| إدارة الطلبات | `admin-orders.js` للوظائف، `admin-orders-view.js` للعرض، `admin-orders-theme.css` |
| الرسائل | `admin-contact.*`, `js/support-api.js`, `js/support-fields.js`, `support-config.js` |
| الداشبورد المشترك | `admin-ui.js`, `admin-shell.css` |
| الحركة وتعديلات الأداء | `js/fx.js`, `fx.css`, `performance.css` |
| الظهور الأول والتنقل الهادئ | `js/page-bootstrap.js` يحدد أول زيارة قبل الرسم، و`js/page-entry.js` يطبق ظهورًا متتابعًا 520ms/16–24px على 5 عناصر كحد أقصى؛ التنقل الداخلي والرجوع لا يعيدان حركة الدخول |
| الصور المتجاوبة | `assets/images/image-manifest.json`, `js/image-manifest.js`, `js/image-performance.js` |

`style.css` مدخل قديم مولّد من Tailwind؛ لا يعدل يدويًا. ترتيب ملفات التنسيق مهم: القواعد اللاحقة قد تكون تعديلات RTL أو موبايل، وليست تكرارًا يمكن حذفه.

## البناء والنشر

`tools/performance-pages.json` هو المصدر الوحيد لقائمة CSS/JS لكل صفحة. بعد إضافة ملف يجب ربطه في هذه القائمة، ثم تشغيل:

```sh
npm run build:performance
```

البناء يستبعد من **الحزمة الخاصة بكل صفحة** القواعد ذات الكلاسات غير الموجودة في HTML أو JavaScript الخاصين بها. يبقي الشروط والمحددات المعقدة بصورة تحفظية، ويزيل التطابق التام فقط. لا نعتمد على لقطة سطح المكتب وحدها لحذف كود قد يحتاجه الموبايل أو درج السلة أو الفلاتر.

`dist/` يحتوي ملفات مولّدة بأسماء hash، ولا يعدّل يدويًا. البناء يحدّث مراجع HTML ويحذف الإصدارات المولدة القديمة داخل dist فقط. كذلك فإن `perf-critical` وصور الهيرو المبكرة داخل HTML ناتج بناء. تعديلها يدويًا يُستبدل في البناء التالي.

مكتبات GSAP/Lenis/React Bits القديمة ليست ضمن قائمة تشغيل الصفحات. أصولها و`src-islands` محفوظة ككود سابق؛ لم نحذفها أو نضفها للتحميل. الحركة الحالية في `js/fx.js` باستخدام المتصفح، وتتحرك الصور عبر CSS.

## فحوص الصيانة

```sh
npm run css:audit
npm run check:hero
npm run check:site
node tools/orders-view-verify.cjs
node tools/support-verify.cjs
```

للمقارنة البصرية المحسوبة قبل تعديل CSS شغّل `node tools/perf-css-regression.cjs record`، وبعد البناء شغّل `node tools/perf-css-regression.cjs`. المقارنة تشمل الصفحات الـ16 عند 390/820/1440. يلزم Playwright/Chromium محليان؛ لا يتحملهما زائر الموقع.

الصور الأصلية محفوظة، والعرض يستخدم WebP وsrcset. عند إضافة صور جديدة حدّث manifest بالأداة `node tools/prepare-assets.cjs --images-only` ثم أعد البناء. صورة الهيرو الرئيسية eager/high priority؛ بقية الصور خارج الشاشة lazy. تغييرات اللغة والبيانات تحدث وصف صورة الهيرو مع إعادة استخدام عنصرها نفسه.
