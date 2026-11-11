const assert=require("node:assert/strict");
const logic=require("./js/products-logic.js");
global.AlMumezProductsLogic=logic;
const source=[
  {id:"a",name:{ar:"هاتف أبل",en:"Apple Phone"},brand:{ar:"أبل",en:"Apple"},category:"phones",categoryLabel:{ar:"هواتف",en:"Phones"},description:{ar:"وصف",en:"Description"},price:12000,stock:4,rating:4.8,reviewsCount:10,image:"a.jpg",createdAt:"2026-01-01"},
  {id:"b",name:{ar:"هاتف سامسونج",en:"Samsung Phone"},brand:{ar:"سامسونج",en:"Samsung"},category:"phones",subcategory:{ar:"هواتف",en:"Phones"},price:9000,stock:0,rating:4.2,reviewsCount:8,image:"b.jpg",createdAt:"2025-01-01"},
  {id:"c",name:{ar:"شاحن أنكر",en:"Anker Charger"},brand:{ar:"أنكر",en:"Anker"},category:"power",subcategory:{ar:"شواحن",en:"Chargers"},price:1000,stock:7,rating:3.9,reviewsCount:5,image:"c.jpg",createdAt:"2024-01-01"}
];
global.StoreProducts={KEY:"store-products-v1",read:()=>source,getEffectivePrice:p=>({price:p.price,originalPrice:p.oldPrice||0,active:false}),imageFallback:"logo.png"};
require("./js/products-data.js");
const data=global.AlMumezProductsData;
assert.equal(data.products.length,3);
assert.equal(data.products[0].name.ar,"هاتف أبل");
assert.equal(data.products[1].departmentLabel.en,"Phones");
let result=logic.queryProducts(data.products,{...logic.DEFAULTS,brands:["Apple","Samsung"]});
assert.equal(result.total,2);
result=logic.queryProducts(data.products,{...logic.DEFAULTS,dept:"phones",stock:true});
assert.equal(result.total,1);
assert.equal(result.items[0].id,"a");
result=logic.queryProducts(data.products,{...logic.DEFAULTS,max:10000,per:9});
assert.equal(result.total,2);
assert.equal(logic.discountPercent({price:80,oldPrice:100}),20);
const state=logic.parseState("?brand=Apple,Samsung&stock=1&page=2");
assert.deepEqual(state.brands,["Apple","Samsung"]);assert.equal(state.stock,true);assert.equal(state.page,2);
console.log("dashboard products adapter and catalogue logic tests passed");
