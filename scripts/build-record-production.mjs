import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const root=process.cwd();
const defaultRuntimePath=path.join(root,'config','runtime.json');
const productionRuntimePath=path.join(root,'config','runtime.production.json');

function fail(message){throw new Error(message);}
function run(command,args){
  const r=spawnSync(command,args,{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
  if(r.error)throw r.error;
  if(r.status!==0)fail(`${command} ${args.join(' ')} failed with exit code ${r.status}`);
}
function validateRuntime(runtime){
  if(runtime?.dedicatedOrigin!==true)fail('Production runtime must set dedicatedOrigin=true.');
  if(runtime?.requiredOrigin!=='https://record.officeofmethod.com')fail('Production runtime requiredOrigin mismatch.');
  if(runtime?.gatewayEnabled!==true)fail('Production runtime must enable the recognition gateway.');
  if(runtime?.gatewayUrl!=='https://recognition.record.officeofmethod.com/api')fail('Production runtime gatewayUrl mismatch.');
  if(runtime?.providerProfile!=='remote')fail('Production runtime must use providerProfile=remote.');
  const jwk=runtime?.gatewayPublicJwk;
  if(!jwk||jwk.kty!=='EC'||jwk.crv!=='P-256'||typeof jwk.x!=='string'||typeof jwk.y!=='string'||jwk.x==='GENERATED_LOCALLY'||jwk.y==='GENERATED_LOCALLY')fail('Production runtime must contain the generated P-256 gateway public JWK.');
  if(!runtime?.builtAt||Number.isNaN(Date.parse(runtime.builtAt)))fail('Production runtime builtAt must be an ISO timestamp.');
}

const original=await fs.readFile(defaultRuntimePath);
let production;
try{production=JSON.parse(await fs.readFile(productionRuntimePath,'utf8'));}catch(error){fail(`Missing or invalid config/runtime.production.json. Complete recognition commissioning first. ${error}`);}
validateRuntime(production);

try{
  await fs.writeFile(defaultRuntimePath,JSON.stringify(production,null,2)+'\n');
  run(process.platform==='win32'?'npm.cmd':'npm',['run','check']);
  run(process.platform==='win32'?'npm.cmd':'npm',['run','build']);
  run(process.platform==='win32'?'npm.cmd':'npm',['run','check:dist']);
  console.log('Dedicated-origin RECORD production build PASS.');
}finally{
  await fs.writeFile(defaultRuntimePath,original);
}
