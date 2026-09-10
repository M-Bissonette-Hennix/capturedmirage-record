import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('service worker only deletes RECORD namespaced caches',()=>{const s=fs.readFileSync('sw.js','utf8');assert.match(s,/startsWith\(PREFIX\)/);assert.match(s,/const PREFIX='record::'/);});
test('page zoom is not disabled',()=>assert.doesNotMatch(fs.readFileSync('index.html','utf8'),/user-scalable=no/));
test('all GitHub actions are full SHA pinned',()=>{const y=fs.readFileSync('.github/workflows/pages.yml','utf8');for(const m of y.matchAll(/uses:\s+[^@\s]+@([^\s]+)/g))assert.match(m[1],/^[a-f0-9]{40}$/);});

test('browser migration harness uses a same-origin HTML seed and explicit IndexedDB completion',()=>{
  const h=fs.readFileSync('fixtures/browser-seed.html','utf8');
  const p=fs.readFileSync('tests/browser/playwright.mjs','utf8');
  assert.match(h,/<!doctype html>/i);
  assert.match(p,/fixtures\/browser-seed\.html/);
  assert.doesNotMatch(p,/page\.goto\(`\$\{ORIGIN\}\/fixtures\/recognition\/clean-fixture-001\/envelope\.json/);
  assert.match(p,/tx\.oncomplete=\(\)=>resolve\(\)/);
  assert.match(p,/legacy seed failed:/);
});
