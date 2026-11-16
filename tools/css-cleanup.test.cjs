const assert=require('node:assert/strict'),{dedupe}=require('./clean-css.cjs');
assert.equal(dedupe('.a{color:red}.a{color:blue}.a{color:red}').css,'.a{color:blue}.a{color:red}');
assert.equal(dedupe('@media(a){.x{display:block}}@media(b){.x{display:block}}').removed,0);
assert.equal(dedupe('@layer a;@layer b;@layer a;').removed,0);
assert.equal(dedupe('.x{content:"{hi}"}.x{content:"{hi}"}').removed,1);
assert.equal(dedupe('/* a brace { and an apostrophe \' */.x{color:red}.x{color:red}').css.includes('brace'),true);
console.log('PASS CSS cleanup: cascade order, conditional rules, layers, strings and comments.');
