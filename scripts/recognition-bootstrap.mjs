import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const secretDir=path.join(root,'.record-secrets');
const runtimePath=path.join(root,'config','runtime.json');
const proxyPath=path.join(root,'recognition-proxy','vercel.json');
const WRANGLER_VERSION='4.138.0';

function die(message){console.error(`ERROR: ${message}`);process.exit(1);}
function argValue(name){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;}
function b64url(bytes){return Buffer.from(bytes).toString('base64url');}
async function writeSecret(name,value){
  const p=path.join(secretDir,name);
  await fs.writeFile(p,String(value).trim()+'\n',{mode:0o600});
  return p;
}
async function fileExists(p){try{await fs.stat(p);return true;}catch{return false;}}

async function initSecrets(){
  const force=process.argv.includes('--force');
  if(await fileExists(secretDir)){
    const entries=await fs.readdir(secretDir);
    if(entries.length&&!force)die('.record-secrets already contains files. Refusing to overwrite. Use --force only if you intentionally want to rotate all commissioning credentials.');
  }
  await fs.mkdir(secretDir,{recursive:true,mode:0o700});
  const pair=await crypto.webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const privateJwk=await crypto.webcrypto.subtle.exportKey('jwk',pair.privateKey);
  const publicJwk=await crypto.webcrypto.subtle.exportKey('jwk',pair.publicKey);
  privateJwk.key_ops=['sign']; publicJwk.key_ops=['verify'];
  privateJwk.ext=true; publicJwk.ext=true;

  const stamp=new Date().toISOString().slice(0,10).replaceAll('-','');
  const keyId=`record-gateway-p256-${stamp}-${crypto.randomBytes(4).toString('hex')}`;
  const tokenId=`boot_${b64url(crypto.randomBytes(12))}`;
  const bootstrapSecret=b64url(crypto.randomBytes(36));

  await writeSecret('gateway-private-jwk.json',JSON.stringify(privateJwk));
  await writeSecret('gateway-public-jwk.json',JSON.stringify(publicJwk));
  await writeSecret('gateway-key-id.txt',keyId);
  await writeSecret('bootstrap-token-id.txt',tokenId);
  await writeSecret('bootstrap-secret.txt',bootstrapSecret);
  await writeSecret('bootstrap-capability.txt',`${tokenId}.${bootstrapSecret}`);

  const ps1=`# Generated locally. Contains no literal secrets; it reads ignored local files.
$ErrorActionPreference = 'Stop'
$cfg = 'gateway/wrangler.jsonc'
function Put-FromFile([string]$Name,[string]$Path) {
  Get-Content $Path -Raw | npx wrangler@${WRANGLER_VERSION} secret put $Name --config $cfg
  if ($LASTEXITCODE -ne 0) { throw "Failed to install Cloudflare secret: $Name" }
}
Put-FromFile 'RECORD_GATEWAY_PRIVATE_JWK' '.record-secrets/gateway-private-jwk.json'
Put-FromFile 'RECORD_GATEWAY_PUBLIC_JWK' '.record-secrets/gateway-public-jwk.json'
Put-FromFile 'RECORD_GATEWAY_KEY_ID' '.record-secrets/gateway-key-id.txt'
Put-FromFile 'RECORD_BOOTSTRAP_TOKEN_ID' '.record-secrets/bootstrap-token-id.txt'
Put-FromFile 'RECORD_BOOTSTRAP_SECRET' '.record-secrets/bootstrap-secret.txt'
Write-Host ''
Write-Host 'Now install the OpenAI API key interactively:'
Write-Host 'npx wrangler@${WRANGLER_VERSION} secret put RECORD_OPENAI_API_KEY --config gateway/wrangler.jsonc'
`;
  await fs.writeFile(path.join(secretDir,'install-cloudflare-secrets.ps1'),ps1,{mode:0o600});

  const publicReceipt={
    schema:'record-recognition-commissioning-public/1',
    createdAt:new Date().toISOString(),
    keyId,
    gatewayPublicJwk:publicJwk,
    bootstrapTokenId:tokenId,
    note:'Public commissioning receipt only. Private key and bootstrap secret remain under ignored .record-secrets/.'
  };
  await fs.writeFile(path.join(secretDir,'public-receipt.json'),JSON.stringify(publicReceipt,null,2)+'\n',{mode:0o600});

  console.log('Recognition commissioning credentials generated.');
  console.log('Secrets directory: .record-secrets/ (gitignored)');
  console.log('Gateway signing key ID:',keyId);
  console.log('Bootstrap token ID:',tokenId);
  console.log('');
  console.log('Next: install Cloudflare secrets with:');
  console.log('powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".record-secrets\\install-cloudflare-secrets.ps1"');
  console.log('');
  console.log('Then install RECORD_OPENAI_API_KEY interactively as instructed by that script.');
}

async function configureProduction(workerOriginText){
  if(!workerOriginText)die('--worker-origin requires the deployed Cloudflare workers.dev HTTPS origin.');
  let worker;
  try{worker=new URL(workerOriginText);}catch{die('Invalid --worker-origin URL.');}
  if(worker.protocol!=='https:'||worker.pathname!=='/'||worker.search||worker.hash)die('--worker-origin must be a canonical HTTPS origin with no path/query/fragment.');
  if(!worker.hostname.endsWith('.workers.dev'))die('--worker-origin must be the deployed Cloudflare workers.dev origin.');

  const publicKeyPath=path.join(secretDir,'gateway-public-jwk.json');
  if(!await fileExists(publicKeyPath))die('Missing .record-secrets/gateway-public-jwk.json. Run --init first.');
  const gatewayPublicJwk=JSON.parse(await fs.readFile(publicKeyPath,'utf8'));

  const runtime={
    dedicatedOrigin:true,
    requiredOrigin:'https://record.officeofmethod.com',
    gatewayEnabled:true,
    gatewayUrl:'https://recognition.record.officeofmethod.com/api',
    gatewayPublicJwk,
    providerProfile:'remote',
    builtAt:new Date().toISOString()
  };
  await fs.writeFile(runtimePath,JSON.stringify(runtime,null,2)+'\n');

  const proxy={
    "$schema":"https://openapi.vercel.sh/vercel.json",
    "rewrites":[
      {"source":"/","destination":worker.origin+"/healthz"},
      {"source":"/api/:path*","destination":worker.origin+"/:path*"}
    ],
    "headers":[
      {"source":"/api/:path*","headers":[
        {"key":"Cache-Control","value":"no-store"},
        {"key":"X-Content-Type-Options","value":"nosniff"},
        {"key":"Referrer-Policy","value":"no-referrer"}
      ]}
    ]
  };
  await fs.mkdir(path.dirname(proxyPath),{recursive:true});
  await fs.writeFile(proxyPath,JSON.stringify(proxy,null,2)+'\n');

  console.log('Production public configuration written:');
  console.log(' - config/runtime.json');
  console.log(' - recognition-proxy/vercel.json');
  console.log('');
  console.log('Frontend origin: https://record.officeofmethod.com');
  console.log('Public gateway origin: https://recognition.record.officeofmethod.com/api');
  console.log('Cloudflare upstream:',worker.origin);
  console.log('');
  console.log('No private signing key, bootstrap secret or OpenAI API key was written to tracked files.');
}

if(process.argv.includes('--init')) await initSecrets();
else if(argValue('--worker-origin')) await configureProduction(argValue('--worker-origin'));
else {
  console.log('Usage:');
  console.log('  node scripts/recognition-bootstrap.mjs --init');
  console.log('  node scripts/recognition-bootstrap.mjs --worker-origin https://<worker>.<account>.workers.dev');
}
