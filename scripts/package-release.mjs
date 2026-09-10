import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createZip} from '../src/zip.js';

const root=process.cwd();
const release=JSON.parse(await fs.readFile(path.join(root,'config/release.json'),'utf8'));
const dirName=`RECORD-${release.version}-RECONSTRUCTION-INTEGRITY`;
const out=process.argv[2]||path.join(path.dirname(root),`${dirName}.zip`);
const files=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(['.git','node_modules'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else{const rel=path.relative(root,p).replaceAll(path.sep,'/');const data=new Uint8Array(await fs.readFile(p));files.push({name:`${dirName}/${rel}`,data});}}}
await walk(root);files.sort((a,b)=>a.name.localeCompare(b.name));
const bytes=createZip(files,{deterministic:true,maxBytes:128*1024*1024});
await fs.writeFile(out,bytes);
const sha=crypto.createHash('sha256').update(bytes).digest('hex');
await fs.writeFile(`${out}.sha256`,`${sha}  ${path.basename(out)}\n`,'ascii');
console.log(`${path.basename(out)}\n${sha}\n${bytes.length} bytes\n${files.length} files`);
