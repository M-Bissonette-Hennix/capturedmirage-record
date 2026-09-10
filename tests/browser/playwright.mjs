import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const ORIGIN='http://127.0.0.1:4173';
const sourceBytes=await fs.readFile(new URL('../../fixtures/recognition/clean-fixture-001/source.png',import.meta.url));
const SOURCE_BASE64=sourceBytes.toString('base64');
const SOURCE_SHA256=crypto.createHash('sha256').update(sourceBytes).digest('hex');
const SOURCE_SIZE=sourceBytes.length;

function wireDiagnostics(page,name,phase){
  const errors=[];
  page.on('pageerror',e=>errors.push(`pageerror: ${e?.message||String(e)}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`console.error: ${m.text()}`);});
  return ()=>{
    if(errors.length)throw new Error(`${name} ${phase} emitted browser errors:\n${errors.join('\n')}`);
  };
}

async function seedLegacy(page,name){
  const response=await page.goto(`${ORIGIN}/fixtures/browser-seed.html`,{waitUntil:'domcontentloaded'});
  if(!response?.ok())throw new Error(`${name} legacy-seed HTML returned HTTP ${response?.status?.()??'unknown'}.`);

  const result=await page.evaluate(async({sourceBase64,sourceSha256,sourceSize})=>{
    const fail=e=>({ok:false,name:String(e?.name||'Error'),message:String(e?.message||e||'unknown error'),stack:String(e?.stack||'')});
    try{
      if(!globalThis.indexedDB)throw new Error('IndexedDB is unavailable in the browser seed context.');
      const binary=atob(sourceBase64);
      const bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      if(bytes.length!==sourceSize)throw new Error(`Decoded source byte length ${bytes.length} != ${sourceSize}.`);

      const db=await new Promise((resolve,reject)=>{
        const r=indexedDB.open('record-foundation',1);
        r.onupgradeneeded=()=>{
          const d=r.result;
          if(!d.objectStoreNames.contains('games'))d.createObjectStore('games',{keyPath:'id'});
          if(!d.objectStoreNames.contains('pages')){
            const s=d.createObjectStore('pages',{keyPath:'id'});
            s.createIndex('gameId','gameId');
          }
          if(!d.objectStoreNames.contains('settings'))d.createObjectStore('settings',{keyPath:'key'});
        };
        r.onsuccess=()=>resolve(r.result);
        r.onerror=()=>reject(r.error||new Error('indexedDB.open(record-foundation) failed.'));
        r.onblocked=()=>reject(new Error('indexedDB.open(record-foundation) was blocked.'));
      });

      try{
        const start='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        const after='rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
        const t='2026-09-01T00:00:00.000Z';
        const game={
          id:'legacy-browser-game1',
          schema:'record-game/1',
          createdAt:t,
          updatedAt:t,
          state:'CERTIFIED',
          metadata:{event:'Legacy Browser Fixture',site:'',date:'2026.09.01',round:'1',board:'',section:'',white:'',black:'',result:'*',timeControl:'90+30'},
          startFen:start,
          sans:['e4'],
          plies:[{ply:1,san:'e4',before:start,after,provenance:'USER_ENTERED',sourceRef:null}],
          notes:'legacy',
          certification:{legacy:true}
        };
        const source={
          id:'legacy-browser-page1',
          gameId:game.id,
          order:0,
          createdAt:t,
          name:'legacy.png',
          mime:'image/png',
          size:bytes.length,
          sha256:sourceSha256,
          blob:new Blob([bytes],{type:'image/png'})
        };

        await new Promise((resolve,reject)=>{
          let tx;
          try{tx=db.transaction(['games','pages'],'readwrite');}
          catch(e){reject(e);return;}
          tx.oncomplete=()=>resolve();
          tx.onerror=()=>reject(tx.error||new Error('Legacy seed transaction failed.'));
          tx.onabort=()=>reject(tx.error||new Error('Legacy seed transaction aborted.'));
          tx.objectStore('games').put(game);
          tx.objectStore('pages').put(source);
        });

        const readback=await new Promise((resolve,reject)=>{
          let tx;
          try{tx=db.transaction(['games','pages'],'readonly');}
          catch(e){reject(e);return;}
          const gReq=tx.objectStore('games').get(game.id);
          const pReq=tx.objectStore('pages').get(source.id);
          tx.oncomplete=()=>resolve({game:gReq.result,page:pReq.result});
          tx.onerror=()=>reject(tx.error||new Error('Legacy seed readback transaction failed.'));
          tx.onabort=()=>reject(tx.error||new Error('Legacy seed readback transaction aborted.'));
        });

        if(readback.game?.schema!=='record-game/1')throw new Error('Legacy game readback failed.');
        if(readback.page?.sha256!==sourceSha256)throw new Error('Legacy source SHA readback failed.');
        if(readback.page?.blob?.size!==sourceSize)throw new Error('Legacy source Blob size readback failed.');

        return {ok:true,pageSize:readback.page.blob.size,pageSha256:readback.page.sha256};
      }finally{
        db.close();
      }
    }catch(e){
      return fail(e);
    }
  },{sourceBase64:SOURCE_BASE64,sourceSha256:SOURCE_SHA256,sourceSize:SOURCE_SIZE});

  if(!result?.ok){
    throw new Error(`${name} legacy seed failed: ${result?.name||'Error'}: ${result?.message||'no message'}${result?.stack?`\n${result.stack}`:''}`);
  }
  assert.equal(result.pageSize,SOURCE_SIZE,`${name} legacy seed source size`);
  assert.equal(result.pageSha256,SOURCE_SHA256,`${name} legacy seed source SHA`);
}

async function verifyMigratedEvidence(page,name){
  const result=await page.evaluate(async()=>{
    const fail=e=>({ok:false,message:String(e?.message||e||'unknown')});
    try{
      const db=await new Promise((resolve,reject)=>{
        const r=indexedDB.open('record-chess',3);
        r.onsuccess=()=>resolve(r.result);
        r.onerror=()=>reject(r.error||new Error('indexedDB.open(record-chess) failed.'));
        r.onblocked=()=>reject(new Error('indexedDB.open(record-chess) blocked.'));
      });
      try{
        const values=await new Promise((resolve,reject)=>{
          let tx;
          try{tx=db.transaction(['games','sourcePages'],'readonly');}
          catch(e){reject(e);return;}
          const gReq=tx.objectStore('games').get('legacy-browser-game1');
          const pReq=tx.objectStore('sourcePages').get('legacy-browser-page1');
          tx.oncomplete=()=>resolve({game:gReq.result,page:pReq.result});
          tx.onerror=()=>reject(tx.error||new Error('Migrated evidence readback failed.'));
          tx.onabort=()=>reject(tx.error||new Error('Migrated evidence readback aborted.'));
        });
        return {
          ok:true,
          gameSchema:values.game?.schema||null,
          certificationStatus:values.game?.certificationStatus||null,
          needsReview:values.game?.flags?.needsReview,
          moveCount:values.game?.moves?.length,
          pageSchema:values.page?.schema||null,
          pageSha256:values.page?.sha256||null,
          pageBlobSize:values.page?.blob?.size??null
        };
      }finally{
        db.close();
      }
    }catch(e){return fail(e);}
  });

  if(!result?.ok)throw new Error(`${name} migrated-evidence verification failed: ${result?.message||'unknown'}`);
  assert.equal(result.gameSchema,'record-game/3');
  assert.equal(result.certificationStatus,'INVALIDATED');
  assert.equal(result.needsReview,true);
  assert.equal(result.moveCount,1);
  assert.equal(result.pageSchema,'record-source-page/3');
  assert.equal(result.pageSha256,SOURCE_SHA256);
  assert.equal(result.pageBlobSize,SOURCE_SIZE);
}

async function migrationGate(type,name){
  const browser=await type.launch({headless:true});
  try{
    const context=await browser.newContext();
    const page=await context.newPage();
    const assertNoBrowserErrors=wireDiagnostics(page,name,'migration');
    await seedLegacy(page,name);
    await page.goto(`${ORIGIN}/`,{waitUntil:'networkidle'});
    await page.getByRole('button',{name:'LIBRARY'}).click();
    await page.getByText('Legacy Browser Fixture',{exact:true}).waitFor();
    await page.getByText(/1 plies/).waitFor();
    await page.getByRole('button',{name:/Legacy Browser Fixture/}).click();
    await page.getByText(/CERTIFICATION INVALIDATED|READY_FOR_REVIEW/).first().waitFor();
    await verifyMigratedEvidence(page,name);
    assertNoBrowserErrors();
    await context.close();
  }finally{
    await browser.close();
  }
  console.log(`${name} actual v0.1→v0.3 browser migration PASS`);
}

async function appGate(type,name){
  const browser=await type.launch({headless:true});
  try{
    const context=await browser.newContext({acceptDownloads:true});
    const page=await context.newPage();
    const assertNoBrowserErrors=wireDiagnostics(page,name,'functional');
    await page.goto(`${ORIGIN}/`,{waitUntil:'networkidle'});
    await page.getByRole('button',{name:/NEW RECORD/}).click();
    await page.locator('input[type=file]').setInputFiles('fixtures/recognition/clean-fixture-001/source.png');
    await page.getByText('Page 1',{exact:true}).waitFor();
    await page.getByRole('button',{name:'RECOGNIZE'}).click();
    await page.getByText(/Recognition: COMPLETE/).waitFor();
    await page.getByRole('button',{name:'GAME RECORD'}).click();
    await page.getByRole('button',{name:'ENTER SAN'}).click();
    await page.getByLabel('Move').fill('e4');
    await page.getByRole('button',{name:'ADD MOVE'}).click();
    await page.getByText('e4',{exact:true}).waitFor();
    await page.getByRole('button',{name:/REVIEW \/ CERTIFY/}).click();
    await page.getByRole('button',{name:'CERTIFY CURRENT RECORD'}).click();
    await page.getByText(/Certification status: VALID/).waitFor();
    await page.getByRole('button',{name:'MARK UNREADABLE'}).first().click();
    await page.getByText(/Certification status: INVALIDATED/).waitFor();
    await page.getByRole('button',{name:'CERTIFY CURRENT RECORD'}).click();
    await page.getByRole('status').filter({hasText:/REC-CERT-006: Record is explicitly marked as needing review\./}).waitFor();
    await page.reload({waitUntil:'networkidle'});
    await page.getByRole('button',{name:'LIBRARY'}).click();
    await page.getByText(/1 plies/).waitFor();
    await page.getByRole('button',{name:'HOME'}).click();
    await context.setOffline(true);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByText('RECORD',{exact:true}).first().waitFor();
    await context.setOffline(false);
    assertNoBrowserErrors();
    await context.close();
  }finally{
    await browser.close();
  }
  console.log(`${name} functional/certification/offline PASS`);
}

for(const [name,type] of [['Chromium',chromium],['WebKit',webkit]]){
  await migrationGate(type,name);
  await appGate(type,name);
}
