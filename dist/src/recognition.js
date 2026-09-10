import {APP, remoteRecognitionOriginAllowed} from './config.js';
import {DB} from './db.js';
import {ERR, RecordError} from './errors.js';
import {sha256Text, stableStringify, uuid} from './crypto.js';
import {signGatewayBytes, verifyGatewaySignature} from './device-auth.js';
import {validateRecognitionEnvelope, validateRecognitionJob} from './validators.js';
import {nowIso} from './record.js';

const te=new TextEncoder();
const td=new TextDecoder();

export function packRecognitionRequest(metadata,imageBytes){
  const meta=te.encode(stableStringify(metadata)),img=imageBytes instanceof Uint8Array?imageBytes:new Uint8Array(imageBytes);
  if(meta.length>64*1024)throw new RecordError(ERR.VIS_SCHEMA,'Recognition request metadata is too large.');
  const out=new Uint8Array(4+meta.length+img.length),v=new DataView(out.buffer);v.setUint32(0,meta.length,false);out.set(meta,4);out.set(img,4+meta.length);return out;
}
export function unpackRecognitionRequest(bytes){
  const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);if(b.length<5)throw new RecordError(ERR.VIS_SCHEMA,'Recognition binary request is truncated.');
  const n=new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(0,false);if(n<2||n>64*1024||4+n>=b.length)throw new RecordError(ERR.VIS_SCHEMA,'Recognition metadata length is invalid.');
  let metadata;try{metadata=JSON.parse(td.decode(b.subarray(4,4+n)));}catch{throw new RecordError(ERR.VIS_SCHEMA,'Recognition metadata JSON is invalid.');}
  return {metadata,imageBytes:b.subarray(4+n)};
}

export class FixtureRecognitionProvider{
  constructor(fixture){this.fixture=fixture;this.name='fixture';}
  async recognize(input){
    const env=structuredClone(this.fixture);env.schema=APP.recognitionEnvelopeSchema;env.requestId=input.requestId;env.gameId=input.gameId;env.pageId=input.pageId;env.sourceSha256=input.sourceSha256;env.runSequence=input.runSequence;env.supersedesRequestId=input.supersedesRequestId;
    env.derivedAsset={...env.derivedAsset,id:input.derivedAsset.id,sha256:input.derivedAsset.sha256,mime:input.derivedAsset.mime,width:input.derivedAsset.width,height:input.derivedAsset.height,preprocessorVersion:input.derivedAsset.preprocessorVersion};env.gateway={build:'fixture-local/3',keyId:'UNSIGNED_FIXTURE',signedAt:nowIso()};env.signature='';validateRecognitionEnvelope(env);return env;
  }
}

export class RemoteGatewayRecognitionProvider{
  constructor(settings){this.settings=settings;this.name='remote-gateway';}
  async recognize(input){
    if(!remoteRecognitionOriginAllowed(this.settings))throw new RecordError(ERR.VIS_ORIGIN,'Remote recognition is blocked until RECORD runs on its dedicated HTTPS origin and gateway settings match that origin.');
    const imageBytes=new Uint8Array(await input.derivedAsset.blob.arrayBuffer());
    const metadata={schema:'record-recognition-request/2',requestId:input.requestId,gameId:input.gameId,pageId:input.pageId,sourceSha256:input.sourceSha256,runSequence:input.runSequence,runKind:input.runKind,supersedesRequestId:input.supersedesRequestId,derivedAsset:{id:input.derivedAsset.id,sha256:input.derivedAsset.sha256,mime:input.derivedAsset.mime,width:input.derivedAsset.width,height:input.derivedAsset.height,preprocessorVersion:input.derivedAsset.preprocessorVersion},idempotencyKey:input.idempotencyKey};
    const body=packRecognitionRequest(metadata,imageBytes),signed=await signGatewayBytes(body);if(!signed.registered)throw new RecordError(ERR.VIS_AUTH,'This device has not been registered with the recognition gateway.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45_000);let res;
    try{res=await fetch(this.settings.gatewayUrl.replace(/\/$/,'')+'/recognize',{method:'POST',headers:{'content-type':'application/octet-stream','x-record-device':signed.deviceId,'x-record-timestamp':signed.timestamp,'x-record-nonce':signed.nonce,'x-record-body-sha256':signed.bodyHash,'x-record-signature':signed.signature,'x-record-idempotency-key':input.idempotencyKey},body,signal:controller.signal,redirect:'error'});}catch(e){if(e.name==='AbortError')throw new RecordError(ERR.VIS_TIMEOUT,'Recognition gateway timed out.');throw new RecordError(ERR.VIS_GATEWAY,'Recognition gateway could not be reached.',{cause:String(e)});}finally{clearTimeout(timer);}
    if(res.status===401||res.status===403)throw new RecordError(ERR.VIS_AUTH,'Recognition gateway rejected device authentication.');if(res.status===409)throw new RecordError(ERR.VIS_BINDING,'Recognition gateway rejected replay/idempotency binding.');if(res.status===429)throw new RecordError(ERR.VIS_GATEWAY,'Recognition gateway rate/budget limit reached.');if(!res.ok)throw new RecordError(ERR.VIS_GATEWAY,`Recognition gateway returned HTTP ${res.status}.`);
    let env;try{env=await res.json();}catch{throw new RecordError(ERR.VIS_SCHEMA,'Recognition gateway did not return valid JSON.');}validateRecognitionEnvelope(env);
    if(env.requestId!==input.requestId||env.gameId!==input.gameId||env.pageId!==input.pageId||env.runSequence!==input.runSequence||env.supersedesRequestId!==input.supersedesRequestId||env.sourceSha256!==input.sourceSha256||env.derivedAsset.sha256!==input.derivedAsset.sha256)throw new RecordError(ERR.VIS_DIGEST,'Recognition response is not bound to the submitted evidence/run.');
    if(!this.settings.gatewayPublicJwk||!(await verifyGatewaySignature(env,this.settings.gatewayPublicJwk)))throw new RecordError(ERR.VIS_AUTH,'Recognition response signature could not be verified against the pinned gateway key.');return env;
  }
}

async function idempotencyFor({page,derivedAsset,providerProfile,runSequence,runKind}){return sha256Text(stableStringify({sourceSha256:page.sha256,derivedSha256:derivedAsset.sha256,providerProfile,preprocessorVersion:derivedAsset.preprocessorVersion,pageId:page.id,runSequence,runKind}));}
export async function createRecognitionJob({game,page,derivedAsset,providerProfile,runKind='INITIAL',supersedesRequestId=null}){
  if(!['INITIAL','RERUN'].includes(runKind))throw new RecordError(ERR.VIS_SCHEMA,'Recognition run kind is invalid.');
  const runSequence=await DB.nextRunSequence(game.id,page.id);if(runKind==='RERUN'&&!supersedesRequestId){const existing=(await DB.jobs(game.id)).filter(j=>j.pageId===page.id&&j.status==='COMPLETE').sort((a,b)=>b.runSequence-a.runSequence);supersedesRequestId=existing[0]?.id||null;}
  const idempotencyKey=await idempotencyFor({page,derivedAsset,providerProfile,runSequence,runKind}),t=nowIso(),job={id:uuid(),schema:APP.recognitionJobSchema,gameId:game.id,pageId:page.id,sourceSha256:page.sha256,derivedSha256:derivedAsset.sha256,status:'QUEUED',attempt:0,idempotencyKey,providerProfile,createdAt:t,updatedAt:t,lastError:null,nextAttemptAt:null,recordRevision:game.revision,sourceRevision:game.sourceRevision,runSequence,runKind,supersedesRequestId};
  validateRecognitionJob(job);await DB.putJob(job);await DB.mutateGame(game.id,{eventType:runKind==='RERUN'?'RECOGNITION_RERUN_QUEUED':'RECOGNITION_QUEUED',payload:{jobId:job.id,pageId:page.id,runSequence,supersedesRequestId},evidenceBearing:false,actor:'SYSTEM'},g=>{g.workflowState='VISION_PENDING';});return job;
}
export async function retryRecognitionJob(job){validateRecognitionJob(job);if(!['FAILED_RETRYABLE','QUEUED'].includes(job.status))throw new RecordError(ERR.VIS_SCHEMA,'Only queued/retryable recognition jobs can be retried.');const next={...job,status:'QUEUED',updatedAt:nowIso(),lastError:null,nextAttemptAt:null};await DB.putJob(next);return next;}

export async function processRecognitionJob(job,{provider,derivedAsset}){
  if(!['QUEUED','FAILED_RETRYABLE'].includes(job.status))return job;
  const currentGame=await DB.getGame(job.gameId);if(!currentGame)throw new RecordError(ERR.VIS_SCHEMA,'Recognition job references a missing game.');if(currentGame.sourceRevision!==job.sourceRevision)throw new RecordError(ERR.VIS_DIGEST,'Source pages changed after this recognition job was created.');
  job={...job,status:'UPLOADING',attempt:job.attempt+1,updatedAt:nowIso(),lastError:null,nextAttemptAt:null};await DB.putJob(job);
  try{
    job={...job,status:'PROCESSING',updatedAt:nowIso()};await DB.putJob(job);
    const env=await provider.recognize({requestId:job.id,gameId:job.gameId,pageId:job.pageId,sourceSha256:job.sourceSha256,derivedAsset,idempotencyKey:job.idempotencyKey,runSequence:job.runSequence,runKind:job.runKind,supersedesRequestId:job.supersedesRequestId});validateRecognitionEnvelope(env);
    job={...job,status:'COMPLETE',updatedAt:nowIso()};await DB.commitRecognitionResult(env,job);
    if(job.runKind==='RERUN')await DB.supersedePriorRecognitionJobs(job.gameId,job.pageId,job.id,job.runSequence);
    await DB.mutateGame(job.gameId,{eventType:'RECOGNITION_COMPLETED',payload:{jobId:job.id,pageId:job.pageId,runSequence:job.runSequence},evidenceBearing:false,actor:'VISION'},g=>{g.workflowState='OBSERVATIONS_AVAILABLE';});return job;
  }catch(error){const retryable=[ERR.VIS_GATEWAY,ERR.VIS_TIMEOUT].includes(error.code),delay=Math.min(15*60_000,Math.max(15_000,2**Math.min(job.attempt,6)*5000));job={...job,status:retryable?'FAILED_RETRYABLE':'FAILED_TERMINAL',updatedAt:nowIso(),lastError:`${error.code||'REC-UNK'}: ${error.message}`,nextAttemptAt:retryable?new Date(Date.now()+delay).toISOString():null};await DB.putJob(job);await DB.mutateGame(job.gameId,{eventType:'RECOGNITION_FAILED',payload:{jobId:job.id,error:job.lastError},evidenceBearing:false,actor:'SYSTEM'},()=>{});throw error;}
}

export async function processEligibleJobs(providerResolver){
  if(typeof document!=='undefined'&&document.visibilityState!=='visible')return;await DB.reconcileRecognitionJobs();const jobs=await DB.jobs(),now=Date.now();for(const job of jobs.filter(j=>j.status==='QUEUED'||(j.status==='FAILED_RETRYABLE'&&(!j.nextAttemptAt||Date.parse(j.nextAttemptAt)<=now)))){try{const assets=await DB.derivedForPage(job.gameId,job.pageId),derived=assets.find(a=>a.purpose==='recognition'&&a.sha256===job.derivedSha256);if(!derived)continue;await processRecognitionJob(job,{provider:await providerResolver(job),derivedAsset:derived});}catch{}}
}
