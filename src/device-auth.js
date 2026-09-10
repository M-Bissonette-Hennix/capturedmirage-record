import {DB} from './db.js';
import {base64ToBytes, bytesToBase64, randomNonce, sha256Bytes, stableStringify, uuid} from './crypto.js';
import {ERR, RecordError} from './errors.js';

const ALG={name:'ECDSA',namedCurve:'P-256'};
const te=new TextEncoder();
export async function ensureDeviceIdentity(){
  const existing=await DB.getDeviceKey();if(existing?.privateKey&&existing?.publicJwk)return existing;
  const pair=await crypto.subtle.generateKey(ALG,false,['sign','verify']);
  const publicJwk=await crypto.subtle.exportKey('jwk',pair.publicKey);
  const value={id:'device',deviceId:uuid(),createdAt:new Date().toISOString(),privateKey:pair.privateKey,publicJwk,registered:false,registeredAt:null};
  await DB.setDeviceKey(value);return value;
}
async function signBodyBytes(bytes){
  const identity=await ensureDeviceIdentity(),timestamp=new Date().toISOString(),nonce=randomNonce(),bodyHash=await sha256Bytes(bytes);
  const message=stableStringify({bodyHash,deviceId:identity.deviceId,nonce,timestamp});
  const sig=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},identity.privateKey,te.encode(message)));
  return {deviceId:identity.deviceId,timestamp,nonce,bodyHash,signature:bytesToBase64(sig),publicJwk:identity.publicJwk,registered:identity.registered};
}
export async function signGatewayBytes(bytes){return signBodyBytes(bytes instanceof Uint8Array?bytes:new Uint8Array(bytes));}
export async function signGatewayRequest(bodyObject){const body=stableStringify(bodyObject),bytes=te.encode(body),signed=await signBodyBytes(bytes);return {...signed,body};}
export async function markDeviceRegistered(){const identity=await ensureDeviceIdentity();identity.registered=true;identity.registeredAt=new Date().toISOString();await DB.setDeviceKey(identity);return identity;}
export async function importGatewayVerifyKey(jwk){try{return await crypto.subtle.importKey('jwk',jwk,ALG,true,['verify']);}catch(e){throw new RecordError(ERR.VIS_AUTH,'Gateway verification key is invalid.',{cause:String(e)});}}
export async function verifyGatewaySignature(envelope,gatewayPublicJwk){
  if(!gatewayPublicJwk)return false;const key=await importGatewayVerifyKey(gatewayPublicJwk);let signature;try{signature=base64ToBytes(envelope.signature||'');}catch{return false;}const clone=structuredClone(envelope);delete clone.signature;return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,signature,te.encode(stableStringify(clone)));
}

export function parseBootstrapCapability(value){
  const text=String(value||'').trim(),i=text.indexOf('.');
  if(i<8||i===text.length-1)throw new RecordError(ERR.VIS_AUTH,'Bootstrap capability must be entered as TOKEN_ID.SECRET.');
  const tokenId=text.slice(0,i),secret=text.slice(i+1);
  if(!/^[A-Za-z0-9_-]{8,96}$/.test(tokenId)||secret.length<24||secret.length>512)throw new RecordError(ERR.VIS_AUTH,'Bootstrap capability is malformed.');
  return {tokenId,secret};
}
export async function registerDevice(gatewayUrl,bootstrapCapability){
  if(!/^https:\/\//i.test(gatewayUrl||''))throw new RecordError(ERR.VIS_GATEWAY,'Gateway registration requires an HTTPS URL.');
  const {tokenId,secret}=typeof bootstrapCapability==='string'?parseBootstrapCapability(bootstrapCapability):bootstrapCapability||{};
  if(!/^[A-Za-z0-9_-]{8,96}$/.test(String(tokenId||''))||typeof secret!=='string'||secret.length<24||secret.length>512)throw new RecordError(ERR.VIS_AUTH,'Bootstrap capability is missing or invalid.');
  const identity=await ensureDeviceIdentity();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30_000);let res;
  try{res=await fetch(gatewayUrl.replace(/\/$/,'')+'/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({deviceId:identity.deviceId,publicJwk:identity.publicJwk,bootstrapTokenId:tokenId,bootstrapSecret:secret}),signal:controller.signal,redirect:'error'});}catch(e){if(e.name==='AbortError')throw new RecordError(ERR.VIS_TIMEOUT,'Gateway registration timed out.');throw new RecordError(ERR.VIS_GATEWAY,'Gateway registration failed.',{cause:String(e)});}finally{clearTimeout(timer);}
  if(res.status===409)throw new RecordError(ERR.VIS_AUTH,'Bootstrap capability was already consumed or this device ID is already registered.');
  if(!res.ok)throw new RecordError(ERR.VIS_AUTH,`Gateway registration rejected the request (HTTP ${res.status}).`);
  const body=await res.json();await markDeviceRegistered();return body;
}
