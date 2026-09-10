import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const required=[
  'index.html','styles.css','app.js','frameguard.js','sw.js','manifest.webmanifest','config/runtime.json',
  'README.md','ARCHITECTURE.md','DEVELOPMENT_BIBLE.md','THREAT_MODEL.md','PRIVACY_MODEL.md','QA.md','SECURITY.md','BRANDING.md','AUDIT_STATUS.md','PHYSICAL_IPHONE_QA.md',
  'src/chess.js','src/db.js','src/record.js','src/validators.js','src/image.js','src/perspective.js','src/recognition.js','src/capsule.js','src/backup.js',
  'assets/branding/capturedmirage-logo.png','licenses/GPL-2.0.txt'
];
for(const f of required)await fs.stat(path.join(root,f));

const index=await fs.readFile(path.join(root,'index.html'),'utf8');
if(/user-scalable\s*=\s*no/i.test(index))throw new Error('Accessibility regression: zoom disabled.');
if(!index.includes("default-src 'self'"))throw new Error('Expected restrictive CSP is missing.');


const config=await fs.readFile(path.join(root,'src/config.js'),'utf8');
if(!config.includes("preprocessorVersion: 'record-preprocess/3'"))throw new Error('Expected record-preprocess/3 is not frozen.');
const image=await fs.readFile(path.join(root,'src/image.js'),'utf8');
if(!image.includes("PROJECTIVE_V3")||!image.includes('warpPerspectiveRGBA'))throw new Error('Projective preprocessing implementation is missing.');

const app=await fs.readFile(path.join(root,'app.js'),'utf8');
if(/\b(?:alert|prompt|confirm)\s*\(/.test(app))throw new Error('Native alert/prompt/confirm reintroduced into core app workflow.');
if(!app.includes('capturedmirage-logo.png'))throw new Error('Canonical CAPTUREDMIRAGE relationship mark is not surfaced by the app.');
if(!app.includes('verifiedCertificationStatus')||!app.includes('DB.currentObservations'))throw new Error('UI certification must be derived against current evidence.');
if(!app.includes("evidenceBearing:true")||!app.includes('OBSERVATION_MARKED_UNREADABLE'))throw new Error('Unreadable observation must invalidate certification.');
if(!app.includes('RUN RECONSTRUCTION')||!app.includes('reconstructGame'))throw new Error('v0.3 reconstruction workflow is not surfaced.');
if(/buildCertification\(fresh,freshPages\)/.test(app)||/verifyCertification\(g,pages\)/.test(app))throw new Error('Certification path omitted observation evidence.');


const sw=await fs.readFile(path.join(root,'sw.js'),'utf8');
if(/filter\(k\s*=>\s*k\s*!==\s*CACHE\)/.test(sw)||(/caches\.delete\(key\)/.test(sw)&&!sw.includes('startsWith(PREFIX)')))throw new Error('Service worker cache deletion is not namespace-scoped.');
if(!sw.includes('record::')||!sw.includes('precache-manifest.js'))throw new Error('Service-worker namespace/precache-manifest regression.');
if(/caches\.match\(/.test(sw))throw new Error("Service worker must read from RECORD's explicitly opened cache, not origin-global CacheStorage.");
if(!sw.includes("endsWith('/config/runtime.json')")||!sw.includes("cache:'no-store'"))throw new Error('runtime.json must be network-first/no-store.');



const buildScript=await fs.readFile(path.join(root,'scripts/build.mjs'),'utf8');
if(!buildScript.includes('precache-manifest.js')||!buildScript.includes('sha256'))throw new Error('Build-generated content-addressed precache manifest is missing.');
const runtime=JSON.parse(await fs.readFile(path.join(root,'config/runtime.json'),'utf8'));
if(runtime.gatewayEnabled && (!runtime.dedicatedOrigin||!runtime.requiredOrigin||!runtime.gatewayUrl||!runtime.gatewayPublicJwk))throw new Error('Unsafe runtime: remote gateway enabled without dedicated-origin/public-key prerequisites.');
if(!runtime.gatewayEnabled && runtime.providerProfile!=='fixture')throw new Error('Default offline/local release must use fixture provider while remote gateway is disabled.');

const logo=await fs.readFile(path.join(root,'assets/branding/capturedmirage-logo.png'));
const logoHash=crypto.createHash('sha256').update(logo).digest('hex');
const CANONICAL_LOGO='df4f56b3ca47981e0202e433fe275bf15328ca58177599b3ba62a99cd796c8e6';
if(logoHash!==CANONICAL_LOGO)throw new Error(`CAPTUREDMIRAGE logo drift: ${logoHash}`);

for(const side of ['w','b'])for(const piece of ['K','Q','R','B','N','P'])await fs.stat(path.join(root,'assets/pieces/cburnett',`${side}${piece}.svg`));
const thirdParty=await fs.readFile(path.join(root,'THIRD_PARTY_NOTICES.md'),'utf8');
if(!/Cburnett/i.test(thirdParty)||!/GPLv2\+/i.test(thirdParty))throw new Error('Cburnett licensing notice missing.');

const workflow=await fs.readFile(path.join(root,'.github/workflows/pages.yml'),'utf8');
for(const m of workflow.matchAll(/uses:\s*([^\s#]+)/g)){const ref=m[1].split('@')[1]||'';if(!/^[a-f0-9]{40}$/i.test(ref))throw new Error(`GitHub Action is not pinned to a full SHA: ${m[1]}`);}
if(!/with:\s*\n\s*path:\s*dist/m.test(workflow))throw new Error('Pages deployment must upload only dist/.');

const all=[];
async function walk(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){if(!['.git','dist','node_modules'].includes(e.name))await walk(p);}else all.push(p);}}
await walk(root);
const secret=/(sk-[A-Za-z0-9]{20,}|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|api[_-]?key\s*[:=]\s*["'][^"']{12,})/i;
for(const f of all){if(!/\.(js|mjs|json|md|html|yml|yaml|txt)$/.test(f))continue;const t=await fs.readFile(f,'utf8').catch(()=>null);if(t&&secret.test(t))throw new Error(`Potential secret in ${path.relative(root,f)}`);}

console.log(`Static QA PASS · canonical CAPTUREDMIRAGE logo ${logoHash}`);
