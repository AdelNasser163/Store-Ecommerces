const assert=require('node:assert/strict'),{compact,variable}=require('./font-faces.cjs');
assert.equal(variable('assets/fonts/font-2.woff2'),true);
assert.equal(variable('assets/fonts/arabic-6c9081fd00.woff2'),false);
const face=(weight,url,range='U+0000-00FF')=>`@font-face{font-family:Test;src:url(${url});font-weight:${weight};unicode-range:${range};}`;
const variableFaces=face(600,'font-2.woff2')+face(800,'font-2.woff2'),merged=compact(variableFaces,'assets/fonts');
assert.equal((merged.match(/@font-face/g)||[]).length,1);assert.match(merged,/font-weight: 600 800;/);assert.equal(compact(merged,'assets/fonts'),merged);
const subsets=face(600,'font-2.woff2')+face(800,'font-2.woff2','U+0600-06FF');assert.equal(compact(subsets,'assets/fonts'),subsets);
const staticFaces=face(400,'arabic-6c9081fd00.woff2')+face(700,'arabic-6c9081fd00.woff2');assert.equal(compact(staticFaces,'assets/fonts'),staticFaces);
console.log('PASS variable font consolidation, static weights, subsets and idempotence.');
