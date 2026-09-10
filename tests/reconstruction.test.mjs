import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createGame,applyReconstructionPath,validateRecordAllowUnresolved} from '../src/record.js';
import {reconstructGame} from '../src/reconstruction.js';
const base=JSON.parse(fs.readFileSync('fixtures/recognition/clean-fixture-001/envelope.json','utf8'));
function envFor(g){const e=structuredClone(base);e.gameId=g.id;e.pageId='fixture-page-0001';return e;}
test('legal beam reconstructs a legal sequence and never uses chess quality as evidence',async()=>{const g=createGame(),run=await reconstructGame({game:g,observations:[envFor(g)]});assert.ok(['COMPLETE','AMBIGUOUS'].includes(run.status));assert.ok(run.paths.length>0);assert.deepEqual(run.paths[0].moves.slice(0,4).map(m=>m.san),['e4','e5','Nf3','Nc6']);const copy=structuredClone(g);applyReconstructionPath(copy,run.paths[0]);validateRecordAllowUnresolved(copy);});
test('missing observed ply may only enter as explicit inferred bridge requiring review',async()=>{const g=createGame(),e=envFor(g);e.cells=e.cells.filter(c=>!(c.moveNumber===1&&c.side==='black'));const run=await reconstructGame({game:g,observations:[e],maxBridgePlies:1});assert.ok(run.paths.length);assert.equal(run.paths[0].requiresReview,true);assert.ok(run.paths[0].moves.some(m=>m.provenance==='INFERRED_BRIDGE'));});
test('no evidence-compatible legal continuation fails closed',async()=>{const g=createGame(),e=envFor(g);e.cells[0].observations=[{text:'Qz99',rank:1}];const run=await reconstructGame({game:g,observations:[e],maxBridgePlies:0});assert.equal(run.status,'FAILED');});

test('manual prefix is preserved and reconstruction continues from the next observed ply',async()=>{
  const g=createGame();
  // Preserve a deterministic user-entered opening prefix.
  const {appendMove}=await import('../src/record.js');
  appendMove(g,'e4');
  appendMove(g,'e5');
  const env=envFor(g);
  env.cells=env.cells.filter(c=>((c.moveNumber-1)*2+(c.side==='black'?2:1))>=3);
  const run=await reconstructGame({game:g,observations:[env]});
  assert.ok(run.paths.length>0);
  assert.deepEqual(run.paths[0].moves.slice(0,4).map(m=>m.san),['e4','e5','Nf3','Nc6']);
  assert.equal(run.paths[0].moves[0].support,'PREFIX');
  assert.equal(run.paths[0].moves[1].support,'PREFIX');
  const copy=structuredClone(g);applyReconstructionPath(copy,run.paths[0]);validateRecordAllowUnresolved(copy);
});
