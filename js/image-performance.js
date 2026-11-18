/* Image data is presentation-only; catalog records and IDB images are untouched. */
(function(){
 'use strict';
 const manifest=window.AlMumezImageManifest||{};
 const optimized=new Map(Object.values(manifest).flatMap(item=>item.variants.map(v=>[v.src,item])));
 const responsive=new WeakSet();
 const escape=value=>String(value).replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
 const sizes='(max-width:639px) calc(100vw - 64px), (max-width:1199px) 32vw, 320px';
 function attributes(source,options={}){
  const item=manifest[source];if(!item)return `src="${escape(source)}"`;
  return `src="${item.src}" srcset="${item.variants.map(v=>`${v.src} ${v.width}w`).join(',')}" sizes="${options.sizes||sizes}"`;
 }
 function decorate(image){
  image.decoding='async';
  const source=image.getAttribute('src')||'',item=manifest[source]||optimized.get(source);
  if(responsive.has(image)&&!item&&!optimized.has(source)){image.removeAttribute('srcset');image.removeAttribute('sizes');responsive.delete(image)}
  if(item && (manifest[source] || !image.hasAttribute('srcset'))){
   image.srcset=item.variants.map(v=>`${v.src} ${v.width}w`).join(',');
   image.sizes=image.closest('.hb-visual')?'(max-width:639px) 258px, 284px':image.closest('header')?'(max-width:767px) 88px, 112px':image.closest('footer')?'145px':image.id==='mainProductImage'?'(max-width:767px) 90vw, 600px':sizes;
   image.src=item.src;
   responsive.add(image);
  }
  if(optimized.has(source)&&image.hasAttribute('srcset'))responsive.add(image);
  if(!image.hasAttribute('width'))image.width=item?.width||600;
  if(!image.hasAttribute('height'))image.height=item?.height||600;
  if(!image.closest('header,.hb-hero')&&image.id!=='mainProductImage'&&!image.hasAttribute('loading'))image.loading='lazy';
 }
 function scan(node){if(node instanceof HTMLImageElement)decorate(node);else node.querySelectorAll?.('img').forEach(decorate)}
 function apply(image,source){
  const item=manifest[source]||optimized.get(source);
  if(item){image.srcset=item.variants.map(v=>`${v.src} ${v.width}w`).join(',');image.sizes=image.id==='mainProductImage'?'(max-width:767px) 90vw, 600px':image.closest('.product-lightbox')?'90vw':sizes;responsive.add(image)}
  else{image.removeAttribute('srcset');image.removeAttribute('sizes');responsive.delete(image)}
  image.decoding='async';image.src=item?.src||source;
 }
 window.AlMumezImages={attributes,apply,source:source=>manifest[source]?.src||source};
 scan(document);
 new MutationObserver(records=>{const pending=new Set();for(const record of records){if(record.type==='attributes')pending.add(record.target);else record.addedNodes.forEach(node=>{if(node.nodeType===1)pending.add(node)})}pending.forEach(scan)}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
})();
