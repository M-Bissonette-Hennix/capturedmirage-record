import {APP,LIMITS} from './config.js';
import {ERR,RecordError} from './errors.js';
import {makeMove,movesWithSan,parseFen} from './chess.js';
import {uuid,stableStringify,sha256Text} from './crypto.js';
import {validateGame,validateRecognitionEnvelope,validateReconstructionRun} from './validators.js';
import {nowIso} from './record.js';

const strip = value => String(value??'')
  .trim()
  .replace(/0-0-0/gi,'O-O-O')
  .replace(/0-0/gi,'O-O')
  .replace(/[\s·.,;:!?]+/g,'')
  .replace(/[+#]+$/,'')
  .replace(/[×]/g,'x');

export function notationKey(value){return strip(value).toLowerCase();}

export function editDistance(a,b){
  a=notationKey(a);b=notationKey(b);
  if(a===b)return 0;
  if(!a.length)return b.length;if(!b.length)return a.length;
  const prev=Array.from({length:b.length+1},(_,i)=>i),cur=new Array(b.length+1);
  for(let i=1;i<=a.length;i++){
    cur[0]=i;
    for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    for(let j=0;j<cur.length;j++)prev[j]=cur[j];
  }
  return prev[b.length];
}

function expectedCoordinate(ply){return {moveNumber:Math.floor((ply+1)/2),side:ply%2===1?'white':'black'};}
function coordinateIndex(moveNumber,side){return (moveNumber-1)*2+(side==='black'?2:1);}

export function observationSequence(observations){
  const cells=[];
  for(const env of observations){
    validateRecognitionEnvelope(env);
    for(const cell of env.cells)cells.push({env,cell,coordinate:coordinateIndex(cell.moveNumber,cell.side)});
  }
  cells.sort((a,b)=>a.coordinate-b.coordinate||a.env.runSequence-b.env.runSequence||a.env.requestId.localeCompare(b.env.requestId)||a.cell.id.localeCompare(b.cell.id));
  // Only one current observation envelope should normally exist per page. If
  // multiple cells claim the same coordinate, keep them as alternatives rather
  // than silently selecting one run.
  const byCoordinate=new Map();
  for(const entry of cells){const list=byCoordinate.get(entry.coordinate)||[];list.push(entry);byCoordinate.set(entry.coordinate,list);}
  return byCoordinate;
}

function legalCandidateScore(move,cell){
  let best=null;
  for(const obs of cell.observations){
    const d=editDistance(move.san,obs.text);
    // Candidate rank is ordinal evidence, never a calibrated probability.
    let score = d===0?18:d===1?9:d===2?3:-Infinity;
    if(!Number.isFinite(score))continue;
    score -= Math.max(0,obs.rank-1)*1.25;
    if(notationKey(move.san)===notationKey(obs.text))score+=2;
    const item={score,distance:d,providerRank:obs.rank,rawText:obs.text};
    if(!best||item.score>best.score)best=item;
  }
  return best;
}

export function candidatesForCell(state,cell,{limit=LIMITS.reconstructionCandidatesPerPly}={}){
  const scored=[];
  for(const move of movesWithSan(state)){
    const evidence=legalCandidateScore(move,cell);
    if(evidence)scored.push({move,evidence});
  }
  scored.sort((a,b)=>b.evidence.score-a.evidence.score||a.move.san.localeCompare(b.move.san));
  return scored.slice(0,limit);
}

function pathMove(move,ply,{entry=null,evidence=null,bridge=false}={}){
  const ref=entry?`${entry.env.requestId}:${entry.cell.id}`:null;
  return {
    ply,
    san:move.san,
    uci:move.uci,
    beforeFen:move.before,
    afterFen:move.after,
    provenance:bridge?'INFERRED_BRIDGE':'SHEET_CONSTRAINED',
    sourceRefs:entry?[entry.env.pageId]:[],
    observationRefs:ref?[ref]:[],
    support:bridge?'BRIDGE':evidence?.distance===0&&evidence?.providerRank===1?'DIRECT':'CONSTRAINED',
    alternatives:[],
  };
}

function summarizeAlternatives(candidates){return candidates.slice(0,8).map(c=>({san:c.move.san,rank:c.evidence.providerRank,distance:c.evidence.distance,score:Number(c.evidence.score.toFixed(3))}));}

function expandObserved(path,entries,ply){
  const expansions=[];
  for(const entry of entries){
    const candidates=candidatesForCell(path.state,entry.cell);
    const alternatives=summarizeAlternatives(candidates);
    for(const candidate of candidates){
      const r=makeMove(path.state,candidate.move.san),m=pathMove(r.move,ply,{entry,evidence:candidate.evidence});
      m.alternatives=alternatives;
      const uncertain=candidate.evidence.distance>0||candidate.evidence.providerRank>1||candidates.length>1&&Math.abs(candidates[0].evidence.score-candidate.evidence.score)<3;
      expansions.push({state:r.state,moves:[...path.moves,m],score:path.score+candidate.evidence.score,requiresReview:path.requiresReview||uncertain,bridges:path.bridges,used:[...path.used,entry.env.requestId],ambiguities:[...path.ambiguities,...(uncertain?[{ply,ref:`${entry.env.requestId}:${entry.cell.id}`,alternatives}]:[])]});
    }
  }
  return expansions;
}

function expandBridge(path,ply){
  // Missing score-sheet ply. This is deliberately expensive in score and always
  // requires review. It is never silently certified as source-derived truth.
  return movesWithSan(path.state).slice(0,80).map(move=>{
    const r=makeMove(path.state,move.san),m=pathMove(r.move,ply,{bridge:true});
    return {state:r.state,moves:[...path.moves,m],score:path.score-14,requiresReview:true,bridges:path.bridges+1,used:[...path.used],ambiguities:[...path.ambiguities,{ply,ref:null,alternatives:[{san:move.san,reason:'missing-sheet-ply'}]}]};
  });
}

function dedupeAndTrim(paths,width){
  const best=new Map();
  for(const p of paths){
    const key=p.state?`${p.state.turn}|${p.moves.at(-1)?.afterFen||''}`:stableStringify(p.moves.map(m=>m.san));
    const old=best.get(key);if(!old||p.score>old.score)best.set(key,p);
  }
  return [...best.values()].sort((a,b)=>b.score-a.score||a.moves.map(m=>m.san).join(' ').localeCompare(b.moves.map(m=>m.san).join(' '))).slice(0,width);
}

export async function reconstructGame({game,observations,beamWidth=LIMITS.reconstructionBeamWidth,maxBridgePlies=1}={}){
  validateGame(game);if(!Array.isArray(observations)||!observations.length)throw new RecordError(ERR.REC_NO_PATH,'No recognition observations are available for reconstruction.');
  const byCoordinate=observationSequence(observations),coordinates=[...byCoordinate.keys()].sort((a,b)=>a-b);if(!coordinates.length)throw new RecordError(ERR.REC_NO_PATH,'Recognition observations contain no move cells.');

  // Existing manually certified/entered plies are a deterministic prefix, not
  // something the vision layer is permitted to rewrite. This allows a user to
  // enter the opening or any missing early segment manually and reconstruct the
  // remaining observed score-sheet sequence without discarding that work.
  let state=parseFen(game.startFen);
  const prefix=[];
  for(const [i,existing] of game.moves.entries()){
    const r=makeMove(state,existing.san);
    prefix.push({
      ply:i+1,san:r.move.san,uci:r.move.uci,beforeFen:r.move.before,afterFen:r.move.after,
      provenance:existing.provenance,sourceRefs:[...(existing.sourceRefs||[])],observationRefs:[...(existing.observationRefs||[])],
      support:'PREFIX',alternatives:[],
    });
    state=r.state;
  }
  const startPly=prefix.length+1;
  const remainingCoordinates=coordinates.filter(c=>c>=startPly);
  if(!remainingCoordinates.length)throw new RecordError(ERR.REC_NO_PATH,'No recognition observations remain after the existing manual move prefix.');
  const maxCoordinate=remainingCoordinates.at(-1);
  let beam=[{state,moves:prefix,score:0,requiresReview:!!game.flags?.needsReview,bridges:0,used:[],ambiguities:[]}];
  for(let ply=startPly;ply<=maxCoordinate;ply++){
    const entries=byCoordinate.get(ply)||[];let next=[];
    for(const path of beam){
      if(entries.length)next.push(...expandObserved(path,entries,ply));
      else if(path.bridges<maxBridgePlies)next.push(...expandBridge(path,ply));
    }
    if(!next.length){
      const t=nowIso(),run={id:uuid(),schema:APP.reconstructionSchema,gameId:game.id,createdAt:t,updatedAt:t,recordRevision:game.revision,sourceRevision:game.sourceRevision,observationRequestIds:[...new Set(observations.map(o=>o.requestId))].sort(),status:'FAILED',beamWidth,paths:[],ambiguities:[{ply,reason:'no-legal-evidence-compatible-continuation'}],selectedPath:null,algorithm:'record-legal-beam/1'};validateReconstructionRun(run);return run;
    }
    beam=dedupeAndTrim(next,beamWidth);
  }
  const ranked=beam.slice(0,LIMITS.reconstructionPathsStored);const leader=ranked[0],runner=ranked[1];
  const decisive=!runner||leader.score-runner.score>=5;
  const paths=ranked.map((p,i)=>({rank:i+1,score:Number(p.score.toFixed(3)),moves:p.moves,requiresReview:p.requiresReview||!decisive}));
  const allAmbiguities=[];for(const a of leader.ambiguities){const k=stableStringify(a);if(!allAmbiguities.some(x=>stableStringify(x)===k))allAmbiguities.push(a);}
  if(!decisive)allAmbiguities.push({ply:null,reason:'multiple-sequence-paths-remain-credible',margin:Number((leader.score-(runner?.score??leader.score)).toFixed(3))});
  const t=nowIso(),run={id:uuid(),schema:APP.reconstructionSchema,gameId:game.id,createdAt:t,updatedAt:t,recordRevision:game.revision,sourceRevision:game.sourceRevision,observationRequestIds:[...new Set(observations.map(o=>o.requestId))].sort(),status:decisive?'COMPLETE':'AMBIGUOUS',beamWidth,paths,ambiguities:allAmbiguities,selectedPath:decisive?0:null,algorithm:'record-legal-beam/1'};validateReconstructionRun(run);return run;
}

export async function reconstructionFingerprint(run){validateReconstructionRun(run);return sha256Text(stableStringify({schema:run.schema,gameId:run.gameId,recordRevision:run.recordRevision,sourceRevision:run.sourceRevision,observationRequestIds:run.observationRequestIds,algorithm:run.algorithm,paths:run.paths,ambiguities:run.ambiguities}));}
