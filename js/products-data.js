(function(root){
  "use strict";
  const departments=[],brands=[],storages=[];
  const pair=(value,fallback="")=>typeof value==="object"&&value?{ar:value.ar||value.en||fallback,en:value.en||value.ar||fallback}:{ar:String(value||fallback),en:String(value||fallback)};
  const slug=value=>String(value||"").toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g,"-").replace(/^-|-$/g,"");
  function source(){return root.StoreProducts?.read?.()||[]}
  function effective(product){return root.StoreProducts?.getEffectivePrice?.(product)||{price:Number(product.price)||0,originalPrice:Number(product.oldPrice)||0,active:Number(product.oldPrice)>Number(product.price)}}
  function mapProduct(product){
    const state=effective(product),category=product.category||"other",categoryLabel=pair(product.categoryLabel||product.subcategory,category),brand=pair(product.brand,""),variants=Array.isArray(product.variants)?product.variants:[],storageOptions=variants.map(item=>String(item.label?.en||item.label?.ar||item.id||"")).filter(Boolean);
    return {id:String(product.id),slug:product.slug||slug(product.name?.en||product.name?.ar||product.id),name:pair(product.name,"Product"),description:pair(product.description,""),brand:brand.en||brand.ar,brandLabel:brand,department:category,departmentLabel:categoryLabel,price:Number(state.price)||0,oldPrice:state.active?Number(state.originalPrice)||0:0,rating:Number(product.rating)||0,reviewCount:Number(product.reviewsCount||product.reviews)||0,stock:Math.max(0,Number(product.stock)||0),initialStock:Math.max(1,Number(product.stock)||1),sold:Number(product.offer?.sold)||0,createdAt:product.createdAt||new Date(0).toISOString(),storageOptions,express:Boolean(product.express),image:product.image||root.StoreProducts?.imageFallback||"assets/images/logo.png",aliases:[brand.ar,brand.en,categoryLabel.ar,categoryLabel.en,product.sku].filter(Boolean),source:product};
  }
  function refresh(){
    const products=source().map(mapProduct),departmentMap=new Map(),brandSet=new Set(),storageSet=new Set();
    products.forEach(product=>{if(!departmentMap.has(product.department))departmentMap.set(product.department,{id:product.department,ar:product.departmentLabel.ar,en:product.departmentLabel.en,icon:"category"});if(product.brand)brandSet.add(product.brand);product.storageOptions.forEach(item=>storageSet.add(item))});
    departments.splice(0,departments.length,...departmentMap.values());brands.splice(0,brands.length,...brandSet);storages.splice(0,storages.length,...storageSet);api.products=products;return products;
  }
  function getProducts(params){const run=()=>root.AlMumezProductsLogic.queryProducts(refresh(),params);return root.StoreProducts?.ready?Promise.resolve(root.StoreProducts.ready).then(run):Promise.resolve(run())}
  const api={products:[],departments,brands,storages,getProducts,refresh};refresh();root.AlMumezProductsData=api;
  root.addEventListener?.("storage",event=>{if(event.key===root.StoreProducts?.KEY)refresh()});
})(globalThis);
