import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const SOURCE_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const REPO_ROOT=String.raw`C:\Users\ux5t9\Documents\CAPTUREDMIRAGE\CAPTUREDMIRAGE-RECORD_app\RECORD-0.3.0`;
const FULL_REPO='M-Bissonette-Hennix/capturedmirage-record';
const REMOTE_URL='https://github.com/M-Bissonette-Hennix/capturedmirage-record.git';
const EXPECTED_BASE='bb9bd2a842f0aa416ebe2a7982b9117b1fe34b0a';
const TARGET_VERSION='0.3.2';
const WORKFLOW_NAME='RECORD QA + Pages';

function out(s=''){process.stdout.write(`${s}\n`);}
function heading(s){out();out('============================================================');out(s);out('============================================================');}
function die(message,details=''){
  heading('STOP');
  out(message);
  if(details)out(details);
  process.exit(1);
}
function executable(file){
  if(process.platform!=='win32')return file;
  if(file==='gh')return 'gh.exe';
  if(file==='git')return 'git.exe';
  if(file==='cmd')return 'cmd.exe';
  return file;
}
function run(file,args,{capture=false,allowFailure=false,cwd=REPO_ROOT}={}){
  const command=executable(file);
  const r=spawnSync(command,args,{
    cwd,
    encoding:'utf8',
    shell:false,
    windowsHide:false,
    stdio:capture?['ignore','pipe','pipe']:'inherit'
  });
  if(r.error)die(`Could not execute ${command}.`,String(r.error));
  if(r.status!==0&&!allowFailure){
    die(`Command failed with exit code ${r.status}: ${file} ${args.join(' ')}`,
        capture?`${r.stdout||''}${r.stderr||''}`:'');
  }
  return {
    code:r.status??1,
    stdout:String(r.stdout||'').trim(),
    stderr:String(r.stderr||'').trim()
  };
}
async function exists(p){try{await fs.stat(p);return true;}catch{return false;}}
async function hashFile(p){
  return crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex');
}
async function walkFiles(dir,{ignore=new Set()}={}){
  const rows=[];
  async function walk(d){
    for(const ent of await fs.readdir(d,{withFileTypes:true})){
      if(ignore.has(ent.name))continue;
      const p=path.join(d,ent.name);
      if(ent.isDirectory())await walk(p);
      else rows.push(p);
    }
  }
  await walk(dir);
  return rows;
}
function relUnix(base,p){return path.relative(base,p).split(path.sep).join('/');}
async function verifyReleaseTree(){
  heading('VERIFYING EXTRACTED RECORD 0.3.2 RELEASE');
  const pkg=JSON.parse(await fs.readFile(path.join(SOURCE_ROOT,'package.json'),'utf8'));
  if(pkg.version!==TARGET_VERSION)die(`Expected package version ${TARGET_VERSION}; found ${pkg.version}.`);

  const manifestPath=path.join(SOURCE_ROOT,'RELEASE_MANIFEST.json');
  const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
  if(manifest.schema!=='record-release-manifest/3')die('Unsupported release manifest schema.');
  if(!String(manifest.release||'').includes(`RECORD ${TARGET_VERSION}`))die('Release manifest does not identify RECORD 0.3.2.');

  const expected=new Map();
  for(const row of manifest.files||[]){
    if(expected.has(row.path))die(`Duplicate release-manifest path: ${row.path}`);
    expected.set(row.path,row);
  }

  const files=await walkFiles(SOURCE_ROOT,{ignore:new Set(['.git','node_modules'])});
  const actual=files.map(p=>relUnix(SOURCE_ROOT,p)).filter(x=>x!=='RELEASE_MANIFEST.json').sort();
  const expectedNames=[...expected.keys()].sort();

  if(JSON.stringify(actual)!==JSON.stringify(expectedNames)){
    const missing=expectedNames.filter(x=>!actual.includes(x));
    const extra=actual.filter(x=>!expected.has(x));
    die('Extracted release file set does not match RELEASE_MANIFEST.json.',
        `Missing: ${missing.join(', ')||'(none)'}\nExtra: ${extra.join(', ')||'(none)'}`);
  }

  for(const rel of actual){
    const p=path.join(SOURCE_ROOT,...rel.split('/'));
    const st=await fs.stat(p);
    const row=expected.get(rel);
    if(st.size!==row.size)die(`Release size mismatch: ${rel}`);
    const sha=await hashFile(p);
    if(sha!==row.sha256)die(`Release SHA-256 mismatch: ${rel}`);
  }

  out(`[PASS] ${actual.length}/${expected.size} release descriptors verified.`);
  out(`[PASS] RECORD ${TARGET_VERSION} extracted source is internally exact.`);
}

async function copyReleaseIntoRepo(){
  heading('REPLACING WORKING TREE WITH VERIFIED RECORD 0.3.2 SOURCE');
  for(const ent of await fs.readdir(REPO_ROOT,{withFileTypes:true})){
    if(ent.name==='.git')continue;
    await fs.rm(path.join(REPO_ROOT,ent.name),{recursive:true,force:true});
  }

  await fs.cp(SOURCE_ROOT,REPO_ROOT,{
    recursive:true,
    filter(src){
      const name=path.basename(src);
      return name!=='.git'&&name!=='node_modules';
    }
  });

  out('[PASS] Working tree replaced; .git history preserved.');
}

async function ghApi(endpoint,{method='GET',fields=[]}={}){
  const args=['api'];
  if(method!=='GET')args.push('--method',method);
  args.push(endpoint);
  for(const [k,v] of fields)args.push('-f',`${k}=${v}`);
  const r=run('gh',args,{capture:true});
  try{return JSON.parse(r.stdout||'null');}
  catch(e){die(`GitHub API returned invalid JSON for ${endpoint}.`,`${e}\n${r.stdout}`);}
}

async function fetchWithTimeout(url,timeoutMs=20000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    return await fetch(url,{cache:'no-store',redirect:'follow',signal:controller.signal});
  }finally{clearTimeout(timer);}
}

async function waitForWorkflow(commit){
  heading('WAITING FOR EXACT GITHUB ACTIONS RUN');
  let found=null;
  for(let attempt=1;attempt<=60;attempt++){
    const data=await ghApi(`repos/${FULL_REPO}/actions/runs?branch=main&event=push&per_page=50`);
    found=(data.workflow_runs||[]).find(r=>r.head_sha===commit&&r.name===WORKFLOW_NAME);
    if(found)break;
    if(attempt%5===0)out(`Still waiting for workflow registration (${attempt*3}s)...`);
    await new Promise(r=>setTimeout(r,3000));
  }
  if(!found)die(`No "${WORKFLOW_NAME}" workflow run appeared for commit ${commit}.`);

  const runId=String(found.id);
  const runUrl=found.html_url||`https://github.com/${FULL_REPO}/actions/runs/${runId}`;
  out(`[PASS] Exact workflow run found: ${runId}`);
  out(`       ${runUrl}`);

  let last='';
  while(true){
    const state=await ghApi(`repos/${FULL_REPO}/actions/runs/${runId}`);
    const line=`${state.status}${state.conclusion?` / ${state.conclusion}`:''}`;
    if(line!==last){out(`Actions: ${line}`);last=line;}
    if(state.status==='completed'){
      if(state.conclusion!=='success'){
        out();
        out('GitHub-hosted QA did not pass. Failed-step log follows.');
        run('gh',['run','view',runId,'--repo',FULL_REPO,'--log-failed'],{allowFailure:true});
        die('Hosted QA failure is a real commissioning finding. Do not bypass Pages gating.',runUrl);
      }
      return {runId,runUrl};
    }
    await new Promise(r=>setTimeout(r,5000));
  }
}

async function main(){
  await verifyReleaseTree();

  if(process.argv.includes('--verify-package-only')){
    heading('PACKAGE VERIFICATION COMPLETE');
    out('No repository or GitHub changes were attempted.');
    return;
  }

  heading('VERIFYING LOCAL/GITHUB PREDECESSOR STATE');
  if(!await exists(REPO_ROOT))die(`Local Git repository is missing: ${REPO_ROOT}`);
  if(!await exists(path.join(REPO_ROOT,'.git')))die(`.git is missing from ${REPO_ROOT}.`);

  run('gh',['auth','status','--hostname','github.com']);
  run('gh',['auth','setup-git','--hostname','github.com']);

  const origin=run('git',['remote','get-url','origin'],{capture:true}).stdout;
  if(origin!==REMOTE_URL)die(`Unexpected origin.\nExpected: ${REMOTE_URL}\nActual:   ${origin}`);

  const status=run('git',['status','--porcelain'],{capture:true}).stdout;
  if(status)die('Local repository has uncommitted changes before upgrade.',status);

  const localBase=run('git',['rev-parse','HEAD'],{capture:true}).stdout;
  const remoteLine=run('git',['ls-remote','origin','refs/heads/main'],{capture:true}).stdout;
  const remoteBase=(remoteLine.split(/\s+/)[0]||'').trim();

  if(localBase!==EXPECTED_BASE||remoteBase!==EXPECTED_BASE){
    die('Predecessor commit mismatch. This commissioner will not guess or overwrite history.',
        `Expected: ${EXPECTED_BASE}\nLocal:    ${localBase}\nRemote:   ${remoteBase}`);
  }

  out(`[PASS] Local and GitHub main are exact RECORD 0.3.1 predecessor ${EXPECTED_BASE}.`);

  await copyReleaseIntoRepo();

  heading('LOCAL RECORD 0.3.2 QA');
  // Invoke Node entry points directly. This intentionally avoids Windows
  // .cmd/shell parsing entirely; GitHub CI independently exercises npm scripts.
  run('node',['scripts/syntax-check.mjs']);
  run('node',['scripts/schema-selftest.mjs']);
  run('node',['scripts/static-qa.mjs']);
  run('node',['--test','tests/backup.test.mjs','tests/capsule.test.mjs','tests/chess.test.mjs','tests/gateway.test.mjs','tests/image.test.mjs','tests/migration.test.mjs','tests/recognition.test.mjs','tests/reconstruction.test.mjs','tests/record.test.mjs','tests/static.test.mjs','tests/zip.test.mjs']);
  run('node',['scripts/build.mjs']);
  run('node',['scripts/dist-qa.mjs']);
  run('node',['scripts/verify-release.mjs']);
  run('git',['diff','--check']);
  out('[PASS] Complete local deterministic/build/distribution gates.');

  heading('COMMITTING AND PUSHING RECORD 0.3.2');
  run('git',['add','--all']);
  const staged=run('git',['diff','--cached','--name-only'],{capture:true}).stdout;
  if(!staged)die('No RECORD 0.3.2 changes are staged.');
  out('Staged paths:');
  out(staged);

  run('git',['commit','-m','RECORD 0.3.2 - BROWSER PORTABILITY']);
  const commit=run('git',['rev-parse','HEAD'],{capture:true}).stdout;
  out(`[PASS] Local 0.3.2 commit: ${commit}`);

  run('git',['push','origin','main']);
  const remoteAfterLine=run('git',['ls-remote','origin','refs/heads/main'],{capture:true}).stdout;
  const remoteAfter=(remoteAfterLine.split(/\s+/)[0]||'').trim();
  if(remoteAfter!==commit)die('GitHub main did not converge to local 0.3.2 commit.',
      `Local: ${commit}\nRemote: ${remoteAfter}`);
  out('[PASS] GitHub main exactly matches local 0.3.2 commit.');

  heading('VERIFYING GITHUB PAGES CONFIGURATION');
  let pages=await ghApi(`repos/${FULL_REPO}/pages`);
  if(pages?.build_type!=='workflow'){
    await ghApi(`repos/${FULL_REPO}/pages`,{method:'PUT',fields:[['build_type','workflow']]});
    pages=await ghApi(`repos/${FULL_REPO}/pages`);
  }
  if(pages?.build_type!=='workflow')die(`Pages build_type is ${pages?.build_type??'(missing)'}, not workflow.`);
  out('[PASS] GitHub Pages uses workflow deployment.');

  const {runUrl}=await waitForWorkflow(commit);
  out('[PASS] GitHub-hosted workflow completed successfully.');

  heading('VERIFYING PUBLIC GITHUB PAGES RUNTIME');
  pages=await ghApi(`repos/${FULL_REPO}/pages`);
  let pagesUrl=String(pages.html_url||'');
  if(!pagesUrl)die('GitHub Pages returned no html_url.');
  if(!pagesUrl.endsWith('/'))pagesUrl+='/';
  out(`Pages URL: ${pagesUrl}`);

  let rootResponse=null;
  for(let attempt=1;attempt<=60;attempt++){
    try{
      const r=await fetchWithTimeout(pagesUrl,15000);
      const text=await r.text();
      if(r.ok&&/RECORD/i.test(text)){rootResponse={r,text};break;}
    }catch{}
    if(attempt%6===0)out(`Still waiting for public edge propagation (${attempt*5}s)...`);
    await new Promise(r=>setTimeout(r,5000));
  }
  if(!rootResponse)die('Actions passed but the public Pages root did not become verifiably live within 5 minutes.',pagesUrl);
  out('[PASS] Public root is live and contains RECORD.');

  for(const rel of ['manifest.webmanifest','sw.js','src/config.js','config/runtime.json','assets/icons/apple-touch-icon.png']){
    const url=new URL(rel,pagesUrl).href;
    const r=await fetchWithTimeout(url);
    if(!r.ok)die(`Required public runtime asset returned HTTP ${r.status}: ${url}`);
    out(`[PASS] HTTP ${r.status} ${rel}`);
  }

  const cfgResponse=await fetchWithTimeout(new URL('src/config.js',pagesUrl).href);
  const cfgText=await cfgResponse.text();
  if(!/version:\s*'0\.3\.2'/.test(cfgText))die('Public src/config.js does not identify RECORD 0.3.2.');
  out('[PASS] Public runtime identifies RECORD 0.3.2.');

  const runtimeResponse=await fetchWithTimeout(new URL('config/runtime.json',pagesUrl).href);
  const runtime=await runtimeResponse.json();
  if(runtime.gatewayEnabled!==false)die('Unexpected commissioning state: gatewayEnabled is not false.');
  if(runtime.providerProfile!=='fixture')die(`Unexpected commissioning providerProfile: ${runtime.providerProfile}`);
  out('[PASS] Remote recognition disabled.');
  out('[PASS] Fixture recognition profile confirmed.');

  heading('RECORD 0.3.2 DEPLOYMENT COMPLETE');
  out(`Commit : ${commit}`);
  out(`Actions: ${runUrl}`);
  out(`Live   : ${pagesUrl}`);
  out();
  out('The GitHub Pages site is verified live.');
  out('Next gate: physical iPhone Safari/Home Screen commissioning.');
  out('Fixture RECOGNIZE output is not real handwriting recognition.');

  if(process.platform==='win32'){
    run('cmd.exe',['/c','start','',pagesUrl],{allowFailure:true});
  }
}

main().catch(error=>die(error?.stack||String(error)));
