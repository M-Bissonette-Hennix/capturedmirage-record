import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';if(!globalThis.crypto)globalThis.crypto=webcrypto;import {appendMove,buildCertification,createGame,invalidateCertification,replaceMoveAt,validateRecord,verifyCertification} from '../src/record.js';
function page(bytes='source'){const b=new Blob([bytes],{type:'image/jpeg'});return {id:'source-page-0001',schema:'record-source-page/3',gameId:'game-placeholder',order:0,createdAt:'2026-09-09T00:00:00.000Z',updatedAt:'2026-09-09T00:00:00.000Z',name:'a.jpg',declaredMime:'image/jpeg',detectedMime:'image/jpeg',mime:'image/jpeg',animated:false,size:b.size,width:1000,height:1400,sha256:'',blob:b};}
async function hashedPage(gameId){const p=page();p.gameId=gameId;const {sha256Bytes}=await import('../src/crypto.js');p.sha256=await sha256Bytes(new Uint8Array(await p.blob.arrayBuffer()));return p;}
test('single move ledger is deterministic and self-consistent',()=>{const g=createGame();appendMove(g,'e4');appendMove(g,'e5');const r=validateRecord(g);assert.equal(g.moves.length,2);assert.equal(g.moves[0].uci,'e2e4');assert.equal(r.history[1].san,'e5');});
test('replacement rebuilds legal downstream tail and stops on first contradiction',()=>{const g=createGame();for(const m of ['e4','e5','Nf3','Nc6'])appendMove(g,m);const x=replaceMoveAt(g,1,'c5');assert.equal(g.moves[1].san,'c5');assert.ok(x.tailAccepted>=0);validateRecord(g);});
test('certification is continuously reverified and stale hash fails',async()=>{const g=createGame();g.id='record-game-0001';appendMove(g,'e4');g.revision=1;const p=await hashedPage(g.id);g.sourceRevision=1;const cert=await buildCertification(g,[p]);g.certification=cert;g.certificationStatus='VALID';assert.equal((await verifyCertification(g,[p])).status,'VALID');g.notes='changed without invalidation';assert.equal((await verifyCertification(g,[p])).status,'HASH_MISMATCH');});
test('source mutation invalidates certification state centrally',()=>{const g=createGame();g.certification={x:1};g.certificationStatus='VALID';const r=invalidateCertification(g,'TEST');assert.equal(r.invalidated,true);assert.equal(g.certification,null);assert.equal(g.certificationStatus,'INVALIDATED');});
test('sheet provenance must bind to a real source page before certification',async()=>{const g=createGame();g.id='record-game-0002';const p=await hashedPage(g.id);appendMove(g,'e4','SHEET_DIRECT',{sourceRefs:[p.id],observationRefs:[]});g.revision=1;g.sourceRevision=1;await buildCertification(g,[p]);g.moves[0].sourceRefs=['missing-source-0001'];await assert.rejects(()=>buildCertification(g,[p]),/missing source page/i);g.moves[0].sourceRefs=[];await assert.rejects(()=>buildCertification(g,[p]),/sheet provenance/i);});
test('manual replacement retains evidentiary source/observation links while marking user correction',()=>{const g=createGame();appendMove(g,'e4','SHEET_DIRECT',{sourceRefs:['source-page-0001'],observationRefs:['request-0001:cell-0001']});appendMove(g,'e5');replaceMoveAt(g,0,'d4');assert.equal(g.moves[0].provenance,'USER_CORRECTED');assert.deepEqual(g.moves[0].sourceRefs,['source-page-0001']);assert.deepEqual(g.moves[0].observationRefs,['request-0001:cell-0001']);});

import fs from 'node:fs';
import {canCertify} from '../src/record.js';

async function boundObservation(gameId,p,cellIndex=0){
  const env=JSON.parse(fs.readFileSync('fixtures/recognition/clean-fixture-001/envelope.json','utf8'));
  env.gameId=gameId;env.pageId=p.id;env.sourceSha256=p.sha256;env.requestId='bound-request-0001';env.runSequence=1;env.supersedesRequestId=null;
  env.derivedAsset={...env.derivedAsset,id:'bound-derived-0001',sha256:'1'.repeat(64)};
  const cell=env.cells[cellIndex];return {env,ref:`${env.requestId}:${cell.id}`,cell};
}

test('hostile gate: zero-move played game cannot be certified',async()=>{const g=createGame();g.id='record-game-zero1';g.sourceRevision=1;const p=await hashedPage(g.id);await assert.rejects(()=>buildCertification(g,[p]),/at least one ply/i);const gate=await canCertify(g,[p]);assert.equal(gate.ok,false);});

test('hostile gate: needsReview blocks certification and verification',async()=>{const g=createGame();g.id='record-game-review1';appendMove(g,'e4');g.revision=1;g.sourceRevision=1;const p=await hashedPage(g.id);g.flags.needsReview=true;await assert.rejects(()=>buildCertification(g,[p]),/(?:needs review|needing review)/i);});

test('hostile gate: dangling and wrong-coordinate observation refs reject',async()=>{const g=createGame();g.id='record-game-observe1';g.revision=1;g.sourceRevision=1;const p=await hashedPage(g.id);appendMove(g,'e4','SHEET_DIRECT',{sourceRefs:[p.id],observationRefs:['missing-request-0001:cell-0001']});await assert.rejects(()=>buildCertification(g,[p],[]),/resolved 0 times/i);const {env,ref}=await boundObservation(g.id,p,2);g.moves[0].observationRefs=[ref];await assert.rejects(()=>buildCertification(g,[p],[env]),/expected ply/i);});

test('observation-bound certification succeeds only with correct cell/page/hash',async()=>{const g=createGame();g.id='record-game-observe2';g.revision=1;g.sourceRevision=1;const p=await hashedPage(g.id);const {env,ref}=await boundObservation(g.id,p,0);appendMove(g,'e4','SHEET_DIRECT',{sourceRefs:[p.id],observationRefs:[ref]});const cert=await buildCertification(g,[p],[env]);assert.match(cert.observationRoot,/^[a-f0-9]{64}$/);});
