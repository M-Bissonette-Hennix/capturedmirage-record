import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {START_FEN,parseFen,toFen,legalMoves,applyMove} from '../src/chess.js';

const bin=process.env.STOCKFISH_BIN;
if(!bin){console.error('Set STOCKFISH_BIN to a trusted Stockfish executable.');process.exit(2);}
let seed=0x5eed1234;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
let s=parseFen(START_FEN),positions=[];
for(let i=0;positions.length<230&&i<5000;i++){
  const ms=legalMoves(s);if(!ms.length){s=parseFen(START_FEN);continue;}
  s=applyMove(s,ms[Math.floor(rand()*ms.length)]);positions.push(toFen(s));if((i+1)%70===0)s=parseFen(START_FEN);
}
function localPerft(state,d){if(d===0)return 1;let n=0;for(const m of legalMoves(state))n+=localPerft(applyMove(state,m),d-1);return n;}
const child=spawn(bin,[],{stdio:['pipe','pipe','inherit']});const rl=readline.createInterface({input:child.stdout});let waiter=null;
rl.on('line',line=>{const m=line.match(/Nodes searched:\s*(\d+)/i);if(m&&waiter){const w=waiter;waiter=null;w(Number(m[1]));}});
const sfPerft=(fen,d)=>new Promise((resolve,reject)=>{if(waiter)return reject(new Error('Stockfish request overlap.'));const timer=setTimeout(()=>{waiter=null;reject(new Error('Stockfish timeout.'));},10000);waiter=n=>{clearTimeout(timer);resolve(n);};child.stdin.write(`position fen ${fen}\ngo perft ${d}\n`);});
try{
  for(let i=0;i<200;i++){const fen=positions[i],local=legalMoves(parseFen(fen)).length,sf=await sfPerft(fen,1);if(local!==sf)throw new Error(`Depth-1 mismatch at case ${i}: RECORD=${local} Stockfish=${sf} FEN=${fen}`);}
  for(let i=200;i<230;i++){const fen=positions[i],local=localPerft(parseFen(fen),2),sf=await sfPerft(fen,2);if(local!==sf)throw new Error(`Depth-2 mismatch at case ${i}: RECORD=${local} Stockfish=${sf} FEN=${fen}`);}
  console.log('Stockfish differential PASS · depth1 200/200 · depth2 30/30 · seed 0x5eed1234');
} finally {child.stdin.write('quit\n');}
