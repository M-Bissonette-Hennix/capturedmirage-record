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


test('field UI accepts only JPEG/PNG, supports camera plus Photos/Files, and fences fixture recognition',()=>{const a=fs.readFileSync('app.js','utf8');assert.match(a,/accept:'image\/jpeg,image\/png'/);assert.doesNotMatch(a,/accept:'image\/jpeg,image\/png,image\/webp'/);assert.match(a,/CAPTURE PAGE/);assert.match(a,/ADD FROM PHOTOS \/ FILES/);assert.match(a,/FIXTURE LOCKED/);assert.match(a,/Fixture recognition cannot be applied to a real scoresheet/);});
test('certification UI requires explicit human assertion and valid certification before Capsule export',()=>{const a=fs.readFileSync('app.js','utf8');assert.match(a,/I have compared the digital move record with the preserved source/);assert.match(a,/CAPSULE REQUIRES VALID CERTIFICATION/);assert.match(a,/Certification requires the explicit review assertion/);});
test('iOS-oriented exports prefer native file sharing and cancelled Capsule export is not marked exported',()=>{const a=fs.readFileSync('app.js','utf8');assert.match(a,/async function shareOrSaveFile/);assert.match(a,/if\(!delivered\)\{toast\('Capsule export cancelled/);});
test('Capsule verification has a defined error code',()=>{const e=fs.readFileSync('src/errors.js','utf8');assert.match(e,/CAPSULE_INVALID:\s*'REC-CAPS-001'/);});
test('operational Pages workflow preserves deterministic QA, build and dist verification',()=>{const y=fs.readFileSync('.github/workflows/pages.yml','utf8');assert.match(y,/npm run check/);assert.match(y,/npm run build/);assert.match(y,/npm run check:dist/);assert.match(y,/upload-pages-artifact/);assert.match(y,/deploy-pages/);});

test('postgame note writes are serialized to prevent blur/change races',()=>{const a=fs.readFileSync('app.js','utf8');assert.match(a,/notesSave=Promise\.resolve\(\)/);assert.match(a,/notesSave=notesSave\.then/);});


test('recognition commissioning scaffolding keeps secrets out of tracked config',()=>{
  const ignore=fs.readFileSync('.gitignore','utf8');
  const wrangler=fs.readFileSync('gateway/wrangler.jsonc','utf8');
  const bootstrap=fs.readFileSync('scripts/recognition-bootstrap.mjs','utf8');
  assert.match(ignore,/\.record-secrets\//);
  assert.match(wrangler,/"RECORD_ALLOWED_ORIGIN": "https:\/\/record\.officeofmethod\.com"/);
  assert.match(wrangler,/"RECORD_PROVIDER_MODE": "openai-responses"/);
  assert.match(wrangler,/"RECORD_OPENAI_MODEL": "gpt-5\.6-terra"/);
  assert.match(wrangler,/"RECORD_SECURITY"/);
  assert.match(wrangler,/"RecordSecurityCoordinator"/);
  assert.match(bootstrap,/--secrets-file/);
  assert.doesNotMatch(wrangler,/sk-[A-Za-z0-9]/);
});

test('dedicated Vercel frontend config builds only verified dist output',()=>{
  const v=JSON.parse(fs.readFileSync('vercel.json','utf8'));
  assert.equal(v.buildCommand,'npm run check && npm run build:production && npm run check:dist');
  assert.equal(v.outputDirectory,'dist');
  assert.equal(v.installCommand,'npm ci');
});


test('default runtime remains fail-closed while Vercel production uses separate runtime',()=>{
  const runtime=JSON.parse(fs.readFileSync('config/runtime.json','utf8'));
  const build=fs.readFileSync('scripts/build.mjs','utf8');
  const prod=fs.readFileSync('scripts/build-production.mjs','utf8');
  assert.equal(runtime.gatewayEnabled,false);
  assert.equal(runtime.providerProfile,'fixture');
  assert.match(build,/RECORD_RUNTIME_CONFIG/);
  assert.match(prod,/config\/runtime\.production\.json/);
});


test('local secret directory is excluded from static source scanning',()=>{
  const q=fs.readFileSync('scripts/static-qa.mjs','utf8');
  assert.match(q,/\.record-secrets/);
});
