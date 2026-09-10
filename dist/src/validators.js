import {APP, CERTIFICATION_STATUSES, JOB_STATUSES, LIMITS, MOVE_PROVENANCE, OBSERVATION_TRUST, RECORD_TYPES, WORKFLOW_STATES} from './config.js';
import {ERR, RecordError} from './errors.js';

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const ownKeysOnly = (obj, allowed, label) => {
  for (const k of Object.keys(obj)) if (!allowed.has(k)) throw new RecordError(ERR.DB_SCHEMA, `${label} contains unknown field: ${k}`);
};
const str = (v, max, label, allowEmpty = true) => {
  if (typeof v !== 'string') throw new RecordError(ERR.DB_SCHEMA, `${label} must be a string.`);
  if ((!allowEmpty && !v.length) || v.length > max) throw new RecordError(ERR.DB_SCHEMA, `${label} length is invalid.`);
};
const iso = (v, label) => { str(v, 64, label, false); if (Number.isNaN(Date.parse(v))) throw new RecordError(ERR.DB_SCHEMA, `${label} is not an ISO timestamp.`); };
const hex64 = (v, label) => { if (!/^[a-f0-9]{64}$/i.test(String(v || ''))) throw new RecordError(ERR.DB_SCHEMA, `${label} must be a SHA-256 hex digest.`); };
const id = (v, label) => { str(v, 96, label, false); if (!/^[A-Za-z0-9._-]{8,96}$/.test(v)) throw new RecordError(ERR.DB_SCHEMA, `${label} contains unsafe characters.`); };
const nullableId = (v,label) => { if(v===null)return; id(v,label); };
const bool = (v,label) => { if(typeof v!=='boolean')throw new RecordError(ERR.DB_SCHEMA,`${label} must be boolean.`); };
const finite = (v,label,min=-Infinity,max=Infinity) => { if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new RecordError(ERR.DB_SCHEMA,`${label} is outside bounds.`); };

export function validateMetadata(m) {
  if (!plain(m)) throw new RecordError(ERR.DB_SCHEMA, 'metadata must be an object.');
  const keys = new Set(['event','site','date','round','board','section','white','black','result','timeControl','resultProvenance']);
  ownKeysOnly(m, keys, 'metadata');
  for (const k of ['event','site','date','round','board','section','white','black']) str(m[k] ?? '', 200, `metadata.${k}`);
  if (!['*','1-0','0-1','1/2-1/2'].includes(m.result)) throw new RecordError(ERR.DB_SCHEMA, 'metadata.result is invalid.');
  str(m.timeControl ?? '', 96, 'metadata.timeControl');
  if (!['UNKNOWN','USER_REPORTED','AUTO_CHECKMATE','AUTO_STALEMATE','AUTO_DRAW'].includes(m.resultProvenance ?? 'UNKNOWN')) throw new RecordError(ERR.DB_SCHEMA, 'metadata.resultProvenance is invalid.');
  return true;
}

export function validateMove(move, index) {
  if (!plain(move)) throw new RecordError(ERR.DB_SCHEMA, `moves[${index}] must be an object.`);
  ownKeysOnly(move, new Set(['ply','san','uci','beforeFen','afterFen','provenance','sourceRefs','observationRefs']), `moves[${index}]`);
  if (!Number.isInteger(move.ply) || move.ply !== index + 1) throw new RecordError(ERR.DB_SCHEMA, `moves[${index}].ply is not sequential.`);
  str(move.san, 32, `moves[${index}].san`, false);
  str(move.uci, 8, `moves[${index}].uci`, false);
  str(move.beforeFen, 128, `moves[${index}].beforeFen`, false);
  str(move.afterFen, 128, `moves[${index}].afterFen`, false);
  if (!MOVE_PROVENANCE.has(move.provenance)) throw new RecordError(ERR.DB_SCHEMA, `moves[${index}].provenance is invalid.`);
  if (!Array.isArray(move.sourceRefs) || move.sourceRefs.length > 8 || new Set(move.sourceRefs).size!==move.sourceRefs.length) throw new RecordError(ERR.DB_SCHEMA, `moves[${index}].sourceRefs is invalid.`);
  if (!Array.isArray(move.observationRefs) || move.observationRefs.length > 8 || new Set(move.observationRefs).size!==move.observationRefs.length) throw new RecordError(ERR.DB_SCHEMA, `moves[${index}].observationRefs is invalid.`);
  move.sourceRefs.forEach((v, i) => id(v, `moves[${index}].sourceRefs[${i}]`));
  move.observationRefs.forEach((v, i) => { str(v, 200, `moves[${index}].observationRefs[${i}]`, false); if(!/^[A-Za-z0-9._-]{8,96}:[A-Za-z0-9._-]{4,96}$/.test(v))throw new RecordError(ERR.DB_SCHEMA,`moves[${index}].observationRefs[${i}] has invalid request:cell format.`); });
  return true;
}

export function validateCertification(c) {
  if (c === null) return true;
  if (!plain(c)) throw new RecordError(ERR.DB_SCHEMA, 'certification must be null or an object.');
  ownKeysOnly(c, new Set(['assertionVersion','recordRevision','sourceRevision','canonicalHash','observationRoot','certifiedAt','assertion','recordType']), 'certification');
  if (c.assertionVersion !== 'record-certification/3') throw new RecordError(ERR.DB_SCHEMA, 'certification assertion version unsupported.');
  if (!Number.isInteger(c.recordRevision) || c.recordRevision < 0) throw new RecordError(ERR.DB_SCHEMA, 'certification.recordRevision invalid.');
  if (!Number.isInteger(c.sourceRevision) || c.sourceRevision < 0) throw new RecordError(ERR.DB_SCHEMA, 'certification.sourceRevision invalid.');
  hex64(c.canonicalHash, 'certification.canonicalHash');
  hex64(c.observationRoot, 'certification.observationRoot');
  iso(c.certifiedAt, 'certification.certifiedAt');
  str(c.assertion, 500, 'certification.assertion', false);
  if(!RECORD_TYPES.has(c.recordType))throw new RecordError(ERR.DB_SCHEMA,'certification.recordType invalid.');
  return true;
}

export function validateGame(game) {
  if (!plain(game)) throw new RecordError(ERR.DB_SCHEMA, 'game must be an object.');
  ownKeysOnly(game, new Set(['id','schema','recordType','createdAt','updatedAt','revision','sourceRevision','workflowState','certificationStatus','metadata','startFen','moves','notes','certification','flags']), 'game');
  if (game.schema !== APP.gameSchema) throw new RecordError(ERR.DB_SCHEMA, `Unsupported game schema: ${game.schema}`);
  id(game.id, 'game.id');
  if(!RECORD_TYPES.has(game.recordType))throw new RecordError(ERR.DB_SCHEMA,'game.recordType invalid.');
  iso(game.createdAt, 'game.createdAt'); iso(game.updatedAt, 'game.updatedAt');
  if (!Number.isInteger(game.revision) || game.revision < 0) throw new RecordError(ERR.DB_SCHEMA, 'game.revision invalid.');
  if (!Number.isInteger(game.sourceRevision) || game.sourceRevision < 0) throw new RecordError(ERR.DB_SCHEMA, 'game.sourceRevision invalid.');
  if (!WORKFLOW_STATES.has(game.workflowState)) throw new RecordError(ERR.DB_SCHEMA, 'game.workflowState invalid.');
  if (!CERTIFICATION_STATUSES.has(game.certificationStatus)) throw new RecordError(ERR.DB_SCHEMA, 'game.certificationStatus invalid.');
  validateMetadata(game.metadata);
  str(game.startFen, 128, 'game.startFen', false);
  if (!Array.isArray(game.moves) || game.moves.length > 2000) throw new RecordError(ERR.DB_SCHEMA, 'game.moves invalid.');
  game.moves.forEach(validateMove);
  str(game.notes ?? '', 20_000, 'game.notes');
  validateCertification(game.certification);
  if (!plain(game.flags)) throw new RecordError(ERR.DB_SCHEMA, 'game.flags must be an object.');
  ownKeysOnly(game.flags, new Set(['needsReview']), 'game.flags'); bool(game.flags.needsReview,'game.flags.needsReview');
  return true;
}

export function validateSourcePage(page) {
  if (!plain(page)) throw new RecordError(ERR.DB_SCHEMA, 'source page must be an object.');
  ownKeysOnly(page, new Set(['id','schema','gameId','order','createdAt','updatedAt','name','declaredMime','detectedMime','mime','animated','size','width','height','sha256','blob']), 'sourcePage');
  if(page.schema!==APP.sourceSchema)throw new RecordError(ERR.DB_SCHEMA,`Unsupported source page schema: ${page.schema}`);
  id(page.id,'sourcePage.id');id(page.gameId,'sourcePage.gameId');
  if(!Number.isInteger(page.order)||page.order<0||page.order>=100)throw new RecordError(ERR.DB_SCHEMA,'sourcePage.order invalid.');
  iso(page.createdAt,'sourcePage.createdAt');iso(page.updatedAt,'sourcePage.updatedAt');str(page.name,240,'sourcePage.name');
  for(const k of ['declaredMime','detectedMime','mime'])str(page[k],64,`sourcePage.${k}`,false);
  if(page.mime!==page.detectedMime||page.declaredMime!==page.detectedMime)throw new RecordError(ERR.DB_SCHEMA,'Source MIME declaration/detection mismatch.');
  bool(page.animated,'sourcePage.animated');if(page.animated)throw new RecordError(ERR.DB_SCHEMA,'Animated source images are not accepted.');
  if(!Number.isInteger(page.size)||page.size<1||page.size>LIMITS.sourceFileBytes)throw new RecordError(ERR.DB_SCHEMA,'sourcePage.size invalid.');
  for(const k of ['width','height'])if(!Number.isInteger(page[k])||page[k]<1)throw new RecordError(ERR.DB_SCHEMA,`sourcePage.${k} invalid.`);if(page.width*page.height>LIMITS.sourcePixels)throw new RecordError(ERR.DB_SCHEMA,'sourcePage decoded pixels exceed limit.');
  hex64(page.sha256,'sourcePage.sha256');if(!(page.blob instanceof Blob))throw new RecordError(ERR.DB_SCHEMA,'sourcePage.blob must be a Blob.');
  return true;
}

export function validateDerivedAsset(a) {
  if(!plain(a))throw new RecordError(ERR.DB_SCHEMA,'derived asset must be an object.');
  ownKeysOnly(a,new Set(['id','gameId','sourcePageId','schema','createdAt','preprocessorVersion','purpose','mime','width','height','size','sha256','quality','blob','transform']),'derivedAsset');
  if(a.schema!==APP.derivedSchema)throw new RecordError(ERR.DB_SCHEMA,`Unsupported derived schema: ${a.schema}`);id(a.id,'derivedAsset.id');id(a.gameId,'derivedAsset.gameId');id(a.sourcePageId,'derivedAsset.sourcePageId');iso(a.createdAt,'derivedAsset.createdAt');str(a.preprocessorVersion,80,'derivedAsset.preprocessorVersion',false);
  if(!['recognition','thumbnail'].includes(a.purpose))throw new RecordError(ERR.DB_SCHEMA,'derivedAsset.purpose invalid.');if(a.mime!=='image/jpeg')throw new RecordError(ERR.DB_SCHEMA,'Derived asset MIME must be image/jpeg.');for(const k of ['width','height','size'])if(!Number.isInteger(a[k])||a[k]<1)throw new RecordError(ERR.DB_SCHEMA,`derivedAsset.${k} invalid.`);hex64(a.sha256,'derivedAsset.sha256');if(!(a.blob instanceof Blob))throw new RecordError(ERR.DB_SCHEMA,'derivedAsset.blob must be Blob.');if(!plain(a.quality)||!Array.isArray(a.quality.warnings)||a.quality.warnings.length>20)throw new RecordError(ERR.DB_SCHEMA,'derivedAsset.quality invalid.');if(!plain(a.transform))throw new RecordError(ERR.DB_SCHEMA,'derivedAsset.transform invalid.');return true;
}

export function validateRecognitionJob(j){
  if(!plain(j))throw new RecordError(ERR.DB_SCHEMA,'recognition job must be object.');
  ownKeysOnly(j,new Set(['id','schema','gameId','pageId','sourceSha256','derivedSha256','status','attempt','idempotencyKey','providerProfile','createdAt','updatedAt','lastError','nextAttemptAt','recordRevision','sourceRevision','runSequence','runKind','supersedesRequestId']),'recognitionJob');
  if(j.schema!==APP.recognitionJobSchema)throw new RecordError(ERR.DB_SCHEMA,`Unsupported recognition job schema: ${j.schema}`);for(const [v,l] of [[j.id,'job.id'],[j.gameId,'job.gameId'],[j.pageId,'job.pageId']])id(v,l);hex64(j.sourceSha256,'job.sourceSha256');hex64(j.derivedSha256,'job.derivedSha256');if(!JOB_STATUSES.has(j.status))throw new RecordError(ERR.DB_SCHEMA,'job.status invalid.');if(!Number.isInteger(j.attempt)||j.attempt<0||j.attempt>100)throw new RecordError(ERR.DB_SCHEMA,'job.attempt invalid.');hex64(j.idempotencyKey,'job.idempotencyKey');str(j.providerProfile,80,'job.providerProfile',false);iso(j.createdAt,'job.createdAt');iso(j.updatedAt,'job.updatedAt');if(j.lastError!==null)str(j.lastError,1000,'job.lastError');if(j.nextAttemptAt!==null)iso(j.nextAttemptAt,'job.nextAttemptAt');for(const k of ['recordRevision','sourceRevision','runSequence'])if(!Number.isInteger(j[k])||j[k]<0)throw new RecordError(ERR.DB_SCHEMA,`job.${k} invalid.`);if(!['INITIAL','RERUN'].includes(j.runKind))throw new RecordError(ERR.DB_SCHEMA,'job.runKind invalid.');nullableId(j.supersedesRequestId,'job.supersedesRequestId');return true;
}

function validateCrop(c,label){if(!plain(c))throw new RecordError(ERR.DB_SCHEMA,`${label} must be object.`);ownKeysOnly(c,new Set(['x','y','w','h']),label);for(const k of ['x','y','w','h'])finite(c[k],`${label}.${k}`,0,1);if(c.w<=0||c.h<=0||c.x+c.w>1.000001||c.y+c.h>1.000001)throw new RecordError(ERR.DB_SCHEMA,`${label} exceeds normalized image bounds.`);}
export function validateRecognitionEnvelope(o){
  if(!plain(o))throw new RecordError(ERR.DB_SCHEMA,'recognition envelope must be object.');
  ownKeysOnly(o,new Set(['schema','requestId','gameId','pageId','sourceSha256','runSequence','supersedesRequestId','derivedAsset','provider','layout','cells','metadataObservations','warnings','gateway','signature']),'recognitionEnvelope');
  if(o.schema!==APP.recognitionEnvelopeSchema)throw new RecordError(ERR.DB_SCHEMA,`Unsupported recognition envelope schema: ${o.schema}`);for(const [v,l] of [[o.requestId,'envelope.requestId'],[o.gameId,'envelope.gameId'],[o.pageId,'envelope.pageId']])id(v,l);hex64(o.sourceSha256,'envelope.sourceSha256');if(!Number.isInteger(o.runSequence)||o.runSequence<1)throw new RecordError(ERR.DB_SCHEMA,'envelope.runSequence invalid.');nullableId(o.supersedesRequestId,'envelope.supersedesRequestId');
  if(!plain(o.derivedAsset))throw new RecordError(ERR.DB_SCHEMA,'envelope.derivedAsset invalid.');ownKeysOnly(o.derivedAsset,new Set(['id','sha256','mime','width','height','preprocessorVersion']),'envelope.derivedAsset');id(o.derivedAsset.id,'envelope.derivedAsset.id');hex64(o.derivedAsset.sha256,'envelope.derivedAsset.sha256');if(o.derivedAsset.mime!=='image/jpeg')throw new RecordError(ERR.DB_SCHEMA,'envelope derived MIME invalid.');for(const k of ['width','height'])if(!Number.isInteger(o.derivedAsset[k])||o.derivedAsset[k]<1)throw new RecordError(ERR.DB_SCHEMA,`envelope.derivedAsset.${k} invalid.`);str(o.derivedAsset.preprocessorVersion,80,'envelope.derivedAsset.preprocessorVersion',false);
  if(!plain(o.provider))throw new RecordError(ERR.DB_SCHEMA,'envelope.provider invalid.');ownKeysOnly(o.provider,new Set(['adapter','model','modelVersion','promptRevision']),'envelope.provider');for(const k of ['adapter','model','modelVersion','promptRevision'])str(o.provider[k],160,`envelope.provider.${k}`,false);
  if(!plain(o.layout))throw new RecordError(ERR.DB_SCHEMA,'envelope.layout invalid.');ownKeysOnly(o.layout,new Set(['coordinateSpace','documentQuad','rowsDetected']),'envelope.layout');if(o.layout.coordinateSpace!=='normalized-derived-image')throw new RecordError(ERR.DB_SCHEMA,'envelope.layout.coordinateSpace invalid.');if(!Array.isArray(o.layout.documentQuad)||o.layout.documentQuad.length!==4)throw new RecordError(ERR.DB_SCHEMA,'envelope.layout.documentQuad invalid.');for(const p of o.layout.documentQuad){if(!Array.isArray(p)||p.length!==2)throw new RecordError(ERR.DB_SCHEMA,'envelope.layout.documentQuad point invalid.');finite(p[0],'quad.x',0,1);finite(p[1],'quad.y',0,1);}if(!Number.isInteger(o.layout.rowsDetected)||o.layout.rowsDetected<0||o.layout.rowsDetected>200)throw new RecordError(ERR.DB_SCHEMA,'envelope.layout.rowsDetected invalid.');
  if(!Array.isArray(o.cells)||o.cells.length>LIMITS.recognitionCells)throw new RecordError(ERR.DB_SCHEMA,'envelope.cells invalid.');const cellIds=new Set();for(const [i,c] of o.cells.entries()){if(!plain(c))throw new RecordError(ERR.DB_SCHEMA,`cells[${i}] invalid.`);ownKeysOnly(c,new Set(['id','moveNumber','side','crop','observations','unreadable']),'recognition cell');id(c.id,`cells[${i}].id`);if(cellIds.has(c.id))throw new RecordError(ERR.DB_SCHEMA,'Duplicate recognition cell ID.');cellIds.add(c.id);if(!Number.isInteger(c.moveNumber)||c.moveNumber<1||c.moveNumber>1000)throw new RecordError(ERR.DB_SCHEMA,`cells[${i}].moveNumber invalid.`);if(!['white','black'].includes(c.side))throw new RecordError(ERR.DB_SCHEMA,`cells[${i}].side invalid.`);validateCrop(c.crop,`cells[${i}].crop`);bool(c.unreadable??false,`cells[${i}].unreadable`);if(!Array.isArray(c.observations)||c.observations.length>LIMITS.recognitionCandidatesPerCell)throw new RecordError(ERR.DB_SCHEMA,`cells[${i}].observations invalid.`);let rank=0;for(const [j,x] of c.observations.entries()){if(!plain(x)||Object.keys(x).some(k=>!['text','rank','providerScore'].includes(k)))throw new RecordError(ERR.DB_SCHEMA,`cells[${i}].observations[${j}] invalid.`);str(x.text,LIMITS.recognitionTextLength,`cells[${i}].observations[${j}].text`,false);if(!Number.isInteger(x.rank)||x.rank<=rank||x.rank<1||x.rank>LIMITS.recognitionCandidatesPerCell)throw new RecordError(ERR.DB_SCHEMA,'Recognition ranks must be unique ascending positive integers.');rank=x.rank;if(x.providerScore!==undefined&&x.providerScore!==null)finite(x.providerScore,'providerScore',-1e9,1e9);}}
  if(!Array.isArray(o.metadataObservations)||o.metadataObservations.length>50)throw new RecordError(ERR.DB_SCHEMA,'metadataObservations invalid.');for(const [i,m] of o.metadataObservations.entries()){if(!plain(m)||Object.keys(m).some(k=>!['field','text','crop'].includes(k)))throw new RecordError(ERR.DB_SCHEMA,`metadataObservations[${i}] invalid.`);str(m.field,64,'metadata field',false);str(m.text,LIMITS.metadataObservationLength,'metadata text');if(m.crop!==undefined)validateCrop(m.crop,`metadataObservations[${i}].crop`);}
  if(!Array.isArray(o.warnings)||o.warnings.length>50)throw new RecordError(ERR.DB_SCHEMA,'warnings invalid.');o.warnings.forEach((w,i)=>str(w,300,`warnings[${i}]`));
  if(!plain(o.gateway))throw new RecordError(ERR.DB_SCHEMA,'envelope.gateway invalid.');ownKeysOnly(o.gateway,new Set(['build','keyId','signedAt']),'envelope.gateway');str(o.gateway.build,160,'gateway.build',false);str(o.gateway.keyId,160,'gateway.keyId',false);iso(o.gateway.signedAt,'gateway.signedAt');str(o.signature,4096,'envelope.signature');return true;
}

export function validateAuditEvent(e){if(!plain(e))throw new RecordError(ERR.DB_SCHEMA,'audit event must be object.');ownKeysOnly(e,new Set(['id','schema','gameId','revision','timestamp','eventType','actor','payload']),'auditEvent');if(e.schema!==APP.auditSchema)throw new RecordError(ERR.DB_SCHEMA,`Unsupported audit event schema: ${e.schema}`);id(e.id,'audit.id');id(e.gameId,'audit.gameId');if(!Number.isInteger(e.revision)||e.revision<0)throw new RecordError(ERR.DB_SCHEMA,'audit.revision invalid.');iso(e.timestamp,'audit.timestamp');str(e.eventType,96,'audit.eventType',false);if(!['USER','SYSTEM','VISION','RECONSTRUCTION','IMPORT'].includes(e.actor))throw new RecordError(ERR.DB_SCHEMA,'audit.actor invalid.');if(!plain(e.payload))throw new RecordError(ERR.DB_SCHEMA,'audit.payload must be object.');return true;}

export function validateReconstructionRun(r){
  if(!plain(r))throw new RecordError(ERR.DB_SCHEMA,'reconstruction run must be object.');ownKeysOnly(r,new Set(['id','schema','gameId','createdAt','updatedAt','recordRevision','sourceRevision','observationRequestIds','status','beamWidth','paths','ambiguities','selectedPath','algorithm']),'reconstructionRun');if(r.schema!==APP.reconstructionSchema)throw new RecordError(ERR.DB_SCHEMA,'reconstruction schema unsupported.');id(r.id,'reconstruction.id');id(r.gameId,'reconstruction.gameId');iso(r.createdAt,'reconstruction.createdAt');iso(r.updatedAt,'reconstruction.updatedAt');for(const k of ['recordRevision','sourceRevision','beamWidth'])if(!Number.isInteger(r[k])||r[k]<0)throw new RecordError(ERR.DB_SCHEMA,`reconstruction.${k} invalid.`);if(!Array.isArray(r.observationRequestIds)||r.observationRequestIds.length>100)throw new RecordError(ERR.DB_SCHEMA,'reconstruction observation list invalid.');r.observationRequestIds.forEach((x,i)=>id(x,`reconstruction.observationRequestIds[${i}]`));if(!['COMPLETE','AMBIGUOUS','FAILED','STALE'].includes(r.status))throw new RecordError(ERR.DB_SCHEMA,'reconstruction status invalid.');str(r.algorithm,80,'reconstruction.algorithm',false);if(!Array.isArray(r.paths)||r.paths.length>LIMITS.reconstructionPathsStored)throw new RecordError(ERR.DB_SCHEMA,'reconstruction paths invalid.');for(const [pi,p] of r.paths.entries()){if(!plain(p)||Object.keys(p).some(k=>!['rank','score','moves','requiresReview'].includes(k)))throw new RecordError(ERR.DB_SCHEMA,`reconstruction.paths[${pi}] invalid.`);if(!Number.isInteger(p.rank)||p.rank<1)throw new RecordError(ERR.DB_SCHEMA,'reconstruction path rank invalid.');finite(p.score,'reconstruction path score',-1e9,1e9);bool(p.requiresReview,'reconstruction requiresReview');if(!Array.isArray(p.moves)||p.moves.length>2000)throw new RecordError(ERR.DB_SCHEMA,'reconstruction path moves invalid.');p.moves.forEach((m,i)=>{if(!plain(m)||Object.keys(m).some(k=>!['ply','san','uci','beforeFen','afterFen','provenance','sourceRefs','observationRefs','support','alternatives'].includes(k)))throw new RecordError(ERR.DB_SCHEMA,'reconstruction move invalid.');validateMove({ply:m.ply,san:m.san,uci:m.uci,beforeFen:m.beforeFen,afterFen:m.afterFen,provenance:m.provenance,sourceRefs:m.sourceRefs,observationRefs:m.observationRefs},i);if(!['PREFIX','DIRECT','CONSTRAINED','BRIDGE'].includes(m.support))throw new RecordError(ERR.DB_SCHEMA,'reconstruction move support invalid.');if(!Array.isArray(m.alternatives)||m.alternatives.length>16)throw new RecordError(ERR.DB_SCHEMA,'reconstruction alternatives invalid.');});}
  if(!Array.isArray(r.ambiguities)||r.ambiguities.length>2000)throw new RecordError(ERR.DB_SCHEMA,'reconstruction ambiguities invalid.');if(r.selectedPath!==null&&(!Number.isInteger(r.selectedPath)||r.selectedPath<0||r.selectedPath>=r.paths.length))throw new RecordError(ERR.DB_SCHEMA,'reconstruction selectedPath invalid.');return true;
}

export function validateCapsuleManifest(m){if(!plain(m))throw new RecordError(ERR.DB_SCHEMA,'Capsule manifest must be object.');ownKeysOnly(m,new Set(['schema','capsuleInstanceId','createdAt','canonicalRecordHash','certificationFingerprint','observationRoot','auditRoot','capsuleContentRoot','files','signatures']),'capsuleManifest');if(m.schema!==APP.capsuleSchema)throw new RecordError(ERR.DB_SCHEMA,'Capsule manifest schema unsupported.');id(m.capsuleInstanceId,'capsuleInstanceId');iso(m.createdAt,'capsule.createdAt');for(const k of ['canonicalRecordHash','certificationFingerprint','observationRoot','auditRoot','capsuleContentRoot'])hex64(m[k],`capsule.${k}`);if(!Array.isArray(m.files)||m.files.length>LIMITS.archiveFiles)throw new RecordError(ERR.DB_SCHEMA,'Capsule files invalid.');const paths=new Set();for(const [i,d] of m.files.entries()){if(!plain(d)||Object.keys(d).some(k=>!['path','size','sha256'].includes(k)))throw new RecordError(ERR.DB_SCHEMA,`capsule.files[${i}] invalid.`);str(d.path,LIMITS.archivePathLength,`capsule.files[${i}].path`,false);if(paths.has(d.path))throw new RecordError(ERR.DB_SCHEMA,'Duplicate Capsule path.');paths.add(d.path);if(!Number.isInteger(d.size)||d.size<0)throw new RecordError(ERR.DB_SCHEMA,'Capsule file size invalid.');hex64(d.sha256,'Capsule file hash');}if(!Array.isArray(m.signatures)||m.signatures.length>16)throw new RecordError(ERR.DB_SCHEMA,'Capsule signatures invalid.');return true;}
export function validateCapsuleSourceDescriptor(s){if(!plain(s))throw new RecordError(ERR.DB_SCHEMA,'Capsule source descriptor invalid.');ownKeysOnly(s,new Set(['id','order','mime','size','width','height','sha256']),'capsule source');id(s.id,'capsule source id');if(!Number.isInteger(s.order)||s.order<0)throw new RecordError(ERR.DB_SCHEMA,'capsule source order invalid.');str(s.mime,64,'capsule source mime',false);for(const k of ['size','width','height'])if(!Number.isInteger(s[k])||s[k]<1)throw new RecordError(ERR.DB_SCHEMA,`capsule source ${k} invalid.`);hex64(s.sha256,'capsule source sha256');return true;}

export function validateObservationTrust(v){if(!OBSERVATION_TRUST.has(v))throw new RecordError(ERR.DB_SCHEMA,'Observation trust classification invalid.');return true;}
