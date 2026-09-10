import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=process.cwd();
const dist=path.join(root,'dist');
const manifestPath=path.join(dist,'precache-manifest.js');
const text=await fs.readFile(manifestPath,'utf8');
const m=text.match(/^self\.RECORD_PRECACHE=(\[.*\]);\s*$/s);
if(!m)throw new Error('precache-manifest.js is not canonical.');
const entries=JSON.parse(m[1]);
const byUrl=new Map();
for(const entry of entries){
  if(!entry||typeof entry.url!=='string'||!/^[.][/]\S+$/.test(entry.url)||!/^[0-9a-f]{64}$/.test(entry.sha256))throw new Error(`Invalid precache entry: ${JSON.stringify(entry)}`);
  if(byUrl.has(entry.url))throw new Error(`Duplicate precache URL: ${entry.url}`);
  byUrl.set(entry.url,entry.sha256);
  const rel=entry.url.slice(2);
  const bytes=await fs.readFile(path.join(dist,rel));
  const actual=crypto.createHash('sha256').update(bytes).digest('hex');
  if(actual!==entry.sha256)throw new Error(`Precache digest mismatch: ${entry.url}`);
}
const actual=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else{const rel=path.relative(dist,p).split(path.sep).join('/');if(rel!=='precache-manifest.js')actual.push(`./${rel}`);}}}
await walk(dist);actual.sort();
const listed=[...byUrl.keys()].sort();
if(JSON.stringify(actual)!==JSON.stringify(listed)){
  const missing=actual.filter(x=>!byUrl.has(x));
  const extra=listed.filter(x=>!actual.includes(x));
  throw new Error(`Precache coverage mismatch; missing=${missing.join(',')} extra=${extra.join(',')}`);
}
for(const required of ['./index.html','./app.js','./src/perspective.js','./src/reconstruction.js','./src/db.js','./config/runtime.json'])if(!byUrl.has(required))throw new Error(`Required runtime file missing from precache: ${required}`);
const sw=await fs.readFile(path.join(dist,'sw.js'),'utf8');
if(/\bcaches\.match\s*\(/.test(sw))throw new Error('dist service worker must not use origin-global caches.match().');
if(!sw.includes("url.pathname.endsWith('/config/runtime.json')")||!sw.includes("cache:'no-store'"))throw new Error('runtime config is not network-first/no-store in dist service worker.');
const cfg=JSON.parse(await fs.readFile(path.join(dist,'config/runtime.json'),'utf8'));
if(cfg.gatewayEnabled && (!cfg.dedicatedOrigin||!cfg.requiredOrigin||!cfg.gatewayUrl||!cfg.gatewayPublicJwk))throw new Error('Unsafe gateway-enabled runtime config in dist.');
console.log(`dist QA PASS · ${entries.length} content-addressed runtime files verified`);
