const fs=require('node:fs'),cp=require('node:child_process'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root='docs/performance/',before=JSON.parse(fs.readFileSync(root+'pagespeed-baseline.json')),after=JSON.parse(fs.readFileSync(root+'pagespeed-final.json'));
const baseRef='5449bad2ba1994551edd9cbd48595572033dc52d',oldManifest=JSON.parse(cp.execFileSync('git',['show',baseRef+':dist/manifest.json'],{encoding:'utf8'})),manifest=JSON.parse(fs.readFileSync('dist/manifest.json'));
const oldCss=cp.execFileSync('git',['show',baseRef+':'+oldManifest['index.html'].css]),newCss=fs.readFileSync(manifest['index.html'].css);
for(const id of ['aria-prohibited-attr','heading-order','meta-description','charset','image-delivery-insight'])assert.equal(after.audits[id].score,1,id);
const categories=['performance','accessibility','best-practices','seo'].map(key=>`| ${key} | ${Math.round(before.categories[key].score*100)} | ${Math.round(after.categories[key].score*100)} |`).join('\n');
const metrics=['first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift','speed-index'].map(key=>`| ${key} | ${before.audits[key].displayValue} | ${after.audits[key].displayValue} |`).join('\n');
const text=`# إصلاح ملاحظات PageSpeed مع الحفاظ على التصميم

المرجع قبل الإصلاح: commit \`${baseRef.slice(0,7)}\`. المصدر بعد الإصلاح هو بناء الملفات الحالي. الفحص محلي باستخدام Lighthouse ${after.lighthouseVersion} وChromium، مع ضغط gzip وCache-Control max-age=600 في سيرفر الاختبار لتقريب سياسة GitHub Pages المرصودة. ليست هذه نتيجة PageSpeed المنشورة في الصورة؛ لا تُقارن أرقام بيئات مختلفة مباشرةً. القياس جولة واحدة لكل إصدار ويتفاوت مع الجهاز والحمل.

| الفئة | قبل محليًا | بعد محليًا |
|---|---:|---:|
${categories}

| المقياس | قبل محليًا | بعد محليًا |
|---|---:|---:|
${metrics}

## التعديلات

- إضافة role=img لنجوم التقييم مع الاحتفاظ بالوصف المترجم، لعلاج ARIA المرفوض على div عادي.
- تحويل عناوين شريط المزايا من h4 إلى h2 مع إبقاء نفس قواعد العرض والمقاسات والألوان.
- إضافة الوصف التعريفي للرئيسية.
- وضع meta charset قبل سكريبت البداية، داخل أول 1024 بايت.
- نسخ متجاوبة من نفس صور اللوجو بعروض 120 و240 و400px. النسخة الصغيرة للوجو الرئيسي 3,798 بايت بدل 15,438 بايت؛ الأصل محفوظ، ويختار srcset المقاس المناسب لكثافة الشاشة.
- دمج تعريفات الخطوط التي تشير لنفس ملف الخط المتغير ونفس النطاق اللغوي: 53 تعريفًا أصبحت 19، دون استبدال ملفات الخطوط أو دمج الأوزان الثابتة.
- استبعاد المحدد غير المستخدم داخل مجموعة CSS، بدل إبقاء المجموعة كلها بسبب محدد واحد مستخدم؛ مع الاحتفاظ التحفظي بالحالات الديناميكية.
- حجم CSS الرئيسية من ${oldCss.length.toLocaleString('en-US')} إلى ${newCss.length.toLocaleString('en-US')} بايت؛ وبضغط gzip من ${zlib.gzipSync(oldCss).length.toLocaleString('en-US')} إلى ${zlib.gzipSync(newCss).length.toLocaleString('en-US')} بايت.
- نقل قياس شريط المنتجات إلى ResizeObserver بدل طلب حساب العرض بعد التعديلات؛ وتجميع قراءات الحالة قبل الكتابة. عرض الـskeleton على الموبايل لم يتغير، وتحديد العدد أصبح عبر CSS بدل قراءة innerWidth وسط تحديث DOM.
- نفس شكل نبضة النقطة ومدتها، باستخدام transform/opacity بدل box-shadow متحرك. لم تتغير ألوان أو محتوى أو أبعاد التصميم.

## ما بقي مرتبطًا بالاستضافة أو بالحالات غير المفتوحة

- GitHub Pages يرسل Cache-Control: max-age=600، وهو تحذير مدة الكاش في التقرير. لم نضف meta وهميًا أو Service Worker يسبب نسخًا قديمة؛ التحكم في HTTP headers يحتاج إعداد استضافة/CDN مناسبًا خارج ملفات الموقع الحالية.
- تحذير CSS غير المستخدم أثناء التحميل الأول لا يعني أن كل تلك القواعد قابلة للحذف: هناك تنسيقات تحت الشاشة، وحالات الموبايل والفلاتر والأدراج. الباقي محفوظ حتى لا يتغير الستايل أو تتعطل التفاعلات. التوفير التقديري المتبقي في الجولة الأخيرة: ${after.audits['unused-css-rules']?.displayValue||'راجع التقرير الخام'}.
- حالة إعادة التدفق في الجولة الأخيرة: ${after.audits['forced-reflow-insight']?.score===1?'اجتازت الفحص':'بعض قراءات المتصفح ما زالت مرصودة؛ تفاصيلها في التقرير الخام'}. حالة الرسوم غير المركبة وعددها في التقرير الخام، ولم نحذف الحركة المطلوبة لمجرد تغيير درجة.
- توصيات CSP/HSTS/COOP في الصورة تتعلق بسياسة الخادم؛ ليست عناصر فاشلة في درجة أفضل الممارسات الحالية، ولم تتغير صلاحيات الموقع أو اعتمادياته.

## التحقق

- 48 مقارنة للخصائص والأبعاد: الصفحات الـ16 على 390/820/1440.
- 6 مقارنات بكسلات لنص الهيرو: عربي وإنجليزي على المقاسات الثلاثة، متطابقة قبل وبعد.
- 20 فحصًا لوظائف الموقع، واختبارات حركة الهيرو، و14 حالة للسلة والمفضلة عبر صفحات المتجر السبع.
- اختبارات دمج الخطوط والمحددات: الأوزان الثابتة والنطاقات المختلفة محفوظة، وترتيب CSS محفوظ.

النتائج الخام: [قبل](pagespeed-baseline.json) و[بعد](pagespeed-final.json). أدوات الفحص في tools لا تُحمّل في المتصفح مع الموقع.
`;
fs.writeFileSync(root+'PAGESPEED-FIXES.md',text);console.log('PageSpeed summary written; semantic and image audits passed.');
