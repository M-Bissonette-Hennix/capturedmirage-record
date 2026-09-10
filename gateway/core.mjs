const te=new TextEncoder();
export function stableStringify(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';}
export async function sha256Hex(bytes){const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);const h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function b64ToBytes(text){const bin=atob(text);return Uint8Array.from(bin,c=>c.charCodeAt(0));}
export function bytesToB64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);}
export async function importVerifyKey(jwk){return crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},true,['verify']);}
export async function importSignKey(jwk){return crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);}
export async function verifyRequestSignatureBytes({headers,bodyBytes,publicJwk,maxSkewMs=5*60_000,now=Date.now()}){
  const deviceId=headers.get('x-record-device'),timestamp=headers.get('x-record-timestamp'),nonce=headers.get('x-record-nonce'),bodyHash=headers.get('x-record-body-sha256'),signature=headers.get('x-record-signature');
  if(!deviceId||!timestamp||!nonce||!bodyHash||!signature)return {ok:false,reason:'missing-auth-header'};
  const time=Date.parse(timestamp);if(!Number.isFinite(time)||Math.abs(now-time)>maxSkewMs)return {ok:false,reason:'timestamp-skew'};
  const actual=await sha256Hex(bodyBytes);if(actual!==bodyHash)return {ok:false,reason:'body-hash'};
  let key;try{key=await importVerifyKey(publicJwk);}catch{return {ok:false,reason:'public-key'};}
  const message=stableStringify({bodyHash,deviceId,nonce,timestamp});let sig;try{sig=b64ToBytes(signature);}catch{return {ok:false,reason:'signature-encoding'};}
  const ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,sig,te.encode(message));return {ok,reason:ok?null:'signature',deviceId,nonce,timestamp,bodyHash};
}
export async function verifyRequestSignature({headers,bodyText,publicJwk,...rest}){return verifyRequestSignatureBytes({headers,bodyBytes:te.encode(bodyText),publicJwk,...rest});}
export async function signEnvelope(envelope,privateJwk){const clone=structuredClone(envelope);delete clone.signature;const key=await importSignKey(privateJwk);const sig=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,te.encode(stableStringify(clone))));return {...clone,signature:bytesToB64(sig)};}
export function safeEqual(a,b){a=String(a||'');b=String(b||'');if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
