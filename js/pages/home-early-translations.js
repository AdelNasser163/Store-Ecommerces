(function () {
  if (document.documentElement.lang !== "ar") return;
  const entries = [
    ["Authorized tech distributor · Egypt", "موزع تقني معتمد · مصر"],
    ["24h Express Delivery", "توصيل سريع خلال 24 ساعة"],
    ["View today's deals", "شاهد عروض اليوم"],
    ["Official warranty", "ضمان رسمي"],
    ["Explore products", "اكتشف المنتجات"],
    ["Express delivery", "توصيل سريع"],
    ["Shop by category", "تسوق حسب القسم"],
    ["The tech you", "التقنية التي"],
    ["Easy returns", "استرجاع سهل"],
    ["24h Express", "توصيل سريع خلال 24 ساعة"],
    ["Appliances", "الأجهزة المنزلية"],
    ["Authorized", "وكلاء"],
    ["Genuinely", "أصلية"],
    ["Delivery", "التوصيل"],
    ["Official", "ضمان"],
    ["Mobiles", "الموبايلات"],
    ["Laptops", "أجهزة اللابتوب"],
    ["Shop by", "تسوق حسب"],
    ["yours.", "ولك."],
    ["14-day", "14 يومًا"],
    ["Gaming", "أجهزة"],
    ["want.", "تريدها."],
    ["Audio", "الصوتيات"],
    ["Smart", "ذكي"],
    ["Cairo", "القاهرة"],
    ["Giza", "الجيزة"],
    ["24h", "24 ساعة"],
  ];
  window.AlMumezEarlyTexts = new WeakMap();
  const w = document.createTreeWalker(
    document.querySelector(".hb-hero"),
    NodeFilter.SHOW_TEXT,
  );
  while (w.nextNode()) {
    const n = w.currentNode;
    if (n.parentElement.matches(".material-symbols-outlined,script,style"))
      continue;
    let text = n.textContent;
    window.AlMumezEarlyTexts.set(n, text);
    for (const [en, ar] of entries)
      if (text.includes(en)) text = text.replaceAll(en, ar);
    if (text !== n.textContent) n.textContent = text;
  }
})();
