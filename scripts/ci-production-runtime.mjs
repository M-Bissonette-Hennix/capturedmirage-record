import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const dir=path.join(process.cwd(),'.release');
await fs.mkdir(dir,{recursive:true});
const pair=await crypto.webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const pub=await crypto.webcrypto.subtle.exportKey('jwk',pair.publicKey);
pub.key_ops=['verify'];pub.ext=true;
const runtime={
  dedicatedOrigin:true,
  requiredOrigin:'https://record.officeofmethod.com',
  gatewayEnabled:true,
  gatewayUrl:'https://recognition.record.officeofmethod.com/api',
  gatewayPublicJwk:pub,
  providerProfile:'remote',
  builtAt:new Date().toISOString()
};
const target=path.join(dir,'runtime-ci-production.json');
await fs.writeFile(target,JSON.stringify(runtime,null,2)+'\n');
console.log(target);
