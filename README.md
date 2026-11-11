# AlMumez Store

## Image storage (v3)

- Uploaded cover and gallery files are stored unchanged as `Blob` values in the browser's IndexedDB database `store-images` / `images`.
- `localStorage` contains only light references such as `idb:product-id/cover`.
- The first v3 load downloads a full JSON backup before migration. Dashboard Export JSON includes the original image data.
- Storage exists only in the current browser profile and device. Export before clearing browser data or moving devices, then import the JSON there.
- Images are not compressed, resized, re-encoded, or uploaded to a server. The limit is 15 MB per file.

Open `index.html` directly, or serve the folder with any static HTTP server.

## إزاي أضيف منتج جديد

1. افتح `admin.html` واستخدم كلمة السر المبدئية `admin123`.
2. اكتب اسم المنتج؛ الـID يتولد تلقائيًا من الاسم الإنجليزي ولا يحتاج إدخالًا يدويًا.
3. ارفع صورة المنتج، وأضف المواصفات من زر **Add specification**، واختر الأماكن من **Appears in** ثم احفظ.
4. المنتج يظهر تلقائيًا في السكاشن المختارة، و`products.html`، ويمكن فتحه في `product.html?id=<product-id>`.

الحماية الموجودة في صفحة الأدمن حماية مبدئية داخل المتصفح وليست أمانًا حقيقيًا. في الإنتاج يجب استخدام Backend وتسجيل دخول حقيقي. المنتجات المعدلة تحفظ في `localStorage`، ويمكن استخدام Export/Import JSON للنسخ الاحتياطي.

رفع الصور من الأدمن يحفظها كـ Data URL داخل `localStorage` مؤقتًا لأن المشروع لا يحتوي سيرفر رفع ملفات. للإنتاج ضع الصور في `assets/products/<id>/cover.jpg` و`gallery-1.jpg` إلى `gallery-4.jpg` ثم استخدم المسارات في النموذج.

## إزاي أضيف سكشن جديد يعرض منتجات

```html
<div data-products-section="home-new"></div>
```

أضف المكان إلى `STORE_PLACEMENTS` داخل `data/products.js`، ثم اعرض منتجاته من المصدر الموحد بفلترة `product.placements["home-new"]` وترتيبها بالقيمة المخزنة.

## الملفات الأساسية

- `data/products.js`: البيانات الافتراضية والـ placements.
- `data/store.js`: القراءة والكتابة والتوافق مع السلة وصفحة المنتج.
- `catalog.js`: بناء كروت المنتجات والسكاشن.
- `accessories.html`: صفحة المنتجات الأساسية باسم «المنتجات»، وتستخدم `catalog.js` و`main.js`، بينما يحتفظ `products.html` بتحويل توافق للرابط القديم.
- `products.js`: منطق كتالوج المنتجات القديم، تم الاحتفاظ به دون حذف.
- `auth.html` و`forgot-password.html` و`reset-password.html`: واجهات حساب العميل واستعادة كلمة المرور، ويجمع منطقها `auth.js`.
- `admin.html` و`admin.js`: إدارة المنتجات والتصدير والاستيراد.

## طبقة الحركة (GSAP + Lenis + React Bits)

- **Lenis** — سكرول ناعم لكل الصفحات (بيتوقف تلقائيًا لما الـ drawer يتفتح): `js/vendor/lenis.min.js`.
- **GSAP + ScrollTrigger** — أنيميشن الهيرو، ظهور السكاشن والكروت مع السكرول، شريط تقدّم، "طيران" المنتج للسلة، أزرار مغناطيسية، وانتقال ناعم بين الصفحات: `js/fx.js` + `fx.css`.
- **React Bits** — مكوّنات `LogoLoop` (شريط البراندات) و`SpotlightCard` + `CountUp` (الإحصائيات) و`Particles` (خلفية الهيرو) و`ClickSpark` (شرر عند الإضافة للسلة). مصدرها في `src-islands/` والناتج الجاهز `js/vendor/rb-islands.js` (مش محتاج build على GitHub Pages).
- كل الحركة بتحترم `prefers-reduced-motion`.

لتعديل مكوّنات React Bits: `npm install` ثم `npm run build:fx` وارفع الملفات الناتجة في `js/vendor/`.
