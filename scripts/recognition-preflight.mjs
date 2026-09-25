import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const npm=process.platform==='win32'?'npm.cmd':'npm';
function run(script){
  const r=spawnSync(npm,['run',script],{stdio:'inherit',shell:false,env:process.env});
  if(r.error)throw r.error;
  if(r.status!==0)throw new Error(`npm run ${script} failed with exit code ${r.status}`);
}
async function readJson(p){return JSON.parse(await fs.readFile(p,'utf8'));}

const prod=await readJson('config/runtime.production.json').catch(()=>null);
if(!prod)throw new Error('config/runtime.production.json is missing. Generate it with scripts/recognition-bootstrap.mjs --worker-origin first.');
if(prod.gatewayEnabled!==true||prod.dedicatedOrigin!==true||prod.providerProfile!=='remote')throw new Error('Production runtime is not remote/dedicated/enabled.');
if(prod.requiredOrigin!=='https://record.officeofmethod.com')throw new Error('Production runtime requiredOrigin mismatch.');
if(prod.gatewayUrl!=='https://recognition.record.officeofmethod.com/api')throw new Error('Production runtime gatewayUrl mismatch.');

console.log('\n=== RECORD recognition preflight: source/default ===');
run('check');
run('build');
run('check:dist');

console.log('\n=== RECORD recognition preflight: dedicated production ===');
run('build:production');
run('check:dist');
const deployedProd=await readJson('dist/config/runtime.json');
if(deployedProd.gatewayEnabled!==true||deployedProd.providerProfile!=='remote')throw new Error('Dedicated production build did not emit enabled remote runtime.');

console.log('\n=== RECORD recognition preflight: restore fail-closed default dist ===');
run('build');
run('check:dist');
const restored=await readJson('dist/config/runtime.json');
if(restored.gatewayEnabled!==false||restored.providerProfile!=='fixture')throw new Error('Final dist was not restored to the fail-closed default runtime.');

console.log('\nRECORD recognition preflight PASS');
console.log('Final tracked dist state is fail-closed/fixture. Dedicated Vercel builds production at deployment time.');
