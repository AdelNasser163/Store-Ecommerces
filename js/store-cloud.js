/* Loaded only when cloud mode is enabled at build time. Public key, never admin JWT. */
(function(){
 'use strict';const S=window.StoreSupabase;if(!S?.enabled)return;
 const products=new Map();let bundles=[],pending=false;
 const clone=value=>JSON.parse(JSON.stringify(value));
 const remember=rows=>{for(const row of rows)products.set(row.id,row);return rows};
 const readPreference=key=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}};
 const initialIds=()=>[new URLSearchParams(location.search).get('id'),'apple-iphone-15-pro-max-256gb','samsung-galaxy-s24-ultra','sony-wf-1000xm5','macbook-pro-16-m3-max','playstation-5-slim-bundle',...readPreference('cartItems').map(r=>r.id),...readPreference('almumez-wishlist').map(r=>r.id||r)].filter(Boolean).slice(0,100);
 // Cloud data lives only in memory. Browser demo catalog/history is never an authority.
 StoreProducts.read=()=>clone([...products.values()]);
 StoreProducts.write=async()=>{throw Error('Use the authenticated dashboard API to save products')};
 StoreBundles.read=()=>clone(bundles);
 StoreBundles.write=()=>{throw Error('Use the authenticated dashboard API to save bundles')};
 StoreBundles.forProduct=id=>{const now=Date.now();return clone(bundles.find(b=>b.enabled&&b.productIds.includes(id)&&(!b.startsAt||+new Date(b.startsAt)<=now)&&(!b.endsAt||+new Date(b.endsAt)>now)&&b.productIds.every(pid=>products.get(pid)?.published!==false&&Number(products.get(pid)?.stock)>0))||null)};
 async function details(ids){const missing=[...new Set(ids)].filter(id=>!products.has(id));for(let start=0;start<missing.length;start+=80){const {data,error}=await S.client.from('public_products').select('id,payload,published').in('id',missing.slice(start,start+80)).eq('published',true);if(error)throw error;remember(data.map(row=>({...row.payload,id:row.id,published:row.published})))}}
 async function catalog(filter={}){const response=await S.rpc('catalog_page',{p_filter:filter,p_page:filter.page||1,p_per:filter.per||12});remember(response.rows);return response}
 async function refresh(){products.clear();const [site,page]=await Promise.all([S.rpc('site_bootstrap',{p_ids:initialIds()}),catalog({page:1,per:12})]);remember(site.products);remember(page.rows);bundles=site.bundles;await details(bundles.flatMap(b=>b.productIds));window.StorefrontBackendSettings=site.settings;window.StoreBackendError=null;return site}
 const api=window.StoreCloud={enabled:true,refresh,catalog,details,remember,error:null,
  async submitOrder(order){if(pending)throw Error('A checkout request is already in progress');pending=true;
   try{const intent={customer:order.customer,items:order.items.map(({id,quantity,storage,isBundle,bundleId})=>({id,quantity,storage,isBundle,bundleId})),coupon:order.coupon,delivery:order.delivery,payment:order.payment,language:document.documentElement.lang};const signature=JSON.stringify(intent);let attempt;try{attempt=JSON.parse(sessionStorage.getItem('almumez-checkout-attempt'))}catch{}
    if(!attempt||attempt.signature!==signature){attempt={signature,requestId:crypto.randomUUID()};sessionStorage.setItem('almumez-checkout-attempt',JSON.stringify(attempt))}
    const saved=await S.rpc('submit_store_order',{p_order:{...order,requestId:attempt.requestId,language:intent.language}});
    // A successful authoritative order must not be reported as failed because a
    // subsequent catalog refresh failed. The order is already committed.
    api.lastOrder=saved;sessionStorage.removeItem('almumez-checkout-attempt');refresh().catch(error=>{api.error=error.message});return saved;
   }finally{pending=false}}
 };
 api.ready=Promise.resolve().then(refresh).catch(error=>{api.error=error.message;window.StoreBackendError=error.message;const main=document.querySelector('main');if(main){const text=document.createElement('p');text.setAttribute('role','alert');text.textContent=document.documentElement.lang==='ar'?'تعذر الاتصال بخدمة المتجر. أعد المحاولة.':'The store service could not be reached. Please try again.';main.replaceChildren(text)}return false});
})();
