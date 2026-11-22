(function () {
  "use strict";
  if (!window.StoreProducts) return;
  const language=localStorage.getItem("almumez-language")==="ar"?"ar":"en",money=value=>window.AlMumezFormatCurrency?window.AlMumezFormatCurrency(value,language):(language==="ar"?`${new Intl.NumberFormat("ar-EG").format(Number(value)||0)} ج.م`:`EGP ${new Intl.NumberFormat("en-EG").format(Number(value)||0)}`),text=value=>typeof value==="object"?value?.[language]||value?.en||"":value||"";
  const badgeLabels={new:["New Arrival","وصل حديثًا"],"best-seller":["Best Seller","الأكثر مبيعًا"],"official-warranty":["Official Warranty","ضمان رسمي"],discount:["Sale","خصم"],none:["",""]};
  const offerState=product=>StoreProducts.getEffectivePrice(product);
  const products=()=>StoreProducts.read().filter(product=>product.published!==false);
  const identity=product=>String(product.name?.en||product.name||product.id).toLowerCase().replace(/\s+copy(?:\s+\d+)?$/," ").trim();
  const unique=list=>{const seen=new Set();return list.filter(product=>{const key=identity(product);if(seen.has(key))return false;seen.add(key);return true})};
  const renderedOnPage=new Set(),imageError=`this.onerror=null;this.src='${StoreProducts.imageFallback}'`;
  const imageAttributes=reference=>String(reference||"").startsWith("idb:")?`src="${StoreProducts.imageFallback}" data-image-ref="${String(reference).replace(/"/g,"&quot;")}"`:`src="${String(reference||StoreProducts.imageFallback).replace(/"/g,"&quot;")}"`;
  function card(product,options={}){
    const state=offerState(product),wishlist=(()=>{try{return JSON.parse(localStorage.getItem("almumez-wishlist")||"[]")}catch{return[]}})(),wished=Array.isArray(wishlist)&&wishlist.some(item=>String(item?.id??item)===String(product.id));
    const extraHtml=state.active&&state.endsAt?`<small class="catalog-offer-countdown" data-offer-end="${state.endsAt}"></small>`:"";
    return window.AlMumezProductCard.render(product,{language,wished,price:state.price,oldPrice:state.originalPrice,extraHtml,dark:Boolean(options.dark)});
  }
  const findSection=heading=>[...document.querySelectorAll("main section")].find(section=>section.querySelector("h2")?.textContent.includes(heading));
  function renderPlacement(placement,section){
    const grid=document.querySelector(`[data-products-section="${placement}"]`);section=grid?.closest("section")||section;if(!grid||!section)return;
    const list=unique(products().filter(product=>product.placements?.[placement]!=null&&(placement!=="home-flash"||offerState(product).active))).filter(product=>!renderedOnPage.has(identity(product))).sort((a,b)=>(a.placements[placement]||0)-(b.placements[placement]||0)),limit=placement==="home-flash"?5:placement==="home-featured"?4:list.length,shown=list.slice(0,limit);
    grid.innerHTML=shown.map(product=>card(product,{dark:placement==="home-flash"})).join("");shown.forEach(product=>renderedOnPage.add(identity(product)));
    let all=section.querySelector("[data-section-view-all]");if(list.length>limit&&!all){all=document.createElement("a");all.dataset.sectionViewAll="";all.className="catalog-section-view-all";section.append(all)}if(all){all.hidden=list.length<=limit;all.href="accessories.html";all.textContent=language==="ar"?"عرض الكل":"View all"}
  }
  const page=document.body.dataset.page;
  const pending=new Map();
  const near=window.IntersectionObserver&&new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){near.unobserve(entry.target);const render=pending.get(entry.target);pending.delete(entry.target);render?.()}})},{rootMargin:"500px"});
  function queuePlacement(placement,heading){const grid=document.querySelector(`[data-products-section="${placement}"]`);if(!grid)return;grid.dataset.perfPending="";grid.setAttribute("aria-busy","true");grid.innerHTML=Array.from({length:4},()=>'<div class="perf-skeleton" aria-hidden="true"></div>').join("");const render=()=>{renderPlacement(placement,findSection(heading));delete grid.dataset.perfPending;grid.removeAttribute("aria-busy");window.dispatchEvent(new Event("store:cards-rendered"))};if(near){pending.set(grid,render);near.observe(grid)}else render()}
  function flush(){for(const [grid,render] of pending){near?.unobserve(grid);pending.delete(grid);render()}}
  if(page==="home"||!page){queuePlacement("home-flash","Flash Deals");queuePlacement("home-featured","Featured Tech Collections")}
  if(page==="accessories"){
    const section=[...document.querySelectorAll("main section")].find(node=>node.querySelector("h3")&&node.querySelectorAll("h3").length>3);
    if(section){const grid=section.querySelector(".grid");if(grid){grid.dataset.productsSection="accessories";grid.innerHTML=unique(products().filter(product=>product.placements?.accessories!=null)).sort((a,b)=>a.placements.accessories-b.placements.accessories).map(card).join("")}}
  }
  const countdownText=remaining=>{const seconds=Math.max(0,Math.floor(remaining/1000)),days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),rest=seconds%60;return `${days}:${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(rest).padStart(2,"0")}`};
  if(page==="home"||!page||page==="accessories"||page==="products"){
    const signature=()=>products().map(product=>`${product.id}:${offerState(product).active}`).join("|");
    let offerSignature=signature();
    function checkOffers(){if(document.hidden)return;const next=signature();if(next!==offerSignature){offerSignature=next;location.reload()}}
    const hasOffers=products().some(product=>product.offer?.enabled||product.oldPrice>product.price);
    if(hasOffers)setInterval(checkOffers,60000);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)checkOffers()});
  }
  document.addEventListener("click",event=>{const target=event.target.closest("[data-product-id] img, [data-product-id] h3");if(!target)return;location.href=`product.html?id=${encodeURIComponent(target.closest("[data-product-id]").dataset.productId)}`});
  document.addEventListener("keydown",event=>{if(!["Enter"," "].includes(event.key)||!event.target.matches("[data-product-id] h3"))return;event.preventDefault();location.href=`product.html?id=${encodeURIComponent(event.target.closest("[data-product-id]").dataset.productId)}`});
  window.StoreCatalogUI={card,products,renderPlacement,unique,flush};
  StoreProducts.ready?.then(()=>{
    let signature=JSON.stringify(products());
    const refresh=()=>{const next=JSON.stringify(products());if(next===signature)return;signature=next;pending.forEach((_,grid)=>near?.unobserve(grid));pending.clear();renderedOnPage.clear();document.querySelectorAll('[data-products-section]').forEach(grid=>{renderPlacement(grid.dataset.productsSection);delete grid.dataset.perfPending;grid.removeAttribute('aria-busy')});window.dispatchEvent(new Event('store:cards-rendered'))};
    window.addEventListener('storage',event=>{if(event.key===StoreProducts.KEY)refresh()});
    window.addEventListener('store:products-changed',refresh);
  });
})();
