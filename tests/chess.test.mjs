import test from 'node:test';import assert from 'node:assert/strict';import {START_FEN,parseFen,validateFen,legalMoves,makeMove,replaySans,toFen,gameStatus,canonicalTimeControl,displayTimeControl,pgnFromGame} from '../src/chess.js';
test('start position legal/perft baseline',()=>{const s=parseFen(START_FEN);assert.equal(legalMoves(s).length,20);const walk=(x,d)=>d===0?1:legalMoves(x).reduce((n,m)=>n+walk(makeMove(x,{from:m.from,to:m.to,promotion:m.promotion}).state,d-1),0);assert.equal(walk(s,2),400);assert.equal(walk(s,3),8902);});
test('SAN replay, castling and en passant',()=>{assert.equal(replaySans(['e4','e5','Nf3','Nc6','Bc4','Nf6','O-O']).history.at(-1).san,'O-O');assert.equal(replaySans(['e4','a6','e5','d5','exd6']).history.at(-1).san,'exd6');});
test('promotion and checkmate',()=>{const r=makeMove(parseFen('7k/P7/8/8/8/8/8/7K w - - 0 1'),{from:8,to:0,promotion:'q'});assert.match(r.move.san,/a8=Q/);const m=replaySans(['f3','e5','g4','Qh4#']);assert.deepEqual(gameStatus(m.state).result,'0-1');});
test('strict FEN rejects malformed semantic states',()=>{assert.throws(()=>validateFen('8/8/8/8/8/8/8/8 w - - 0 1'),/king/i);assert.throws(()=>validateFen('4k3/8/8/8/8/8/8/4K3 x - - 0 1'),/active color/i);assert.throws(()=>validateFen('4k3/8/8/8/8/8/8/4K3 w K - 0 1'),/castling/i);assert.equal(toFen(parseFen(START_FEN)),START_FEN);});
test('draw substrate recognizes insufficient material',()=>{const s=parseFen('7k/8/8/8/8/8/8/K7 w - - 0 1');assert.equal(gameStatus(s).reason,'insufficient-material');});
test('time control normalizes human minutes+increment',()=>{assert.equal(canonicalTimeControl('90+30'),'5400+30');assert.equal(displayTimeControl('5400+30'),'90 min + 30 sec');});
test('PGN arbitrary start position emits SetUp/FEN and correct move numbering',()=>{const fen='4k3/8/8/8/8/8/4P3/4K3 b - - 0 17';const state=parseFen(fen),r=makeMove(state,'Kd7');const game={metadata:{event:'X',site:'?',date:'2026.09.09',round:'1',white:'A',black:'B',result:'*',timeControl:'',board:'',section:''},startFen:fen,moves:[{ply:1,san:r.move.san,uci:r.move.uci,beforeFen:r.move.before,afterFen:r.move.after,provenance:'USER_ENTERED',sourceRefs:[],observationRefs:[]}]};const p=pgnFromGame(game);assert.match(p,/\[SetUp "1"\]/);assert.match(p,/17\.\.\. Kd7/);});

import {repetitionKey} from '../src/chess.js';
test('repetition key ignores phantom en-passant target with no legal capture',()=>{
  const a='rnbqkbnr/ppp1pppp/8/3p4/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 2';
  const b='rnbqkbnr/ppp1pppp/8/3p4/8/8/PPPPPPPP/RNBQKBNR w KQkq d6 0 2';
  assert.equal(repetitionKey(a),repetitionKey(b));
});
test('repetition key preserves en-passant when a legal capture exists',()=>{
  const withEp='8/8/8/3pP3/8/8/4K3/7k w - d6 0 1';
  const withoutEp='8/8/8/3pP3/8/8/4K3/7k w - - 0 1';
  assert.notEqual(repetitionKey(withEp),repetitionKey(withoutEp));
});
