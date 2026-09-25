import {APP, LIMITS, remoteRecognitionOriginAllowed, isLikelySharedGithubPagesOrigin} from './src/config.js';
import {DB} from './src/db.js';
import {ERR, RecordError, toRecordError} from './src/errors.js';
import {indexToSq, movesWithSan, parseFen, gameStatus, canonicalTimeControl, displayTimeControl} from './src/chess.js';
import {appendMove, applyReconstructionPath, buildCertification, canCertify, deleteFromPly, gamePgn, replaceMoveAt, undoMove, validateRecordAllowUnresolved, verifyCertification} from './src/record.js';
import {prepareSourceFile, ObjectUrlRegistry} from './src/image.js';
import {FIXTURE_SOURCE_SHA256, FixtureRecognitionProvider, RemoteGatewayRecognitionProvider, createRecognitionJob, processEligibleJobs, processRecognitionJob} from './src/recognition.js';
import {ensureDeviceIdentity, registerDevice} from './src/device-auth.js';
import {buildCapsule, verifyCapsule} from './src/capsule.js';
import {buildBackup, estimateBackup, parseBackup, restoreBackup} from './src/backup.js';
import {sha256Bytes, stableStringify} from './src/crypto.js';
import {reconstructGame} from './src/reconstruction.js';

const app = document.querySelector('#app');
const dialogRoot = document.querySelector('#dialog-root');
const toastRoot = document.querySelector('#toast-root');
const urls = new ObjectUrlRegistry();
let route='home', currentGameId=null, selectedSquare=null, boardFlipped=false, viewedPly=null, updateWaiting=null, runtime={};
const PIECE_NAME={K:'White king',Q:'White queen',R:'White rook',B:'White bishop',N:'White knight',P:'White pawn',k:'Black king',q:'Black queen',r:'Black rook',b:'Black bishop',n:'Black knight',p:'Black pawn'};
const PIECE_FILE={K:'wK',Q:'wQ',R:'wR',B:'wB',N:'wN',P:'wP',k:'bK',q:'bQ',r:'bR',b:'bB',n:'bN',p:'bP'};

function h(tag,attrs={},...children){const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(v==null||v===false)continue;if(k==='class')n.className=v;else if(k==='text')n.textContent=v;else if(k.startsWith('on')&&typeof v==='function')n.addEventListener(k.slice(2).toLowerCase(),v);else if(k==='dataset')Object.assign(n.dataset,v);else if(k==='disabled')n.disabled=!!v;else if(k==='checked')n.checked=!!v;else n.setAttribute(k,String(v));}for(const c of children.flat()){if(c==null)continue;n.append(c instanceof Node?c:document.createTextNode(String(c)));}return n;}
function clear(node){while(node.firstChild)node.firstChild.remove();}
function btn(text,handler,kind=''){return h('button',{class:`btn ${kind}`.trim(),type:'button',onClick:handler},text);}
function card(...children){return h('section',{class:'card'},...children);}
function stack(...children){return h('div',{class:'stack'},...children);}
function row(...children){return h('div',{class:'row'},...children);}
function divider(){return h('div',{class:'divider'});}
function fmtBytes(n){if(n<1024)return `${n} B`;if(n<1024**2)return `${(n/1024).toFixed(1)} KiB`;if(n<1024**3)return `${(n/1024**2).toFixed(1)} MiB`;return `${(n/1024**3).toFixed(2)} GiB`;}
function safeFile(s){return String(s||'record').replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,100)||'record';}
function gameTitle(g){const m=g.metadata;return (m.white||m.black)?`${m.white||'White'} — ${m.black||'Black'}`:(m.event||'Untitled game');}
function currentPath(){return `${location.pathname}${location.search}`;}

function formatRelative(iso){
  if(!iso||iso==='Never')return 'Never';
  const ms=Date.now()-Date.parse(iso);if(!Number.isFinite(ms))return iso;
  const min=Math.floor(ms/60000);if(min<1)return 'Just now';if(min<60)return `${min}m ago`;
  const hr=Math.floor(min/60);if(hr<24)return `${hr}h ago`;
  const day=Math.floor(hr/24);return `${day}d ago`;
}
function backupHealth(games,lastBackupAt){
  const t=Date.parse(lastBackupAt||'');
  const due=!Number.isFinite(t)?games.length:games.filter(g=>Date.parse(g.updatedAt)>t).length;
  return {due,lastBackupAt:lastBackupAt||'Never'};
}
function qualityWarnings(asset){return asset?.quality?.warnings||[];}
function copyText(text,label='Copied'){
  return navigator.clipboard?.writeText?.(text).then(()=>toast(`${label}.`,'good')).catch(()=>{const ta=h('textarea',{text});document.body.append(ta);ta.select();document.execCommand?.('copy');ta.remove();toast(`${label}.`,'good');});
}
async function shareOrSaveFile(blob,name,title){
  try{
    const file=new File([blob],name,{type:blob.type||'application/octet-stream'});
    if(navigator.canShare?.({files:[file]})){
      try{await navigator.share({files:[file],title});return true;}
      catch(e){if(e?.name==='AbortError')return false;}
    }
  }catch{}
  downloadBlob(blob,name);return true;
}


function topbar(){
  const right=h('div',{class:'topbar-actions'});
  if(updateWaiting)right.append(h('button',{type:'button',class:'badge good update-chip',onClick:()=>updateWaiting.postMessage({type:'SKIP_WAITING'})},'UPDATE READY'));
  if(!navigator.onLine)right.append(h('span',{class:'badge',text:'OFFLINE'}));
  return h('header',{class:'topbar'},
    h('div',{},h('div',{class:'brand',text:'RECORD'}),h('div',{class:'version',text:`${APP.release} · ${APP.version}`})),
    right
  );
}

function nav(active){
  const n=h('nav',{class:'nav','aria-label':'Primary navigation'});
  for(const [key,label] of [['home','HOME'],['scan','SCAN'],['library','LIBRARY'],['system','SYSTEM']]){
    n.append(h('button',{type:'button',class:key===active?'active':'','aria-current':key===active?'page':null,onClick:()=>go(key)},label));
  }
  return n;
}
function statusBadge(g,verifiedStatus='UNCERTIFIED'){const valid=verifiedStatus==='VALID',invalid=['HASH_MISMATCH','SOURCE_MISMATCH','OBSERVATION_MISMATCH','MOVE_LEDGER_INVALID','SCHEMA_INVALID','REVIEW_REQUIRED','INVALIDATED'].includes(verifiedStatus);const label=valid?'CERTIFIED — VERIFIED':g.certification?`CERTIFICATION ${verifiedStatus}`:(g.certificationStatus==='INVALIDATED'?'CERTIFICATION INVALIDATED':g.workflowState);return h('span',{class:`badge ${valid?'good':invalid?'warn':''}`,text:label});}
async function verifiedCertificationStatus(g){if(!g?.certification)return g?.certificationStatus==='INVALIDATED'?'INVALIDATED':'UNCERTIFIED';try{const [pages,observations]=await Promise.all([DB.pages(g.id),DB.currentObservations(g.id)]);return (await verifyCertification(g,pages,observations)).status;}catch{return 'UNVERIFIABLE';}}
function mainShell(active,...children){clear(app);urls.clear();app.append(topbar(),h('main',{id:'main'},...children),nav(active));}
function go(to,id=null){route=to;if(id)currentGameId=id;selectedSquare=null;viewedPly=null;render();}

function toast(message,kind=''){
  const t=h('div',{class:`toast ${kind}`.trim(),role:kind==='danger'?'alert':'status'},message);
  toastRoot.append(t);setTimeout(()=>t.remove(),4500);
}
function report(error){const e=toRecordError(error);console.error(e);toast(`${e.code}: ${e.message}`,'danger');}

function showDialog({title,body,actions=[]}){
  clear(dialogRoot);const previous=document.activeElement;const backdrop=h('div',{class:'dialog-backdrop'});const dialog=h('div',{class:'dialog',role:'dialog','aria-modal':'true','aria-labelledby':'record-dialog-title',tabindex:'-1'});const head=h('div',{class:'row between'},h('h2',{id:'record-dialog-title',text:title}),btn('CLOSE',close,'ghost'));dialog.append(head,body);const actionRow=h('div',{class:'row wrap dialog-actions'});for(const a of actions)actionRow.append(btn(a.label,()=>a.onClick(close),a.kind||''));dialog.append(actionRow);backdrop.append(dialog);dialogRoot.append(backdrop);function close(){clear(dialogRoot);previous?.focus?.();}backdrop.addEventListener('click',e=>{if(e.target===backdrop)close();});dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const f=[...dialog.querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled);if(!f.length)return;const first=f[0],last=f.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});setTimeout(()=>dialog.focus(),0);return close;
}
async function confirmSheet(title,text,confirmLabel='CONFIRM',danger=false){return new Promise(resolve=>{const body=h('div',{},h('p',{class:'note',text}));showDialog({title,body,actions:[{label:'CANCEL',onClick:c=>{c();resolve(false)}},{label:confirmLabel,kind:danger?'danger':'primary',onClick:c=>{c();resolve(true)}}]});});}

async function loadRuntime(){try{const r=await fetch('./config/runtime.json',{cache:'no-store'}),stale=r.headers.get('x-record-runtime-cache')==='stale-fallback';runtime=await r.json();runtime.runtimeCacheState=stale?'STALE_FALLBACK':'FRESH';if(stale){const age=Date.now()-Date.parse(runtime.builtAt||0);if(!Number.isFinite(age)||age>LIMITS.runtimeConfigMaxAgeMs){runtime={...runtime,gatewayEnabled:false,providerProfile:'fixture',runtimeCacheState:'STALE_EXPIRED'};}}}catch{runtime={gatewayEnabled:false,providerProfile:'fixture',runtimeCacheState:'UNAVAILABLE'};}}
async function getGatewaySettings(){const stored=await DB.getSetting('gatewayPreferences',{});return {...runtime,providerProfile:stored?.providerProfile||runtime.providerProfile||'fixture'};}

async function fixtureProvider(){
  const res=await fetch('./fixtures/recognition/clean-fixture-001/envelope.json');
  if(!res.ok)throw new RecordError(ERR.VIS_SCHEMA,'Fixture recognition envelope missing.');
  return new FixtureRecognitionProvider(await res.json(),{allowedSourceSha256:FIXTURE_SOURCE_SHA256});
}
async function providerFor(profile){if(profile==='fixture')return fixtureProvider();const settings=await getGatewaySettings();return new RemoteGatewayRecognitionProvider(settings);}
function currentGatewayTrustContext(observations=[]){if(!runtime.gatewayPublicJwk)return {gatewayKeys:{}};const keys={};for(const o of observations)if(o?.gateway?.keyId&&o.signature)keys[o.gateway.keyId]=runtime.gatewayPublicJwk;return {gatewayKeys:keys};}

async function render(){try{if(route==='home')return renderHome();if(route==='scan')return renderScan();if(route==='library')return renderLibrary();if(route==='game')return renderGame();if(route==='review')return renderReview();if(route==='system')return renderSystem();}catch(e){report(e);mainShell('',card(h('h2',{text:'RECORD could not render this state.'}),h('div',{class:'notice danger',text:`${e.code||'REC-UNK'}: ${e.message}`})));}}


async function renderHome(){
  const [games,jobs,lastBackupAt,persisted]=await Promise.all([
    DB.listGames(),DB.jobs(),DB.getSetting('lastBackupAt','Never'),navigator.storage?.persisted?.()||false
  ]);
  const pending=jobs.filter(j=>['QUEUED','UPLOADING','PROCESSING','FAILED_RETRYABLE'].includes(j.status)).length;
  const backup=backupHealth(games,lastBackupAt);
  const hero=card(
    h('h1',{class:'hero-title',text:'RECORD'}),
    h('p',{class:'hero-copy',text:'Capture first. Reconstruct carefully. Certify only what you have actually reviewed against the physical record.'})
  );
  const field=card(
    h('div',{class:'row between'},h('h2',{text:'Field desk'}),h('span',{class:`badge ${backup.due?'warn':'good'}`,text:backup.due?`${backup.due} BACKUP DUE`:'BACKUP CURRENT'})),
    h('p',{class:'note',text:`Last backup: ${formatRelative(lastBackupAt)}. Persistent browser storage: ${persisted?'granted':'not granted'}.`}),
    stack(
      quickCaptureControl(),
      btn('NEW EMPTY RECORD',async()=>{const g=await DB.createGame();currentGameId=g.id;go('scan');}),
      games.length?btn('CONTINUE LATEST',()=>go('game',games[0].id),'ghost'):null,
      backup.due?btn('EXPORT VERIFIED BACKUP',exportBackup,'primary'):null
    ),
    !persisted?h('div',{class:'notice warn',text:'iOS/browser storage may be reclaimed. Export backups regularly and request persistent storage from SYSTEM when available.'}):null,
    pending?h('div',{class:'notice warn',text:`${pending} recognition job(s) pending or retryable.`}):null
  );
  const bridge=card(h('div',{class:'ecosystem-bridge'},
    h('img',{class:'capturedmirage-mark',src:'./assets/branding/capturedmirage-logo.png',alt:'CAPTUREDMIRAGE logo'}),
    h('div',{},h('div',{class:'eyebrow',text:'CAPTUREDMIRAGE · DOWNSTREAM'}),h('h3',{text:'RECORD certifies. CAPTUREDMIRAGE interprets.'}),h('p',{class:'note',text:'Certified Capsules preserve the evidence boundary for later Clinic, Player Model, repair and repertoire analysis. RECORD itself does not score move quality.'}))
  ));
  const recentItems=await Promise.all(games.slice(0,4).map(gameItem));
  const recent=games.length?card(h('div',{class:'row between'},h('h2',{text:'Recent'}),h('span',{class:'badge',text:`${games.length} LOCAL`})),stack(...recentItems)):card(h('div',{class:'empty',text:'No local records yet.'}));
  mainShell('home',hero,field,bridge,recent);
}

function quickCaptureControl(){
  const label=h('label',{class:'btn primary capture-label quick-capture'},'QUICK CAPTURE SCORESHEET');
  const input=h('input',{type:'file',accept:'image/jpeg,image/png',capture:'environment',hidden:true});
  label.append(input);
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];if(!file)return;
    let game=null;
    try{
      game=await DB.createGame();
      toast('Securing source image…');
      const prepared=await prepareSourceFile(file,{gameId:game.id,existingPages:0,existingBytes:0});
      await DB.addPage(game.id,prepared.page,prepared.derived);
      currentGameId=game.id;route='scan';
      toast(prepared.quality.warnings.length?`Captured with ${prepared.quality.warnings.length} review warning(s).`:'Scoresheet captured.','good');
      await render();
    }catch(e){
      if(game){try{await DB.deleteGame(game.id);}catch{}}
      report(e);
    }finally{input.value='';}
  });
  return label;
}

async function gameItem(g){const verified=await verifiedCertificationStatus(g),b=h('button',{class:'game-item',type:'button',onClick:()=>go('game',g.id)});b.append(h('div',{class:'row between'},h('strong',{text:gameTitle(g)}),statusBadge(g,verified)),h('div',{class:'meta',text:`${g.metadata.event||'No event'} · ${g.metadata.date||'Unknown date'} · ${g.moves.length} plies · rev ${g.revision}`}));return b;}


async function renderScan(){
  let g=currentGameId?await DB.getGame(currentGameId):null;
  if(!g){g=await DB.createGame();currentGameId=g.id;}
  const [pages,jobs,observations,settings]=await Promise.all([DB.pages(g.id),DB.jobs(g.id),DB.observations(g.id),getGatewaySettings()]);
  const sourceBytes=pages.reduce((n,p)=>n+p.size,0);
  const fixtureMode=(settings.providerProfile||'fixture')==='fixture';
  const intro=card(
    h('h2',{text:'Source capture'}),
    h('div',{class:'notice',text:'Original source bytes are immutable evidence. Derived images are bounded, metadata-stripped working copies.'}),
    fixtureMode?h('div',{class:'notice warn',text:'Recognition is in FIXTURE mode on this installation. Fixture observations are permitted only for the bundled test page; real scoresheets must be entered/reviewed manually until a commissioned remote gateway is enabled.'}):null,
    divider(),captureControl(g,pages,sourceBytes)
  );
  const list=card(h('div',{class:'row between'},h('h3',{text:'Pages'}),h('span',{class:'badge',text:String(pages.length)})),
    pages.length?stack(...await Promise.all(pages.map((p,i)=>sourceRow(g,p,i,pages,jobs,observations,settings)))):h('div',{class:'empty',text:'No source pages captured.'}));
  mainShell('scan',intro,list,h('div',{class:'grid2'},btn('HOME',()=>go('home')),btn('GAME RECORD',()=>go('game'),'primary')));
}

function captureControl(g,pages,sourceBytes){
  const addSource=async(input)=>{
    const f=input.files?.[0];if(!f)return;
    try{
      toast('Validating and preparing source…');
      const freshPages=await DB.pages(g.id),freshBytes=freshPages.reduce((n,p)=>n+p.size,0);
      const prepared=await prepareSourceFile(f,{gameId:g.id,existingPages:freshPages.length,existingBytes:freshBytes});
      await DB.addPage(g.id,prepared.page,prepared.derived);
      toast(prepared.quality.warnings.length?`Source added with ${prepared.quality.warnings.length} quality warning(s). Review before leaving capture.`:'Source added.','good');
      render();
    }catch(e){report(e);}finally{input.value='';}
  };
  const cameraLabel=h('label',{class:'btn primary capture-label'},'CAPTURE PAGE');
  const cameraInput=h('input',{type:'file',accept:'image/jpeg,image/png',capture:'environment',hidden:true});
  cameraLabel.append(cameraInput);cameraInput.addEventListener('change',()=>addSource(cameraInput));
  const importLabel=h('label',{class:'btn capture-label'},'ADD FROM PHOTOS / FILES');
  const importInput=h('input',{type:'file',accept:'image/jpeg,image/png',hidden:true});
  importLabel.append(importInput);importInput.addEventListener('change',()=>addSource(importInput));
  return h('div',{class:'stack'},h('div',{class:'grid2'},cameraLabel,importLabel),h('p',{class:'note',text:'JPEG or PNG only. Camera capture and existing Photos/Files images follow the same signature, pixel-bound and exact-source preservation checks.'}));
}

async function sourceRow(g,p,i,pages,jobs,observations,settings){
  const derived=await DB.derivedForPage(g.id,p.id),thumb=derived.find(a=>a.purpose==='thumbnail'),recognition=derived.find(a=>a.purpose==='recognition'),
    url=urls.create((thumb||p).blob),job=jobs.filter(j=>j.pageId===p.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0],
    obs=observations.filter(o=>o.pageId===p.id).length,warnings=qualityWarnings(recognition);
  const profile=settings.providerProfile||'fixture',fixtureEligible=p.sha256===FIXTURE_SOURCE_SHA256;
  const wrap=h('div',{class:'page-thumb'});
  const image=h('button',{class:'source-image-button',type:'button',onClick:()=>showSourceViewer(g,p,recognition,observations)},h('img',{src:url,alt:`Scoresheet page ${i+1}`}));
  const info=h('div',{},
    h('div',{class:'row wrap'},h('strong',{text:`Page ${i+1}`}),h('span',{class:`badge ${warnings.length?'warn':'good'}`,text:warnings.length?`${warnings.length} CAPTURE WARNING${warnings.length===1?'':'S'}`:'CAPTURE CHECK OK'})),
    h('div',{class:'meta',text:`${p.mime} · ${fmtBytes(p.size)} · ${p.width}×${p.height}`}),
    h('div',{class:'hash',text:p.sha256}),
    warnings.length?h('ul',{class:'quality-list'},...warnings.map(w=>h('li',{text:w.replace(/^Capture check:\s*/,'')}))):null,
    recognition?h('div',{class:'meta',text:`Derived ${recognition.width}×${recognition.height}`}):null,
    job?h('div',{class:'meta',text:`Recognition: ${job.status} · observations ${obs}`}):null
  );
  const recognizeLabel=profile==='fixture'?(fixtureEligible?(job?.status==='COMPLETE'?'RE-RUN FIXTURE':'RUN FIXTURE'):'FIXTURE LOCKED'):(job?.status==='COMPLETE'?'RE-RUN RECOGNITION':'RECOGNIZE');
  const recognizeButton=btn(recognizeLabel,()=>recognizePage(g,p,recognition),profile==='fixture'?'ghost':'primary');
  if(profile==='fixture'&&!fixtureEligible)recognizeButton.disabled=true;
  const actions=h('div',{class:'page-actions'},
    btn('VIEW',()=>showSourceViewer(g,p,recognition,observations),'ghost'),
    btn('COPY SHA-256',()=>copyText(p.sha256,'Source SHA-256 copied'),'ghost'),
    btn('↑',async()=>{await DB.reorderPage(g.id,p.id,-1);render();},'ghost'),
    btn('↓',async()=>{await DB.reorderPage(g.id,p.id,1);render();},'ghost'),
    recognizeButton,
    btn('DELETE',async()=>{if(await confirmSheet('Delete source page','This removes the page and its derived/recognition artifacts from the local working archive. Exported Capsules remain unaffected.','DELETE',true)){await DB.deletePage(g.id,p.id);render();}},'danger')
  );
  wrap.append(image,info,actions);return wrap;
}

async function recognizePage(g,p,derived){
  if(!derived)return report(new RecordError(ERR.SRC_DECODE,'No recognition derivative exists for this page.'));
  try{
    const settings=await getGatewaySettings(),profile=settings.providerProfile||'fixture';
    if(profile==='fixture'&&p.sha256!==FIXTURE_SOURCE_SHA256)throw new RecordError(ERR.VIS_FIXTURE,'Fixture recognition cannot be applied to a real scoresheet. Use manual entry or a commissioned remote gateway.');
    if(profile!=='fixture'&&!remoteRecognitionOriginAllowed(settings))throw new RecordError(ERR.VIS_ORIGIN,'Remote recognition is blocked on shared GitHub Pages origins or until a dedicated HTTPS origin/gateway is configured.');
    const latest=await DB.getGame(g.id),prior=(await DB.jobs(g.id)).filter(j=>j.pageId===p.id&&j.status==='COMPLETE').sort((a,b)=>b.runSequence-a.runSequence)[0]||null,
      job=await createRecognitionJob({game:latest,page:p,derivedAsset:derived,providerProfile:profile,runKind:prior?'RERUN':'INITIAL',supersedesRequestId:prior?.id||null}),
      provider=await providerFor(profile);
    toast(prior?'Recognition re-run queued.':'Recognition job queued.');
    await processRecognitionJob(job,{provider,derivedAsset:derived});
    toast(profile==='fixture'?'Fixture observations stored.':'Recognition observations stored.','good');render();
  }catch(e){report(e);render();}
}

async function showSourceViewer(g,p,derived,observations){
  const useDerived=derived||p,url=urls.create(useDerived.blob),warnings=qualityWarnings(derived);
  const body=h('div',{class:'viewer'},
    warnings.length?h('div',{class:'notice warn',text:`Capture review: ${warnings.join(' ')}`}):h('div',{class:'notice',text:'Capture quality heuristics reported no warning conditions.'}),
    h('div',{class:'viewer-stage'},h('img',{src:url,alt:`Scoresheet page ${p.order+1}`,class:'viewer-image'}))
  );
  const obs=observations.filter(o=>o.pageId===p.id);
  if(obs.length){
    const overlay=h('div',{class:'viewer-overlay'});
    for(const env of obs)for(const cell of env.cells){
      const r=h('div',{class:'cell-box',title:`${cell.moveNumber}${cell.side==='white'?'.':'...'} ${cell.observations[0]?.text||''}`});
      Object.assign(r.style,{left:`${cell.crop.x*100}%`,top:`${cell.crop.y*100}%`,width:`${cell.crop.w*100}%`,height:`${cell.crop.h*100}%`});overlay.append(r);
    }
    body.querySelector('.viewer-stage').append(overlay);
  }
  const actions=[{label:'COPY SOURCE SHA-256',onClick:()=>copyText(p.sha256,'Source SHA-256 copied')}];
  if(derived)actions.unshift({label:'SHOW ORIGINAL',onClick:close=>{close();showDialog({title:`Original source page ${p.order+1}`,body:h('div',{class:'viewer'},h('img',{class:'viewer-image',src:urls.create(p.blob),alt:'Original source'}))});}});
  showDialog({title:`Source page ${p.order+1}`,body,actions});
}
function stateAtPly(g,ply){let state=parseFen(g.startFen);for(let i=0;i<ply;i++){const m=g.moves[i];if(!m)break;state=parseFen(m.afterFen);}return state;}

async function renderGame(){
  const g=await DB.getGame(currentGameId);if(!g)return go('library');
  const [pages,currentObs]=await Promise.all([DB.pages(g.id),DB.currentObservations(g.id)]);
  const certStatus=g.certification?(await verifyCertification(g,pages,currentObs)).status:(g.certificationStatus==='INVALIDATED'?'INVALIDATED':'UNCERTIFIED');
  validateRecordAllowUnresolved(g);
  const max=g.moves.length,ply=viewedPly==null?max:Math.max(0,Math.min(viewedPly,max)),state=stateAtPly(g,ply),legal=ply===max?movesWithSan(state):[],targetMap=new Map();
  if(selectedSquare!==null&&ply===max)for(const m of legal.filter(x=>x.from===selectedSquare)){const a=targetMap.get(m.to)||[];a.push(m);targetMap.set(m.to,a);}
  const head=card(h('div',{class:'row between'},h('div',{},h('h2',{text:gameTitle(g)}),h('div',{class:`status ${certStatus==='VALID'?'certified':''}`,text:certStatus==='VALID'?'CERTIFIED — VERIFIED':`${g.workflowState} · ${certStatus}`})),btn('METADATA',()=>metadataDialog(g))));
  const undoButton=btn('UNDO LAST',async()=>{
    if(!g.moves.length)return;
    if(await confirmSheet('Undo last move',`Remove ${g.moves.at(-1).san} from the end of the move ledger?`,'UNDO',true))await mutateGameAction(g,'MOVE_UNDONE',gg=>undoMove(gg));
  },'ghost');
  undoButton.disabled=!g.moves.length;
  const selectedEdit=btn(ply>0&&ply<=max?`EDIT ${g.moves[ply-1].san}`:'EDIT SELECTED',()=>moveEditDialog(g,ply-1),'ghost');
  selectedEdit.disabled=ply<1||ply>max;
  const boardCard=card(boardElement(g,state,legal,targetMap,ply),h('div',{class:'row wrap board-actions'},
    btn('FLIP',()=>{boardFlipped=!boardFlipped;render();}),
    btn('|<',()=>{viewedPly=0;selectedSquare=null;render();},'ghost'),
    btn('<',()=>{viewedPly=Math.max(0,ply-1);selectedSquare=null;render();},'ghost'),
    btn('>',()=>{viewedPly=Math.min(max,ply+1);selectedSquare=null;render();},'ghost'),
    btn('>|',()=>{viewedPly=max;selectedSquare=null;render();},'ghost'),
    selectedEdit,undoButton,btn('ENTER SAN',()=>sanDialog(g,state),'')
  ));
  const moves=card(h('div',{class:'row between'},h('h3',{text:'Moves'}),h('span',{class:'badge',text:`${g.moves.length} PLIES`})),h('p',{class:'note',text:'Tap a move to inspect that position; use EDIT above for iPhone-safe correction. Long-press editing remains available where the browser supports it.'}),movesTable(g,ply));
  const notesArea=h('textarea',{text:g.notes||'',placeholder:'Postgame notes, recollections, clock events, disputed notation…'});let notesTimer=null,notesSave=Promise.resolve();
  const saveNotes=()=>{clearTimeout(notesTimer);const value=notesArea.value;notesSave=notesSave.then(async()=>{if(value===g.notes)return;await DB.mutateGame(g.id,{eventType:'NOTES_CHANGED'},gg=>{gg.notes=value;});g.notes=value;}).catch(e=>report(e));return notesSave;};
  notesArea.addEventListener('input',()=>{clearTimeout(notesTimer);notesTimer=setTimeout(saveNotes,300);});
  notesArea.addEventListener('change',saveNotes);notesArea.addEventListener('blur',saveNotes);
  const notes=card(h('label',{},'Postgame note',notesArea));
  const actions=card(stack(
    btn('REVIEW / CERTIFY',()=>go('review'),'primary'),
    btn('COPY PGN',async()=>{await copyText(gamePgn(g),'PGN copied');}),
    btn('SHARE / SAVE PGN',()=>sharePgn(g)),
    btn('SOURCE PAGES',()=>go('scan'))
  ));
  mainShell('',head,h('div',{class:'game-layout'},boardCard,stack(moves,notes,actions)));
}
function boardElement(g,state,legal,targetMap,ply){const order=boardFlipped?[...Array(64).keys()].reverse():[...Array(64).keys()];const board=h('div',{class:'board','aria-label':`Chess board at ply ${ply}`,role:'grid'});const last=ply>0?g.moves[ply-1]:null;let lastFrom=-1,lastTo=-1;if(last?.uci){try{lastFrom=(8-Number(last.uci[1]))*8+'abcdefgh'.indexOf(last.uci[0]);lastTo=(8-Number(last.uci[3]))*8+'abcdefgh'.indexOf(last.uci[2]);}catch{}}const inChk=gameStatus(state).check;for(const i of order){const p=state.board[i],sq=indexToSq(i),isTarget=targetMap.has(i),classes=['square',((Math.floor(i/8)+i%8)%2)?'dark':'light'];if(selectedSquare===i)classes.push('selected');if(isTarget)classes.push(p?'capture':'target');if(i===lastFrom||i===lastTo)classes.push('last-move');if(inChk&&p&&(p==='K'&&state.turn==='w'||p==='k'&&state.turn==='b'))classes.push('in-check');const aria=p?`${PIECE_NAME[p]} on ${sq}${selectedSquare===i?', selected':''}${isTarget?', legal destination':''}`:`Empty ${sq}${isTarget?', legal destination':''}`;const b=h('button',{class:classes.join(' '),type:'button','aria-label':aria,role:'gridcell',onClick:()=>handleSquare(g,state,i,legal)});if(p)b.append(h('img',{src:`assets/pieces/cburnett/${PIECE_FILE[p]}.svg`,alt:'',draggable:'false'}));b.append(h('span',{class:'coord',text:sq}));board.append(b);}return h('div',{class:'board-wrap'},board);}
async function handleSquare(g,state,i,legal){if(viewedPly!=null&&viewedPly!==g.moves.length){viewedPly=g.moves.length;selectedSquare=null;return render();}if(selectedSquare===null){const p=state.board[i];if(p&&((p===p.toUpperCase())?'w':'b')===state.turn){selectedSquare=i;render();}return;}const choices=legal.filter(m=>m.from===selectedSquare&&m.to===i);if(!choices.length){selectedSquare=null;return render();}let chosen=choices[0];if(choices.some(x=>x.promotion)){chosen=await promotionDialog(choices);if(!chosen)return;}try{await DB.mutateGame(g.id,{eventType:'MOVE_ENTERED'},gg=>appendMove(gg,{from:chosen.from,to:chosen.to,promotion:chosen.promotion},'USER_ENTERED'));selectedSquare=null;viewedPly=null;render();}catch(e){report(e);}}
function promotionDialog(choices){return new Promise(resolve=>{const body=h('div',{class:'promotion-grid'});for(const p of ['q','r','b','n']){const c=choices.find(x=>x.promotion===p);if(c)body.append(btn(p.toUpperCase(),()=>{close();resolve(c);},'primary'));}const close=showDialog({title:'Choose promotion',body,actions:[{label:'CANCEL',onClick:c=>{c();resolve(null);}}]});});}
function movesTable(g,current){if(!g.moves.length)return h('div',{class:'empty',text:'No moves entered.'});const out=h('div',{class:'moves'});for(let i=0;i<g.moves.length;i+=2){const r=h('div',{class:'move-row'},h('span',{class:'move-num',text:`${i/2+1}.`}));for(const idx of [i,i+1]){const m=g.moves[idx];const cell=h('button',{class:`move-cell ${current===idx+1?'current':''}`,type:'button',onClick:()=>{viewedPly=idx+1;selectedSquare=null;render();}},m?.san||'');if(m)cell.addEventListener('contextmenu',e=>{e.preventDefault();moveEditDialog(g,idx);});r.append(cell);}out.append(r);}return out;}
async function moveEditDialog(g,index){const move=g.moves[index],input=h('input',{type:'text',value:move.san,maxlength:'32'}),body=stack(h('div',{class:'note',text:`Editing ply ${index+1}. RECORD rebuilds the later line until the first move that becomes illegal.`}),h('label',{},'Replacement SAN',input));showDialog({title:`Edit ${move.san}`,body,actions:[{label:'DELETE FROM HERE',kind:'danger',onClick:async c=>{c();await mutateGameAction(g,'MOVE_TAIL_DELETED',gg=>deleteFromPly(gg,index));}},{label:'REPLACE',kind:'primary',onClick:async c=>{try{await DB.mutateGame(g.id,{eventType:'MOVE_REPLACED',payload:{ply:index+1}},gg=>replaceMoveAt(gg,index,input.value.trim()));c();render();}catch(e){report(e);}}}]});}
async function mutateGameAction(g,eventType,fn){try{await DB.mutateGame(g.id,{eventType},fn);render();}catch(e){report(e);}}
function sanDialog(g,state){const input=h('input',{type:'text',maxlength:'32',autocomplete:'off',autocapitalize:'characters',placeholder:'e.g. Nf3'});showDialog({title:'Enter legal SAN',body:h('label',{},'Move',input),actions:[{label:'ADD MOVE',kind:'primary',onClick:async c=>{try{await DB.mutateGame(g.id,{eventType:'MOVE_ENTERED_SAN'},gg=>appendMove(gg,input.value,'USER_ENTERED'));c();render();}catch(e){report(e);}}}]});}
function metadataDialog(g){const fields={};const body=h('div',{class:'form-grid'});for(const [key,label] of [['event','Event'],['site','Site'],['date','Date (PGN YYYY.MM.DD)'],['round','Round'],['board','Board'],['section','Section'],['white','White'],['black','Black']]){fields[key]=h('input',{type:'text',value:g.metadata[key]||'',maxlength:'200'});body.append(h('label',{},label,fields[key]));}fields.result=h('select',{});for(const x of ['*','1-0','0-1','1/2-1/2'])fields.result.append(h('option',{value:x,selected:g.metadata.result===x},x));body.append(h('label',{},'Result',fields.result));fields.tc=h('input',{type:'text',value:displayTimeControl(g.metadata.timeControl)||'',placeholder:'90+30',maxlength:'64'});body.append(h('label',{},'Time control (minutes+increment)',fields.tc));showDialog({title:'Game metadata',body,actions:[{label:'SAVE',kind:'primary',onClick:async c=>{try{await DB.mutateGame(g.id,{eventType:'METADATA_CHANGED'},gg=>{for(const k of ['event','site','date','round','board','section','white','black'])gg.metadata[k]=fields[k].value.trim();gg.metadata.result=fields.result.value;gg.metadata.resultProvenance='USER_REPORTED';gg.metadata.timeControl=fields.tc.value.trim()?canonicalTimeControl(fields.tc.value.replace(/\s*min\s*\+\s*/i,'+').replace(/\s*sec\s*/i,'')):'';});c();render();}catch(e){report(e);}}}]});}

async function sharePgn(g){
  const blob=new Blob([gamePgn(g)],{type:'application/x-chess-pgn'}),name=`${safeFile(gameTitle(g))}.pgn`;
  const delivered=await shareOrSaveFile(blob,name,gameTitle(g));
  if(delivered)toast('PGN export initiated.','good');else toast('PGN export cancelled.','warn');
}

async function renderReview(){
  const g=await DB.getGame(currentGameId);if(!g)return go('library');
  const [pages,observations,allObservations,runs]=await Promise.all([DB.pages(g.id),DB.currentObservations(g.id),DB.observations(g.id),DB.reconstructions(g.id)]);
  const cert=await verifyCertification(g,pages,observations),gate=await canCertify(g,pages,observations);
  const checks=[
    ['SOURCE',pages.length?`${pages.length} page(s) preserved`:'No source page',pages.length>0],
    ['MOVE LEDGER',g.moves.length?`${g.moves.length} plies`:'No moves entered',g.moves.length>0],
    ['REVIEW FLAG',g.flags.needsReview?'Needs review':'Clear',!g.flags.needsReview],
    ['CERTIFICATION GATE',gate.ok?'Canonical hash can be produced':gate.error?.message||'Blocked',gate.ok],
  ];
  const warnings=[];
  if(g.metadata.result==='*')warnings.push('Game result is still "*".');
  if(!g.metadata.white||!g.metadata.black)warnings.push('One or both player names are blank.');
  if(observations.some(o=>o.gateway?.keyId==='UNSIGNED_FIXTURE'))warnings.push('Current observations include unsigned fixture data; do not treat fixture output as historical recognition.');
  const summary=card(
    h('h2',{text:'Review / certification'}),
    h('div',{class:`notice ${cert.status==='VALID'?'':'warn'}`,text:`Certification status: ${cert.status}`}),
    h('p',{class:'note',text:'Certification is a human historical assertion. RECORD verifies structure, source bytes, move legality and evidence bindings; it cannot decide what actually happened over the board.'})
  );
  const readiness=card(
    h('div',{class:'row between'},h('h3',{text:'Certification readiness'}),h('span',{class:`badge ${gate.ok?'good':'warn'}`,text:gate.ok?'READY':'BLOCKED'})),
    h('div',{class:'readiness-grid'},...checks.flatMap(([k,v,ok])=>[h('div',{class:'readiness-key',text:k}),h('div',{class:`readiness-value ${ok?'good':'warn'}`,text:v})])),
    warnings.length?h('div',{class:'notice warn',text:`Review warnings: ${warnings.join(' ')}`}):null
  );
  const observationCards=[];
  for(const env of observations){
    const page=pages.find(p=>p.id===env.pageId),assets=await DB.derivedForPage(g.id,env.pageId),derived=assets.find(a=>a.purpose==='recognition');
    for(const cell of env.cells)observationCards.push(observationCard(g,env,cell,page,derived));
    for(const mo of env.metadataObservations)observationCards.push(metadataObservationCard(g,env,mo));
  }
  const obsSection=card(h('div',{class:'row between'},h('h3',{text:'Current vision observations'}),h('span',{class:'badge',text:`${observationCards.length} · ${allObservations.length-observations.length} HISTORICAL`})),observationCards.length?stack(...observationCards):h('div',{class:'empty',text:'No current recognition observations stored. Manual entry remains first-class.'}));
  const latestRun=runs[0]||null,recon=card(h('div',{class:'row between'},h('h3',{text:'Chess-constrained reconstruction'}),latestRun?h('span',{class:`badge ${latestRun.status==='COMPLETE'?'good':'warn'}`,text:latestRun.status}):h('span',{class:'badge',text:'NOT RUN'})),
    h('p',{class:'note',text:'Vision supplies ranked handwriting observations. RECORD enumerates legal continuations and preserves ambiguity; Stockfish/move quality are not historical evidence.'}),
    btn('RUN RECONSTRUCTION',async()=>{try{const fresh=await DB.getGame(g.id),current=await DB.currentObservations(g.id),run=await reconstructGame({game:fresh,observations:current});await DB.putReconstruction(run);toast(`Reconstruction ${run.status.toLowerCase()}.`,run.status==='COMPLETE'?'good':'warn');render();}catch(e){report(e);}},'primary'),
    latestRun?reconstructionRunView(g,latestRun):null
  );
  const certifyButton=btn(gate.ok?'CERTIFY CURRENT RECORD':'CERTIFICATION BLOCKED',()=>certifyCurrent(g),'primary');certifyButton.disabled=!gate.ok;
  const capsuleButton=btn(cert.status==='VALID'?'EXPORT CERTIFIED CAPSULE':'CAPSULE REQUIRES VALID CERTIFICATION',()=>exportCapsule(g,pages));capsuleButton.disabled=cert.status!=='VALID';
  const actions=card(stack(certifyButton,capsuleButton,btn('VERIFY CAPSULE FILE',verifyCapsuleFile),btn('BACK TO GAME',()=>go('game'))));
  mainShell('',summary,readiness,obsSection,recon,actions);await hydrateCrops();
}
function reconstructionRunView(g,run){const wrap=h('div',{class:'reconstruction-run'},h('div',{class:'meta',text:`${run.algorithm} · ${run.paths.length} path(s) · rev ${run.recordRevision}/${run.sourceRevision}` }));for(const [i,path] of run.paths.slice(0,3).entries()){const line=h('div',{class:'reconstruction-path'},h('strong',{text:`Path ${i+1} · score ${path.score}`}),h('div',{class:'move-text',text:path.moves.map(m=>m.san).join(' ')}),path.requiresReview?h('div',{class:'notice warn',text:'Human review required. This path contains ambiguity and/or an inferred bridge.'}):h('div',{class:'notice',text:'Best-supported legal reconstruction; user certification is still required.'}),btn('APPLY PATH',async()=>{try{const fresh=await DB.getGame(g.id);if(fresh.revision!==run.recordRevision||fresh.sourceRevision!==run.sourceRevision)throw new RecordError(ERR.REC_STALE,'Record/source changed after this reconstruction run. Run reconstruction again.');await DB.mutateGame(g.id,{eventType:'RECONSTRUCTION_PATH_APPLIED',payload:{runId:run.id,pathIndex:i},actor:'RECONSTRUCTION'},gg=>applyReconstructionPath(gg,path));run.selectedPath=i;run.updatedAt=new Date().toISOString();await DB.putReconstruction(run);toast('Reconstruction path applied. Review before certification.','good');render();}catch(e){report(e);}},i===0?'primary':'ghost'));wrap.append(line);}return wrap;}
function observationCard(g,env,cell,page,derived){const expectedPly=g.moves.length+1,expectedNumber=Math.floor((expectedPly+1)/2),expectedSide=expectedPly%2===1?'white':'black',coordinateMatches=cell.moveNumber===expectedNumber&&cell.side===expectedSide;const cardEl=h('div',{class:'observation-card'},h('div',{class:'row between'},h('strong',{text:`Move ${cell.moveNumber}${cell.side==='white'?'.':'...'}`}),h('span',{class:'badge',text:'OBSERVATION'})),h('div',{class:'crop-slot',dataset:{cropEnv:env.requestId,cropCell:cell.id}}),h('div',{class:'obs-primary',text:cell.observations[0]?.text||'—'}),h('div',{class:'chips'},...cell.observations.slice(1).map(o=>h('span',{class:'chip',text:o.text}))),h('div',{class:'meta',text:`Source page ${(page?.order??0)+1} · run ${env.runSequence} · ranks only; provider scores are not historical probabilities.`}),coordinateMatches?null:h('div',{class:'notice warn',text:`This cell is not the next ply (${expectedNumber}${expectedSide==='white'?'.':'...'}). Use reconstruction or navigate/edit the game; RECORD will not attach it to the wrong ply.`}));const actions=h('div',{class:'row wrap'});if(coordinateMatches)for(const obs of cell.observations.slice(0,4))actions.append(btn(`USE ${obs.text}`,async()=>{try{await DB.mutateGame(g.id,{eventType:'OBSERVATION_ACCEPTED',payload:{requestId:env.requestId,cellId:cell.id,text:obs.text}},gg=>{const ply=gg.moves.length+1,n=Math.floor((ply+1)/2),side=ply%2===1?'white':'black';if(cell.moveNumber!==n||cell.side!==side)throw new RecordError(ERR.CERT_OBSERVATION,'Observation cell no longer matches the next ply.');appendMove(gg,obs.text,'SHEET_DIRECT',{sourceRefs:[env.pageId],observationRefs:[`${env.requestId}:${cell.id}`]});});toast('Observation accepted as next legal move.','good');render();}catch(e){report(e);}},obs.rank===1?'primary':''));actions.append(btn('MARK UNREADABLE',async()=>{await DB.mutateGame(g.id,{eventType:'OBSERVATION_MARKED_UNREADABLE',payload:{requestId:env.requestId,cellId:cell.id},evidenceBearing:true},gg=>{gg.flags.needsReview=true;gg.workflowState='READY_FOR_REVIEW';});render();},'ghost'));cardEl.append(actions);cardEl.dataset.derivedId=derived?.id||'';cardEl._crop={blob:derived?.blob,crop:cell.crop};return cardEl;}
function metadataObservationCard(g,env,mo){const allowed=new Set(['event','site','date','round','board','section','white','black']);const c=h('div',{class:'observation-card'},h('div',{class:'row between'},h('strong',{text:`Metadata · ${mo.field}`}),h('span',{class:'badge',text:'OBSERVATION'})),h('div',{class:'obs-primary',text:mo.text}));if(allowed.has(mo.field))c.append(btn('USE OBSERVATION',async()=>{await DB.mutateGame(g.id,{eventType:'METADATA_OBSERVATION_ACCEPTED',payload:{field:mo.field,requestId:env.requestId}},gg=>{gg.metadata[mo.field]=mo.text;});render();},'primary'));return c;}
async function hydrateCrops(){for(const el of document.querySelectorAll('.observation-card')){if(!el._crop?.blob)continue;const slot=el.querySelector('.crop-slot');try{const url=await cropDataUrl(el._crop.blob,el._crop.crop);slot.append(h('img',{src:url,alt:'Handwritten source crop'}));}catch{slot.textContent='Crop unavailable';}}}
async function cropDataUrl(blob,crop){const bm=await createImageBitmap(blob);const x=Math.round(crop.x*bm.width),y=Math.round(crop.y*bm.height),w=Math.max(1,Math.round(crop.w*bm.width)),hh=Math.max(1,Math.round(crop.h*bm.height));const scale=Math.min(3,800/w),c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(hh*scale));c.getContext('2d').drawImage(bm,x,y,w,hh,0,0,c.width,c.height);bm.close();return c.toDataURL('image/jpeg',.9);}

async function certifyCurrent(g){
  try{
    const fresh=await DB.getGame(g.id),pages=await DB.pages(g.id),observations=await DB.currentObservations(g.id),gate=await canCertify(fresh,pages,observations);
    if(!gate.ok)throw gate.error;
    const check=h('input',{type:'checkbox'}),body=stack(
      h('div',{class:'notice',text:`You are about to certify ${fresh.moves.length} plies against ${pages.length} preserved source page(s).`}),
      h('p',{class:'note',text:'This is a historical assertion, not an engine verdict. Any later evidence-bearing edit will invalidate it.'}),
      h('label',{class:'cert-check'},check,h('span',{text:'I have compared the digital move record with the preserved source and certify that it reflects the game actually played to the best of my knowledge.'}))
    );
    showDialog({title:'Certify historical record',body,actions:[{label:'CERTIFY',kind:'primary',onClick:async close=>{
      if(!check.checked){toast('Certification requires the explicit review assertion.','warn');return;}
      try{
        const latest=await DB.getGame(g.id),latestPages=await DB.pages(g.id),latestObs=await DB.currentObservations(g.id),cert=await buildCertification(latest,latestPages,latestObs);
        await DB.commitCertification(latest.id,{expectedRevision:latest.revision,expectedSourceRevision:latest.sourceRevision,certification:cert});
        close();toast('Record certified.','good');render();
      }catch(e){report(e);}
    }}]});
  }catch(e){report(e);}
}

async function exportCapsule(g,pages){
  try{
    const fresh=await DB.getGame(g.id),freshPages=await DB.pages(g.id),observations=await DB.currentObservations(g.id),auditEvents=await DB.audit(g.id),reconstructionRuns=await DB.reconstructions(g.id);
    const status=await verifyCertification(fresh,freshPages,observations);if(status.status!=='VALID')throw new RecordError(ERR.EXP_CAPSULE,'Capsule export requires a currently valid certification.');
    let derived=[];for(const p of freshPages)derived.push(...await DB.derivedForPage(g.id,p.id));
    const capsule=await buildCapsule({game:fresh,pages:freshPages,derivedAssets:derived,observations,auditEvents,reconstructionRuns,trustContext:currentGatewayTrustContext(observations)});
    const blob=new Blob([capsule.bytes],{type:'application/zip'}),name=`${safeFile(gameTitle(fresh))}.record.zip`;
    const delivered=await shareOrSaveFile(blob,name,`RECORD Capsule · ${gameTitle(fresh)}`);
    if(!delivered){toast('Capsule export cancelled.','warn');return;}
    await DB.mutateGame(g.id,{eventType:'CAPSULE_EXPORTED',payload:{capsuleInstanceId:capsule.manifest.capsuleInstanceId},evidenceBearing:false},gg=>{gg.workflowState='EXPORTED';});
    toast('Capsule export initiated.','good');
  }catch(e){report(e);}
}
function verifyCapsuleFile(){const input=h('input',{type:'file',accept:'.zip,application/zip'});input.addEventListener('change',async()=>{try{const b=new Uint8Array(await input.files[0].arrayBuffer());const structural=await verifyCapsule(b);const signed=structural.observations?.filter(o=>o.signature)||[];let v=structural;if(signed.length){if(!runtime.gatewayPublicJwk)throw new RecordError(ERR.CAPSULE_INVALID,'Capsule contains signed recognition observations but this RECORD installation has no trusted gateway verification key configured.');const keys={};for(const o of signed){if(!o.gateway?.keyId)throw new RecordError(ERR.CAPSULE_INVALID,'Signed recognition observation has no gateway key ID.');keys[o.gateway.keyId]=runtime.gatewayPublicJwk;}v=await verifyCapsule(b,{trustContext:{gatewayKeys:keys},requireTrustedObservations:true});}toast(`Capsule verified: ${v.manifest.canonicalRecordHash.slice(0,16)}…`,'good');}catch(e){report(e);}});input.click();}


async function renderLibrary(){
  const games=await DB.listGames(),estimate=await estimateBackup(),search=h('input',{type:'search',placeholder:'Search player, event, date…','aria-label':'Search local records'}),listBody=h('div',{class:'stack'});
  const rows=[];
  for(const g of games){
    const wrap=h('div',{class:'library-row'},await gameItem(g));
    wrap.dataset.search=[gameTitle(g),g.metadata.event,g.metadata.site,g.metadata.date,g.metadata.round].join(' ').toLowerCase();
    wrap.append(btn('DELETE',async()=>{if(await confirmSheet('Delete local record',`Delete ${gameTitle(g)} and all local source/derived/recognition material? Exported files are unaffected.`,'DELETE',true)){await DB.deleteGame(g.id);render();}},'danger'));
    rows.push(wrap);listBody.append(wrap);
  }
  search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();let visible=0;for(const r of rows){const on=!q||r.dataset.search.includes(q);r.hidden=!on;if(on)visible++;}search.setAttribute('aria-description',`${visible} matching records`);});
  const list=card(h('div',{class:'row between'},h('h2',{text:'Local records'}),h('span',{class:'badge',text:String(games.length)})),games.length?stack(search,listBody):h('div',{class:'empty',text:'No records.'}));
  const backups=card(h('h3',{text:'Recovery'}),h('p',{class:'note',text:`Estimated binary backup payload: ${fmtBytes(estimate.sourceBytes)} across ${estimate.games} game(s). On iPhone, RECORD prefers the native share sheet so the backup can be saved directly to Files.`}),stack(btn('EXPORT VERIFIED BACKUP',exportBackup,'primary'),btn('RESTORE BACKUP',restoreBackupUi),btn('VERIFY CAPSULE FILE',verifyCapsuleFile)));
  mainShell('library',list,backups);
}

async function exportBackup(){
  try{
    const storage=await navigator.storage?.estimate?.(),est=await estimateBackup();
    if(storage?.quota&&storage?.usage&&storage.quota-storage.usage<est.sourceBytes*1.5)throw new RecordError(ERR.DB_QUOTA,'Available browser storage may be insufficient to stage this backup.');
    toast('Building verified backup…');
    const b=await buildBackup(),blob=new Blob([b.bytes],{type:'application/zip'}),name=`RECORD-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.zip`;
    const delivered=await shareOrSaveFile(blob,name,'RECORD verified backup');
    if(!delivered){toast('Backup export cancelled.','warn');return;}
    await DB.setSetting('lastBackupAt',new Date().toISOString());toast('Backup export initiated.','good');render();
  }catch(e){report(e);}
}
function restoreBackupUi(){const input=h('input',{type:'file',accept:'.zip,application/zip'});input.addEventListener('change',async()=>{try{const bytes=new Uint8Array(await input.files[0].arrayBuffer()),parsed=await parseBackup(bytes),select=h('select',{});for(const x of [['KEEP_LOCAL','Keep existing local records'],['REPLACE_LOCAL','Replace same-ID records'],['IMPORT_AS_COPY','Import all backup records as new copies (certification invalidated)'],['SKIP','Skip conflicts']])select.append(h('option',{value:x[0]},x[1]));showDialog({title:'Restore verified backup',body:stack(h('div',{class:'notice',text:`Backup ${parsed.manifest.backupId} · ${parsed.snapshot.games.length} game(s)`}),h('label',{},'Conflict policy',select)),actions:[{label:'RESTORE',kind:'primary',onClick:async c=>{try{await restoreBackup(bytes,{conflict:select.value});c();toast('Backup restored.','good');render();}catch(e){report(e);}}}]});}catch(e){report(e);}});input.click();}


async function renderSystem(){
  const games=await DB.listGames(),jobs=await DB.jobs(),storage=await navigator.storage?.estimate?.()||{},persisted=await navigator.storage?.persisted?.(),settings=await getGatewaySettings(),device=await ensureDeviceIdentity(),lastBackup=await DB.getSetting('lastBackupAt','Never'),sw=await navigator.serviceWorker?.getRegistration?.();
  let source=0,derived=0,obs=0;for(const g of games){const pages=await DB.pages(g.id);source+=pages.reduce((n,p)=>n+p.size,0);for(const p of pages)derived+=(await DB.derivedForPage(g.id,p.id)).reduce((n,a)=>n+(a.size||a.blob?.size||0),0);obs+=(await DB.observations(g.id)).length;}
  const pct=storage.quota?Math.round((storage.usage||0)/storage.quota*100):0,backup=backupHealth(games,lastBackup);
  const status=card(h('h2',{text:'System'}),systemGrid([
    ['Application',`${APP.version} · ${APP.release}`],['Database',`v${APP.dbVersion}`],['Origin',location.origin],
    ['Origin isolation',isLikelySharedGithubPagesOrigin(location)?'SHARED GITHUB PAGES ORIGIN — remote recognition blocked':'Dedicated/non-GitHub origin'],
    ['Standalone',matchMedia('(display-mode: standalone)').matches?'YES':'NO'],['Persistent storage',persisted?'GRANTED':'NOT GRANTED'],
    ['Storage',`${fmtBytes(storage.usage||0)} / ${fmtBytes(storage.quota||0)} · ${pct}%`],['Source bytes',fmtBytes(source)],['Derived bytes',fmtBytes(derived)],
    ['Recognition observations',String(obs)],['Pending jobs',String(jobs.filter(j=>!['COMPLETE','CANCELLED','FAILED_TERMINAL'].includes(j.status)).length)],
    ['Last backup',`${formatRelative(lastBackup)} · ${backup.due} record(s) changed since`],['Gateway',settings.gatewayEnabled?settings.gatewayUrl||'Enabled / URL missing':'DISABLED'],
    ['Recognition profile',(settings.providerProfile||'fixture').toUpperCase()],['Runtime config',runtime.runtimeCacheState||'UNKNOWN'],
    ['Device auth',device.registered?`REGISTERED · ${device.deviceId}`:`LOCAL KEY READY · unregistered`],['Service worker',sw?.active?.scriptURL||'Not active'],['Path',currentPath()]
  ]));
  const storageNotice=pct>=85?h('div',{class:'notice danger',text:'Browser storage is above 85%. Export a verified backup and remove expendable local records before capturing more evidence.'}):pct>=70?h('div',{class:'notice warn',text:'Browser storage is above 70%. Keep a current external backup.'}):null;
  const gateway=card(h('h3',{text:'Recognition gateway'}),
    (settings.providerProfile||'fixture')==='fixture'?h('div',{class:'notice warn',text:'FIXTURE mode is test-only and is cryptographically/source-hash fenced to the bundled fixture page. It cannot recognize a real scoresheet.'}):null,
    h('p',{class:'note',text:'Remote recognition is deliberately blocked on username.github.io project paths. Provider/API secrets never belong in this public frontend repository.'}),
    btn('CONFIGURE / REGISTER DEVICE',()=>gatewayDialog(settings,device),'primary'));
  const operations=card(h('h3',{text:'Operations'}),storageNotice,stack(
    btn('REQUEST PERSISTENT STORAGE',async()=>{const ok=await navigator.storage?.persist?.();toast(ok?'Persistent storage granted.':'Persistent storage was not granted.',ok?'good':'warn');render();}),
    btn('EXPORT VERIFIED BACKUP',exportBackup,'primary'),
    btn('EXPORT DIAGNOSTICS',exportDiagnostics),
    updateWaiting?btn('APPLY WAITING UPDATE',()=>{updateWaiting.postMessage({type:'SKIP_WAITING'});},'primary'):null
  ));
  mainShell('system',status,gateway,operations);
}
function systemGrid(rows){const g=h('dl',{class:'system-grid'});for(const [k,v] of rows)g.append(h('dt',{text:k}),h('dd',{text:v}));return g;}
function gatewayDialog(settings,device){const profile=h('select',{});for(const p of ['fixture','remote'])profile.append(h('option',{value:p,selected:(settings.providerProfile||'fixture')===p},p.toUpperCase()));const secret=h('input',{type:'password',autocomplete:'off',placeholder:'One-time bootstrap secret'}),configured=!!(settings.gatewayEnabled&&settings.dedicatedOrigin&&settings.gatewayUrl&&settings.requiredOrigin&&settings.gatewayPublicJwk),body=stack(h('div',{class:configured?'notice':'notice warn',text:configured?`Build-time gateway: ${settings.gatewayUrl} · required origin ${settings.requiredOrigin}`:'Remote recognition is not enabled in config/runtime.json for this build. Configure a dedicated custom origin and gateway at build time; local settings cannot widen the CSP network allowlist.'}),h('label',{},'Provider profile',profile),h('label',{},'Bootstrap secret (registration only; never persisted)',secret),h('div',{class:'note',text:`Device ${device.deviceId} · ${device.registered?'registered':'not registered'}`}));showDialog({title:'Gateway configuration',body,actions:[{label:'SAVE PROVIDER PROFILE',onClick:async c=>{await DB.setSetting('gatewayPreferences',{providerProfile:profile.value});c();toast('Provider preference saved locally.');render();}},{label:'REGISTER DEVICE',kind:'primary',onClick:async c=>{try{if(!configured||!remoteRecognitionOriginAllowed(settings))throw new RecordError(ERR.VIS_ORIGIN,'This build is not running on its configured dedicated HTTPS origin.');const res=await registerDevice(settings.gatewayUrl,secret.value);if(settings.gatewayPublicJwk&&stableStringify(settings.gatewayPublicJwk)!==stableStringify(res.gatewayPublicJwk))throw new RecordError(ERR.VIS_AUTH,'Gateway registration returned a verification key that does not match the build-time pinned public key.');secret.value='';c();toast('Device registered. Bootstrap secret was not persisted.','good');render();}catch(e){secret.value='';report(e);}}}]});}

async function exportDiagnostics(){
  const storage=await navigator.storage?.estimate?.()||{},settings=await getGatewaySettings(),jobs=await DB.jobs();
  const diag={schema:'record-diagnostics/1',createdAt:new Date().toISOString(),app:{version:APP.version,dbVersion:APP.dbVersion,origin:location.origin,standalone:matchMedia('(display-mode: standalone)').matches,online:navigator.onLine,userAgent:navigator.userAgent},storage:{usage:storage.usage||null,quota:storage.quota||null,persisted:await navigator.storage?.persisted?.()},gateway:{enabled:!!settings.gatewayEnabled,profile:settings.providerProfile||'fixture',url:(()=>{try{return settings.gatewayUrl?new URL(settings.gatewayUrl).origin:null}catch{return null}})(),requiredOrigin:settings.requiredOrigin||null},jobs:jobs.map(j=>({id:j.id,status:j.status,attempt:j.attempt,lastError:j.lastError,updatedAt:j.updatedAt,sourceSha256:j.sourceSha256,derivedSha256:j.derivedSha256}))};
  const blob=new Blob([JSON.stringify(diag,null,2)],{type:'application/json'}),name=`RECORD-diagnostics-${Date.now()}.json`;
  const delivered=await shareOrSaveFile(blob,name,'RECORD diagnostics');toast(delivered?'Diagnostics export initiated.':'Diagnostics export cancelled.',delivered?'good':'warn');
}

function downloadBlob(blob,name){
  const url=urls.create(blob),a=h('a',{href:url,download:name});
  document.body.append(a);a.click();a.remove();setTimeout(()=>urls.revoke(url),15000);
}
async function registerServiceWorker(){if(!('serviceWorker'in navigator))return;try{const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'});if(reg.waiting)updateWaiting=reg.waiting;reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){updateWaiting=worker;toast('RECORD update ready. Apply it from SYSTEM.');}})});navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload());}catch(e){console.warn('Service worker unavailable',e);}}
async function boot(){await loadRuntime();await DB.init();DB.onState(e=>{if(e.type==='versionchange')toast('Database version changed in another tab. Reload RECORD.','warn');if(e.type==='blocked')toast('Database upgrade blocked by another RECORD tab.','danger');});if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});await registerServiceWorker();document.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='visible'){const resolver=async job=>providerFor(job.providerProfile);await processEligibleJobs(resolver);render();}});window.addEventListener('online',()=>{toast('Online. Pending recognition can resume.','good');processEligibleJobs(async j=>providerFor(j.providerProfile));render();});window.addEventListener('offline',()=>render());await render();}
boot().catch(e=>{report(e);mainShell('',card(h('h2',{text:'RECORD failed to initialize.'}),h('p',{class:'notice danger',text:`${e.code||'REC-BOOT'}: ${e.message}`})));});
