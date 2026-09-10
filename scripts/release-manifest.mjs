import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const release=JSON.parse(await fs.readFile(path.join(root,'config/release.json'),'utf8'));
const skip=new Set(['RELEASE_MANIFEST.json']);
const files=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(['.git','node_modules'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else{const rel=path.relative(root,p).replaceAll(path.sep,'/');if(skip.has(rel))continue;const b=await fs.readFile(p);files.push({path:rel,size:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}}}
await walk(root);files.sort((a,b)=>a.path.localeCompare(b.path));
const manifest={schema:'record-release-manifest/3',release:`RECORD ${release.version} ${release.release}`,releasedAt:release.releasedAt,sourceRelease:release.sourceRelease,hostileAudit:release.hostileAudit,canonicalCaptureDmirageLogoSha256:release.canonicalCaptureDmirageLogoSha256,files};
await fs.writeFile('RELEASE_MANIFEST.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`Wrote ${files.length} release descriptors.`);
