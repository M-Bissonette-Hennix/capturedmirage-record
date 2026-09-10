import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const manifest=JSON.parse(await fs.readFile(path.join(root,'RELEASE_MANIFEST.json'),'utf8'));
if(manifest.schema!=='record-release-manifest/3')throw new Error('Unsupported release manifest schema.');
const expected=new Map(manifest.files.map(x=>[x.path,x]));
if(expected.size!==manifest.files.length)throw new Error('Duplicate release manifest path.');
const actual=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(['.git','node_modules'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else{const rel=path.relative(root,p).replaceAll(path.sep,'/');if(rel==='RELEASE_MANIFEST.json')continue;actual.push(rel);const d=expected.get(rel);if(!d)throw new Error(`Unexpected release file: ${rel}`);const b=await fs.readFile(p),sha=crypto.createHash('sha256').update(b).digest('hex');if(b.length!==d.size||sha!==d.sha256)throw new Error(`Release descriptor mismatch: ${rel}`);}}}
await walk(root);
for(const rel of expected.keys())if(!actual.includes(rel))throw new Error(`Missing release file: ${rel}`);
console.log(`Release manifest PASS · ${actual.length}/${expected.size} file descriptors verified`);
