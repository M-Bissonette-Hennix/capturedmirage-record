import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
import {createGame,appendMove,buildCertification} from '../src/record.js';
import {sha256Bytes,sha256Text,stableStringify} from '../src/crypto.js';
import {buildCapsule,verifyCapsule} from '../src/capsule.js';
import {createZip,parseZipStore} from '../src/zip.js';

async function fixture(){
  const g=createGame();g.id='capsule-game-0001';appendMove(g,'e4');g.revision=1;g.sourceRevision=1;
  const blob=new Blob(['photo'],{type:'image/jpeg'}),p={id:'capsule-page-0001',schema:'record-source-page/3',gameId:g.id,order:0,createdAt:'2026-09-09T00:00:00.000Z',updatedAt:'2026-09-09T00:00:00.000Z',name:'p.jpg',declaredMime:'image/jpeg',detectedMime:'image/jpeg',mime:'image/jpeg',animated:false,size:blob.size,width:1000,height:1400,sha256:await sha256Bytes(new Uint8Array(await blob.arrayBuffer())),blob};
  g.certification=await buildCertification(g,[p]);g.certificationStatus='VALID';g.workflowState='COMPLETE';return {g,p};
}
function rebuilt(files,mutate){const entries=[...files.entries()].map(([name,data])=>({name,data:data.slice()}));mutate(entries);return createZip(entries,{deterministic:true});}

test('Capsule generate/verify and data tamper rejection',async()=>{const {g,p}=await fixture(),c=await buildCapsule({game:g,pages:[p]});const v=await verifyCapsule(c.bytes);assert.equal(v.valid,true);const files=parseZipStore(c.bytes);const tampered=rebuilt(files,entries=>{const x=entries.find(e=>e.name==='source/page-001.jpg');x.data[0]^=1;});await assert.rejects(()=>verifyCapsule(tampered),/integrity|descriptor/i);});

test('Capsule rejects unmanifested files and internally rewritten stale certification',async()=>{const {g,p}=await fixture(),c=await buildCapsule({game:g,pages:[p]}),files=parseZipStore(c.bytes);const extra=rebuilt(files,e=>e.push({name:'extra.txt',data:new TextEncoder().encode('x')}));await assert.rejects(()=>verifyCapsule(extra),/unmanifested|unexpected/i);const stale=rebuilt(files,entries=>{const r=entries.find(e=>e.name==='record.json'),obj=JSON.parse(new TextDecoder().decode(r.data));obj.game.metadata.event='tampered';r.data=new TextEncoder().encode(JSON.stringify(obj,null,2));});await assert.rejects(()=>verifyCapsule(stale),/integrity|canonical|certification/i);});


async function rebuildSelfConsistent(files,mutator){
  const map=new Map([...files.entries()].map(([k,v])=>[k,v.slice()]));
  await mutator(map);
  const manifest=JSON.parse(new TextDecoder().decode(map.get('manifest.json')));
  for(const d of manifest.files){const data=map.get(d.path);d.size=data.length;d.sha256=await sha256Bytes(data);}
  manifest.files.sort((a,b)=>a.path.localeCompare(b.path));manifest.capsuleContentRoot=await sha256Text(stableStringify(manifest.files));map.set('manifest.json',new TextEncoder().encode(JSON.stringify(manifest,null,2)));
  return createZip([...map.entries()].map(([name,data])=>({name,data})),{deterministic:true});
}

test('hostile Capsule gate: self-consistent PGN that contradicts record.json is rejected',async()=>{const {g,p}=await fixture(),c=await buildCapsule({game:g,pages:[p]}),files=parseZipStore(c.bytes);const attack=await rebuildSelfConsistent(files,async map=>{map.set('game.pgn',new TextEncoder().encode('[Event "FAKE"]\n[Site "?"]\n[Date "????.??.??"]\n[Round "?"]\n[White "?"]\n[Black "?"]\n[Result "*"]\n\n1. d4 *\n'));});await assert.rejects(()=>verifyCapsule(attack),/game\.pgn|record\.json|canonically identical/i);});

test('derived-asset byte mutation blocks Capsule creation before export',async()=>{const {g,p}=await fixture(),good=new Blob(['derived-good'],{type:'image/jpeg'}),hash=await sha256Bytes(new Uint8Array(await good.arrayBuffer())),asset={id:'capsule-derived-0001',gameId:g.id,sourcePageId:p.id,schema:'record-derived-asset/2',createdAt:'2026-09-09T00:00:00.000Z',preprocessorVersion:'record-preprocess/3',purpose:'recognition',mime:'image/jpeg',width:800,height:1100,size:good.size,sha256:hash,quality:{warnings:[]},transform:{sourceRect:{x:0,y:0,w:1,h:1}},blob:new Blob(['derived-bad'],{type:'image/jpeg'})};await assert.rejects(()=>buildCapsule({game:g,pages:[p],derivedAssets:[asset]}),/Derived asset digest mismatch/i);});

import fs from 'node:fs';
import {signEnvelope} from '../gateway/core.mjs';

test('signed remote observations require and verify a trusted gateway key in Capsule export/verification',async()=>{
  const g=createGame();g.id='capsule-signed-game1';g.revision=1;g.sourceRevision=1;
  const src=new Blob(['signed-photo'],{type:'image/jpeg'}),p={id:'capsule-signed-page1',schema:'record-source-page/3',gameId:g.id,order:0,createdAt:'2026-09-09T00:00:00.000Z',updatedAt:'2026-09-09T00:00:00.000Z',name:'p.jpg',declaredMime:'image/jpeg',detectedMime:'image/jpeg',mime:'image/jpeg',animated:false,size:src.size,width:1000,height:1400,sha256:await sha256Bytes(new Uint8Array(await src.arrayBuffer())),blob:src};
  const db=new Blob(['remote-derived'],{type:'image/jpeg'}),dh=await sha256Bytes(new Uint8Array(await db.arrayBuffer())),asset={id:'capsule-signed-derived1',gameId:g.id,sourcePageId:p.id,schema:'record-derived-asset/2',createdAt:'2026-09-09T00:00:00.000Z',preprocessorVersion:'record-preprocess/3',purpose:'recognition',mime:'image/jpeg',width:800,height:1100,size:db.size,sha256:dh,quality:{warnings:[]},transform:{sourceRect:{x:0,y:0,w:1,h:1}},blob:db};
  let env=JSON.parse(fs.readFileSync('fixtures/recognition/clean-fixture-001/envelope.json','utf8'));env.gameId=g.id;env.pageId=p.id;env.sourceSha256=p.sha256;env.requestId='capsule-signed-request1';env.derivedAsset={...env.derivedAsset,id:asset.id,sha256:asset.sha256,mime:asset.mime,width:asset.width,height:asset.height,preprocessorVersion:asset.preprocessorVersion};env.gateway={build:'record-gateway/0.3.0',keyId:'test-gateway-key1',signedAt:'2026-09-09T00:00:00.000Z'};
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),priv=await crypto.subtle.exportKey('jwk',pair.privateKey),pub=await crypto.subtle.exportKey('jwk',pair.publicKey);env=await signEnvelope(env,priv);
  const ref=`${env.requestId}:${env.cells[0].id}`;appendMove(g,'e4','SHEET_DIRECT',{sourceRefs:[p.id],observationRefs:[ref]});g.certification=await buildCertification(g,[p],[env]);g.certificationStatus='VALID';g.workflowState='COMPLETE';
  await assert.rejects(()=>buildCapsule({game:g,pages:[p],derivedAssets:[asset],observations:[env]}),/trust verification|UNKNOWN_KEY/i);
  const c=await buildCapsule({game:g,pages:[p],derivedAssets:[asset],observations:[env],trustContext:{gatewayKeys:{'test-gateway-key1':pub}}});const v=await verifyCapsule(c.bytes,{trustContext:{gatewayKeys:{'test-gateway-key1':pub}},requireTrustedObservations:true});assert.equal(v.observationTrust[0].classification,'SIGNED_VERIFIED');
});
