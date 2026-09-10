import {APP} from './config.js';
import {ERR, RecordError} from './errors.js';
import {START_FEN, makeMove, parseFen, pgnFromGame, replayMoves, gameStatus} from './chess.js';
import {sha256Bytes, sha256Text, stableStringify, timingSafeEqualText, uuid} from './crypto.js';
import {validateGame, validateRecognitionEnvelope, validateSourcePage} from './validators.js';

export const nowIso = () => new Date().toISOString();

export function createGame() {
  const t = nowIso();
  return {
    id: uuid(), schema: APP.gameSchema, recordType:'PLAYED_GAME', createdAt:t, updatedAt:t,
    revision:0, sourceRevision:0, workflowState:'NEW', certificationStatus:'UNCERTIFIED',
    metadata:{event:'',site:'',date:t.slice(0,10).replaceAll('-','.'),round:'',board:'',section:'',white:'',black:'',result:'*',timeControl:'',resultProvenance:'UNKNOWN'},
    startFen:START_FEN, moves:[], notes:'', certification:null, flags:{needsReview:false},
  };
}

export function invalidateCertification(game, reason='EVIDENCE_CHANGED') {
  const had = game.certification !== null || game.certificationStatus === 'VALID';
  game.certification = null;
  game.certificationStatus = had ? 'INVALIDATED' : 'UNCERTIFIED';
  if (['COMPLETE','EXPORTED'].includes(game.workflowState)) game.workflowState='EDITING';
  return {invalidated:had,reason};
}

export function appendMove(game,input,provenance='USER_ENTERED',refs={}) {
  const {state}=validateRecord(game);
  const r=makeMove(state,input);
  game.moves.push({ply:game.moves.length+1,san:r.move.san,uci:r.move.uci,beforeFen:r.move.before,afterFen:r.move.after,provenance,sourceRefs:[...(refs.sourceRefs||[])],observationRefs:[...(refs.observationRefs||[])]});
  game.workflowState='EDITING';game.flags.needsReview=false;applyAutomaticResult(game);return r.move;
}

export function undoMove(game){if(!game.moves.length)return null;const removed=game.moves.pop();if((game.metadata.resultProvenance||'').startsWith('AUTO_')){game.metadata.result='*';game.metadata.resultProvenance='UNKNOWN';}game.workflowState=game.moves.length?'EDITING':'CAPTURED';game.flags.needsReview=false;return removed;}

export function rebuildFromSans(game,sans,provenance='USER_CORRECTED'){
  let state=parseFen(game.startFen);const moves=[];
  for(let i=0;i<sans.length;i++){const r=makeMove(state,sans[i]);moves.push({ply:i+1,san:r.move.san,uci:r.move.uci,beforeFen:r.move.before,afterFen:r.move.after,provenance,sourceRefs:[],observationRefs:[]});state=r.state;}
  game.moves=moves;game.workflowState=moves.length?'EDITING':'CAPTURED';game.flags.needsReview=false;applyAutomaticResult(game);
}

export function replaceMoveAt(game,index,newSan){
  if(!Number.isInteger(index)||index<0||index>=game.moves.length)throw new RecordError(ERR.GAME_INVALID,'Move index out of range.');
  const old=[...game.moves],tail=old.slice(index+1).map(m=>m.san),prefix=old.slice(0,index).map(m=>m.san);let state=parseFen(game.startFen),rebuilt=[];
  for(let i=0;i<prefix.length;i++){const r=makeMove(state,prefix[i]),o=old[i];rebuilt.push({...o,ply:i+1,san:r.move.san,uci:r.move.uci,beforeFen:r.move.before,afterFen:r.move.after});state=r.state;}
  {const r=makeMove(state,newSan),o=old[index];rebuilt.push({ply:index+1,san:r.move.san,uci:r.move.uci,beforeFen:r.move.before,afterFen:r.move.after,provenance:'USER_CORRECTED',sourceRefs:o?.sourceRefs||[],observationRefs:o?.observationRefs||[]});state=r.state;}
  let tailAccepted=0;for(const san of tail){try{const r=makeMove(state,san),o=old[rebuilt.length];rebuilt.push({...o,ply:rebuilt.length+1,san:r.move.san,uci:r.move.uci,beforeFen:r.move.before,afterFen:r.move.after});state=r.state;tailAccepted++;}catch{break;}}
  game.moves=rebuilt;game.flags.needsReview=tailAccepted!==tail.length;game.workflowState=game.flags.needsReview?'READY_FOR_REVIEW':'EDITING';applyAutomaticResult(game);return {tailAccepted,tailOriginal:tail.length};
}

export function deleteFromPly(game,index){if(!Number.isInteger(index)||index<0||index>game.moves.length)throw new RecordError(ERR.GAME_INVALID,'Move index out of range.');game.moves=game.moves.slice(0,index).map((m,i)=>({...m,ply:i+1}));game.workflowState=game.moves.length?'EDITING':'CAPTURED';game.flags.needsReview=false;if((game.metadata.resultProvenance||'').startsWith('AUTO_')){game.metadata.result='*';game.metadata.resultProvenance='UNKNOWN';}}

export function applyReconstructionPath(game,path){
  if(!path||!Array.isArray(path.moves))throw new RecordError(ERR.REC_NO_PATH,'Reconstruction path is invalid.');
  game.moves=path.moves.map((m,i)=>({ply:i+1,san:m.san,uci:m.uci,beforeFen:m.beforeFen,afterFen:m.afterFen,provenance:m.provenance,sourceRefs:[...m.sourceRefs],observationRefs:[...m.observationRefs]}));
  game.flags.needsReview=!!path.requiresReview;game.workflowState=path.requiresReview?'READY_FOR_REVIEW':'EDITING';applyAutomaticResult(game);
}

export function validateRecord(game){validateGame(game);const replay=replayMoves(game.moves,game.startFen);if(game.moves.some(m=>m.provenance==='UNRESOLVED'))throw new RecordError(ERR.GAME_INVALID,'Record contains unresolved plies.');return replay;}
export function validateRecordAllowUnresolved(game){validateGame(game);return replayMoves(game.moves,game.startFen);}
function positionHistoryFromGame(game){return [game.startFen,...game.moves.map(m=>m.afterFen)];}
export function applyAutomaticResult(game){let replay;try{replay=validateRecordAllowUnresolved(game);}catch{return;}const status=gameStatus(replay.state,{positionHistory:positionHistoryFromGame(game)});if(status.over){game.metadata.result=status.result;game.metadata.resultProvenance=status.reason==='checkmate'?'AUTO_CHECKMATE':status.reason==='stalemate'?'AUTO_STALEMATE':'AUTO_DRAW';}else if((game.metadata.resultProvenance||'').startsWith('AUTO_')){game.metadata.result='*';game.metadata.resultProvenance='UNKNOWN';}}

export async function verifySourceIntegrity(pages){const ordered=[...pages].sort((a,b)=>a.order-b.order),seen=new Set();for(let i=0;i<ordered.length;i++){const p=ordered[i];validateSourcePage(p);if(p.order!==i||seen.has(p.order))throw new RecordError(ERR.CERT_SOURCE,'Source page ordering is not canonical.');seen.add(p.order);const actual=await sha256Bytes(new Uint8Array(await p.blob.arrayBuffer()));if(!timingSafeEqualText(actual,p.sha256))throw new RecordError(ERR.CERT_SOURCE,`Source digest mismatch on page ${i+1}.`);}return ordered;}
export function sourceDescriptors(pages){return [...pages].sort((a,b)=>a.order-b.order).map(p=>({id:p.id,order:p.order,mime:p.mime,size:p.size,width:p.width,height:p.height,sha256:p.sha256}));}

function expectedMoveCoordinates(ply){return {moveNumber:Math.floor((ply+1)/2),side:ply%2===1?'white':'black'};}
export function resolveObservationRef(ref,observations){
  const matches=[];for(const env of observations){validateRecognitionEnvelope(env);const prefix=`${env.requestId}:`;if(!ref.startsWith(prefix))continue;const cellId=ref.slice(prefix.length),cell=env.cells.find(c=>c.id===cellId);if(cell)matches.push({env,cell});}
  if(matches.length!==1)throw new RecordError(ERR.CERT_OBSERVATION,`Observation reference ${ref} resolved ${matches.length} times; exactly one match is required.`);return matches[0];
}

export async function observationDescriptorsForMoves(game,pages,observations=[]){
  const pageById=new Map(pages.map(p=>[p.id,p])),used=new Map();
  for(const move of game.moves){for(const ref of move.observationRefs){const {env,cell}=resolveObservationRef(ref,observations);if(env.gameId!==game.id)throw new RecordError(ERR.CERT_OBSERVATION,`Move ${move.ply} observation belongs to another game.`);const page=pageById.get(env.pageId);if(!page)throw new RecordError(ERR.CERT_OBSERVATION,`Move ${move.ply} observation references a missing source page.`);if(!timingSafeEqualText(page.sha256,env.sourceSha256))throw new RecordError(ERR.CERT_OBSERVATION,`Move ${move.ply} observation source digest does not match the source page.`);const expected=expectedMoveCoordinates(move.ply);if(cell.moveNumber!==expected.moveNumber||cell.side!==expected.side)throw new RecordError(ERR.CERT_OBSERVATION,`Move ${move.ply} observation points to ${cell.moveNumber}${cell.side==='white'?'.':'...'}, not the expected ply.`);const descriptor={ref,requestId:env.requestId,cellId:cell.id,pageId:env.pageId,sourceSha256:env.sourceSha256,derivedAssetId:env.derivedAsset.id,derivedSha256:env.derivedAsset.sha256,runSequence:env.runSequence,provider:env.provider,gateway:{build:env.gateway.build,keyId:env.gateway.keyId,signedAt:env.gateway.signedAt},signatureSha256:await sha256Text(env.signature||''),crop:cell.crop};used.set(ref,descriptor);}}
  return [...used.values()].sort((a,b)=>a.ref.localeCompare(b.ref));
}

export function canonicalCertificationRecordFromDescriptors(game,sources,observationDescriptors=[]){return {schema:'record-certification-canonical/3',game:{id:game.id,schema:game.schema,recordType:game.recordType,revision:game.revision,sourceRevision:game.sourceRevision,metadata:game.metadata,startFen:game.startFen,moves:game.moves,notes:game.notes},sources:[...sources].sort((a,b)=>a.order-b.order).map(s=>({id:s.id,order:s.order,mime:s.mime,size:s.size,width:s.width,height:s.height,sha256:s.sha256})),observations:[...observationDescriptors].sort((a,b)=>a.ref.localeCompare(b.ref))};}
export async function canonicalCertificationRecord(game,pages,observations=[]){const ordered=await verifySourceIntegrity(pages);const obs=await observationDescriptorsForMoves(game,ordered,observations);return canonicalCertificationRecordFromDescriptors(game,sourceDescriptors(ordered),obs);}

export async function canCertify(game,pages,observations=[]){
  try{
    validateRecord(game);
    if(game.recordType==='PLAYED_GAME'&&game.moves.length<1)throw new RecordError(ERR.CERT_INVALID,'A played-game record must contain at least one ply before certification.');
    if(game.flags.needsReview)throw new RecordError(ERR.CERT_REVIEW,'Record is explicitly marked as needing review.');
    if(game.recordType==='PLAYED_GAME'&&pages.length<1)throw new RecordError(ERR.CERT_SOURCE,'A played physical-game record requires at least one source page.');
    const ordered=await verifySourceIntegrity(pages),pageIds=new Set(ordered.map(p=>p.id));
    for(const move of game.moves){for(const ref of move.sourceRefs)if(!pageIds.has(ref))throw new RecordError(ERR.CERT_SOURCE,`Move ${move.ply} references a missing source page.`);if(['SHEET_DIRECT','SHEET_CONSTRAINED'].includes(move.provenance)&&move.sourceRefs.length===0)throw new RecordError(ERR.CERT_SOURCE,`Move ${move.ply} claims sheet provenance without a source reference.`);}
    const obsDescriptors=await observationDescriptorsForMoves(game,ordered,observations),observationRoot=await sha256Text(stableStringify(obsDescriptors));
    const canonical=canonicalCertificationRecordFromDescriptors(game,sourceDescriptors(ordered),obsDescriptors),canonicalHash=await sha256Text(stableStringify(canonical));return {ok:true,canonicalHash,observationRoot,canonical,ordered,observationDescriptors:obsDescriptors};
  }catch(error){return {ok:false,error};}
}

export async function computeCanonicalHash(game,pages,observations=[]){const gate=await canCertify(game,pages,observations);if(!gate.ok)throw gate.error;return gate.canonicalHash;}
export async function buildCertification(game,pages,observations=[]){const gate=await canCertify(game,pages,observations);if(!gate.ok)throw gate.error;return {assertionVersion:'record-certification/3',recordRevision:game.revision,sourceRevision:game.sourceRevision,canonicalHash:gate.canonicalHash,observationRoot:gate.observationRoot,certifiedAt:nowIso(),recordType:game.recordType,assertion:'User certifies that the digital game record reflects the game actually played or recorded disposition to the best of their knowledge, after review of the linked source evidence and unresolved-state warnings.'};}

export async function verifyCertification(game,pages,observations=[]){
  try{
    validateGame(game);if(!game.certification)return {status:'INVALIDATED'};if(game.certification.recordRevision!==game.revision||game.certification.sourceRevision!==game.sourceRevision)return {status:'INVALIDATED'};
    const gate=await canCertify(game,pages,observations);if(!gate.ok){if(gate.error?.code===ERR.CERT_SOURCE)return {status:'SOURCE_MISMATCH',error:gate.error};if(gate.error?.code===ERR.CERT_OBSERVATION)return {status:'OBSERVATION_MISMATCH',error:gate.error};if(gate.error?.code===ERR.CERT_REVIEW)return {status:'REVIEW_REQUIRED',error:gate.error};return {status:'MOVE_LEDGER_INVALID',error:gate.error};}
    if(!timingSafeEqualText(gate.canonicalHash,game.certification.canonicalHash))return {status:'HASH_MISMATCH',current:gate.canonicalHash};if(!timingSafeEqualText(gate.observationRoot,game.certification.observationRoot))return {status:'OBSERVATION_MISMATCH'};return {status:'VALID',canonicalHash:gate.canonicalHash,observationRoot:gate.observationRoot};
  }catch(error){return {status:'SCHEMA_INVALID',error};}
}

export function gamePgn(game){return pgnFromGame(game);}
