const FRONTEND='https://record.officeofmethod.com';
const GATEWAY='https://recognition.record.officeofmethod.com/api';

function fail(message){throw new Error(message);}
async function getText(url,init={}){
  const r=await fetch(url,{redirect:'error',cache:'no-store',...init});
  const t=await r.text();
  return {r,t};
}

const home=await getText(FRONTEND+'/');
if(!home.r.ok)fail(`Frontend HTTP ${home.r.status}`);
if(!/RECORD/i.test(home.t))fail('Frontend response does not look like RECORD.');
console.log('[PASS] frontend reachable');

const runtimeRes=await fetch(FRONTEND+'/config/runtime.json',{cache:'no-store',redirect:'error'});
if(!runtimeRes.ok)fail(`runtime.json HTTP ${runtimeRes.status}`);
const runtime=await runtimeRes.json();
if(runtime.dedicatedOrigin!==true)fail('runtime dedicatedOrigin is not true');
if(runtime.requiredOrigin!==FRONTEND)fail(`runtime requiredOrigin mismatch: ${runtime.requiredOrigin}`);
if(runtime.gatewayEnabled!==true)fail('runtime gatewayEnabled is not true');
if(runtime.gatewayUrl!==GATEWAY)fail(`runtime gatewayUrl mismatch: ${runtime.gatewayUrl}`);
if(runtime.providerProfile!=='remote')fail(`runtime providerProfile mismatch: ${runtime.providerProfile}`);
if(runtime.gatewayPublicJwk?.kty!=='EC'||runtime.gatewayPublicJwk?.crv!=='P-256'||!runtime.gatewayPublicJwk?.x||!runtime.gatewayPublicJwk?.y)fail('runtime pinned gateway P-256 public JWK is missing/invalid');
console.log('[PASS] production runtime configuration');

const health=await getText(GATEWAY+'/healthz');
if(!health.r.ok)fail(`gateway health HTTP ${health.r.status}: ${health.t}`);
let healthJson;try{healthJson=JSON.parse(health.t);}catch{fail('gateway health response is not JSON');}
if(healthJson.ok!==true||healthJson.service!=='record-recognition-gateway')fail('gateway health payload mismatch');
console.log('[PASS] recognition gateway health');

const preflight=await fetch(GATEWAY+'/register',{
  method:'OPTIONS',
  redirect:'error',
  headers:{
    origin:FRONTEND,
    'access-control-request-method':'POST',
    'access-control-request-headers':'content-type'
  }
});
if(preflight.status!==204)fail(`gateway preflight HTTP ${preflight.status}`);
if(preflight.headers.get('access-control-allow-origin')!==FRONTEND)fail('gateway preflight did not allow the exact RECORD origin');
console.log('[PASS] exact-origin CORS preflight');

const wrongOrigin=await fetch(GATEWAY+'/register',{
  method:'OPTIONS',
  redirect:'error',
  headers:{
    origin:'https://example.invalid',
    'access-control-request-method':'POST',
    'access-control-request-headers':'content-type'
  }
});
if(wrongOrigin.status!==403)fail(`wrong-origin preflight should be 403, got ${wrongOrigin.status}`);
console.log('[PASS] wrong origin rejected');

console.log('');
console.log('RECORD recognition production surface verification PASS');
