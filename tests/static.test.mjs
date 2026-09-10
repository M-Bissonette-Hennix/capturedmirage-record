import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('service worker only deletes RECORD namespaced caches',()=>{const s=fs.readFileSync('sw.js','utf8');assert.match(s,/startsWith\(PREFIX\)/);assert.match(s,/const PREFIX='record::'/);});
test('page zoom is not disabled',()=>assert.doesNotMatch(fs.readFileSync('index.html','utf8'),/user-scalable=no/));
test('all GitHub actions are full SHA pinned',()=>{const y=fs.readFileSync('.github/workflows/pages.yml','utf8');for(const m of y.matchAll(/uses:\s+[^@\s]+@([^\s]+)/g))assert.match(m[1],/^[a-f0-9]{40}$/);});
