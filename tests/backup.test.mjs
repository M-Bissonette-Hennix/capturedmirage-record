import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
import {createGame,appendMove,buildCertification} from '../src/record.js';
import {sha256Bytes,uuid} from '../src/crypto.js';
import {buildBackupFromSnapshot,cloneSnapshotAsCopies,parseBackup} from '../src/backup.js';
import {createZip,parseZipStore} from '../src/zip.js';

async function snapshot(){const g=createGame();appendMove(g,'e4');g.revision=1;g.sourceRevision=1;const sourceBlob=new Blob(['source-bytes'],{type:'image/jpeg'}),page={id:uuid(),schema:'record-source-page/3',gameId:g.id,order:0,createdAt:'2026-09-09T00:00:00.000Z',updatedAt:'2026-09-09T00:00:00.000Z',name:'sheet.jpg',declaredMime:'image/jpeg',detectedMime:'image/jpeg',mime:'image/jpeg',animated:false,size:sourceBlob.size,width:1000,height:1400,sha256:await sha256Bytes(new Uint8Array(await sourceBlob.arrayBuffer())),blob:sourceBlob};const db=new Blob(['derived'],{type:'image/jpeg'}),asset={id:uuid(),gameId:g.id,sourcePageId:page.id,schema:'record-derived-asset/2',createdAt:'2026-09-09T00:00:00.000Z',preprocessorVersion:'record-preprocess/3',purpose:'recognition',mime:'image/jpeg',width:800,height:1100,size:db.size,sha256:await sha256Bytes(new Uint8Array(await db.arrayBuffer())),quality:{warnings:[]},blob:db,transform:{sourceRect:{x:0,y:0,w:1,h:1}}};g.certification=await buildCertification(g,[page]);g.certificationStatus='VALID';g.workflowState='COMPLETE';return {games:[g],sourcePages:[page],derivedAssets:[asset],recognitionJobs:[],recognitionObservations:[],auditEvents:[],settings:[{id:'lastBackupAt',value:'2026-09-09T00:00:00.000Z'}]};}

test('backup build/parse preserves evidence bytes and allowlisted settings',async()=>{const s=await snapshot(),b=await buildBackupFromSnapshot(s),p=await parseBackup(b.bytes);assert.equal(p.snapshot.games.length,1);assert.equal(p.snapshot.sourcePages[0].sha256,s.sourcePages[0].sha256);assert.equal(new TextDecoder().decode(new Uint8Array(await p.snapshot.sourcePages[0].blob.arrayBuffer())),'source-bytes');assert.equal(p.snapshot.settings.some(x=>x.id==='gateway'),false);assert.equal(p.snapshot.settings.some(x=>x.id==='lastBackupAt'),true);});

test('backup rejects logical blob tamper even with rebuilt ZIP',async()=>{const s=await snapshot(),b=await buildBackupFromSnapshot(s),files=parseZipStore(b.bytes),entries=[...files.entries()].map(([name,data])=>({name,data:data.slice()}));const blob=entries.find(e=>e.name.startsWith('blobs/source/'));blob.data[0]^=1;const tampered=createZip(entries,{deterministic:true});await assert.rejects(()=>parseBackup(tampered),/integrity|digest/i);});

test('import-as-copy remaps identity and invalidates certification',async()=>{const s=await snapshot(),copy=cloneSnapshotAsCopies(s);assert.notEqual(copy.games[0].id,s.games[0].id);assert.notEqual(copy.sourcePages[0].id,s.sourcePages[0].id);assert.equal(copy.sourcePages[0].gameId,copy.games[0].id);assert.equal(copy.games[0].certification,null);assert.equal(copy.games[0].certificationStatus,'INVALIDATED');assert.equal(copy.games[0].flags.needsReview,true);});


test('backup rejects non-allowlisted settings at the trust boundary',async()=>{const s=await snapshot();s.settings.push({id:'gateway',value:{secret:'must-not-cross-backup'}});await assert.rejects(()=>buildBackupFromSnapshot(s),/non-allowlisted setting/i);});
