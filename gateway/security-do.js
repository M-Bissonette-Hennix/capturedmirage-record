import {safeEqual,stableStringify,sha256Hex,b64ToBytes,importVerifyKey} from './core.mjs';

const te=new TextEncoder();
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const safeId=v=>/^[A-Za-z0-9._-]{8,96}$/.test(String(v||''));
const safeHash=v=>/^[a-f0-9]{64}$/i.test(String(v||''));

async function verifyDescriptor({descriptor,publicJwk}){
  const {deviceId,timestamp,nonce,bodyHash,signature}=descriptor||{};if(!safeId(deviceId)||!safeId(nonce)||!safeHash(bodyHash)||typeof signature!=='string')return {ok:false,reason:'auth-shape'};
  const time=Date.parse(timestamp);if(!Number.isFinite(time)||Math.abs(Date.now()-time)>5*60_000)return {ok:false,reason:'timestamp-skew'};
  let key,sig;try{key=await importVerifyKey(publicJwk);sig=b64ToBytes(signature);}catch{return {ok:false,reason:'auth-key'};}
  const message=stableStringify({bodyHash,deviceId,nonce,timestamp});const ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,sig,te.encode(message));return {ok,reason:ok?null:'signature'};
}

export class RecordSecurityCoordinator{
  constructor(state,env){this.state=state;this.env=env;}
  async fetch(request){
    const path=new URL(request.url).pathname;let body;try{body=await request.json();}catch{return json({error:'invalid-json'},400);}
    if(path==='/register')return this.register(body);
    if(path==='/authorize')return this.authorize(body);
    if(path==='/complete')return this.complete(body);
    if(path==='/fail')return this.fail(body);
    return json({error:'not-found'},404);
  }
  async register(body){
    const {deviceId,publicJwk,bootstrapTokenId,bootstrapSecret,expectedTokenId,expectedSecret,ip='unknown',limit=5}=body||{};
    if(!safeId(deviceId)||!safeId(bootstrapTokenId)||typeof bootstrapSecret!=='string'||typeof expectedTokenId!=='string'||typeof expectedSecret!=='string'||!publicJwk)return json({error:'invalid-request'},400);
    if(!safeEqual(bootstrapTokenId,expectedTokenId)||!safeEqual(bootstrapSecret,expectedSecret))return json({error:'unauthorized'},401);
    try{await crypto.subtle.importKey('jwk',publicJwk,{name:'ECDSA',namedCurve:'P-256'},true,['verify']);}catch{return json({error:'invalid-public-key'},400);}
    let result={status:500,body:{error:'transaction-failed'}};
    await this.state.storage.transaction(async txn=>{
      const minute=Math.floor(Date.now()/60_000),rk=`register-rate:${ip}:${minute}`,used=Number(await txn.get(rk)||0);if(used>=Number(limit||5)){result={status:429,body:{error:'registration-rate-limit'}};return;}await txn.put(rk,used+1);
      const consumed=await txn.get(`bootstrap-consumed:${bootstrapTokenId}`);if(consumed){result={status:409,body:{error:'bootstrap-consumed'}};return;}
      if(await txn.get(`device:${deviceId}`)){result={status:409,body:{error:'device-exists'}};return;}
      await txn.put(`bootstrap-consumed:${bootstrapTokenId}`,{deviceId,consumedAt:new Date().toISOString()});await txn.put(`device:${deviceId}`,{publicJwk,registeredAt:new Date().toISOString()});result={status:200,body:{registered:true,deviceId}};
    });return json(result.body,result.status);
  }
  async authorize(body){
    const {descriptor,idempotencyKey,binding,minuteLimit=10,dailyLimit=100}=body||{};if(!descriptor||!safeHash(idempotencyKey)||!binding||!safeId(descriptor.deviceId))return json({error:'invalid-request'},400);
    const device=await this.state.storage.get(`device:${descriptor.deviceId}`);if(!device)return json({error:'device-not-registered'},401);
    const verified=await verifyDescriptor({descriptor,publicJwk:device.publicJwk});if(!verified.ok)return json({error:'auth-failed',reason:verified.reason},401);
    const bindingHash=await sha256Hex(te.encode(stableStringify(binding))),cacheKey=`idem:${descriptor.deviceId}:${idempotencyKey}`,nonceKey=`nonce:${descriptor.deviceId}:${descriptor.nonce}`,reservationId=crypto.randomUUID();let result={status:500,body:{error:'transaction-failed'}};
    await this.state.storage.transaction(async txn=>{
      if(await txn.get(nonceKey)){result={status:409,body:{error:'replay'}};return;}await txn.put(nonceKey,{seenAt:Date.now()});
      const cached=await txn.get(cacheKey);if(cached){if(cached.bindingHash!==bindingHash){result={status:409,body:{error:'idempotency-binding-mismatch'}};return;}if(cached.state==='COMPLETE'){result={status:200,body:{cached:true,response:cached.response}};return;}if(cached.state==='PROCESSING'){result={status:409,body:{error:'request-already-processing'}};return;}}
      const minute=Math.floor(Date.now()/60_000),burstKey=`burst:${descriptor.deviceId}:${minute}`,burst=Number(await txn.get(burstKey)||0);if(burst>=Number(minuteLimit)){result={status:429,body:{error:'rate-limit'}};return;}
      const day=new Date().toISOString().slice(0,10),dayKey=`daily:${descriptor.deviceId}:${day}`,daily=Number(await txn.get(dayKey)||0);if(daily>=Number(dailyLimit)){result={status:429,body:{error:'budget-exceeded'}};return;}
      await txn.put(burstKey,burst+1);await txn.put(dayKey,daily+1);await txn.put(cacheKey,{state:'PROCESSING',bindingHash,reservationId,startedAt:Date.now()});result={status:200,body:{cached:false,reservationId,bindingHash}};
    });return json(result.body,result.status);
  }
  async complete(body){
    const {deviceId,idempotencyKey,bindingHash,reservationId,response}=body||{};if(!safeId(deviceId)||!safeHash(idempotencyKey)||!safeHash(bindingHash)||typeof reservationId!=='string'||typeof response!=='string')return json({error:'invalid-request'},400);const key=`idem:${deviceId}:${idempotencyKey}`;let ok=false;
    await this.state.storage.transaction(async txn=>{const x=await txn.get(key);if(x?.state==='PROCESSING'&&safeEqual(x.bindingHash,bindingHash)&&safeEqual(x.reservationId,reservationId)){await txn.put(key,{state:'COMPLETE',bindingHash,response,completedAt:Date.now()});ok=true;}});return ok?json({complete:true}):json({error:'reservation-mismatch'},409);
  }
  async fail(body){
    const {deviceId,idempotencyKey,bindingHash,reservationId}=body||{};if(!safeId(deviceId)||!safeHash(idempotencyKey)||!safeHash(bindingHash)||typeof reservationId!=='string')return json({error:'invalid-request'},400);const key=`idem:${deviceId}:${idempotencyKey}`;let ok=false;
    await this.state.storage.transaction(async txn=>{const x=await txn.get(key);if(x?.state==='PROCESSING'&&safeEqual(x.bindingHash,bindingHash)&&safeEqual(x.reservationId,reservationId)){await txn.delete(key);ok=true;}});return ok?json({released:true}):json({error:'reservation-mismatch'},409);
  }
}
