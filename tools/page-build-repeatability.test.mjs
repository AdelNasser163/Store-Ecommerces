import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const snapshot=()=>Object.fromEntries([
 ...fs.readdirSync('.').filter(file=>file.endsWith('.html')),
 'tools/performance-pages.json',
 ...fs.readdirSync('dist').map(file=>'dist/'+file),
].sort().map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const before=snapshot();
const build=spawnSync(process.execPath,['tools/build-performance.mjs'],{encoding:'utf8'});
assert.equal(build.status,0,build.stderr||build.stdout);
assert.deepEqual(snapshot(),before,'Rebuilding without source changes must preserve all output files');
console.log('PASS repeatable build: formatted HTML and external assets remain byte-identical.');
