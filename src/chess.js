import {ERR, RecordError} from './errors.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FILES = 'abcdefgh';
const KNIGHT = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KING = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const BISHOP = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ROOK = [[-1,0],[1,0],[0,-1],[0,1]];
const QUEEN = [...BISHOP, ...ROOK];
const color = p => p === p.toUpperCase() ? 'w' : 'b';
const enemy = c => c === 'w' ? 'b' : 'w';
const rank = i => Math.floor(i / 8);
const file = i => i % 8;
const inBoard = (r, f) => r >= 0 && r < 8 && f >= 0 && f < 8;
const clone = s => ({board:[...s.board], turn:s.turn, castling:s.castling, enPassant:s.enPassant, halfmove:s.halfmove, fullmove:s.fullmove});

export function indexToSq(i) {
  if (!Number.isInteger(i) || i < 0 || i > 63) throw new Error('Square index out of range');
  return FILES[file(i)] + String(8 - rank(i));
}
export function sqToIndex(sq) {
  if (!/^[a-h][1-8]$/.test(String(sq))) throw new Error('Invalid square');
  return (8 - Number(sq[1])) * 8 + FILES.indexOf(sq[0]);
}

export function validateFen(fen, {strict = true} = {}) {
  if (typeof fen !== 'string' || fen.length > 128) throw new RecordError(ERR.FEN_INVALID, 'FEN must be a bounded string.');
  const parts = fen.trim().split(/\s+/);
  if (parts.length !== 6) throw new RecordError(ERR.FEN_INVALID, 'FEN must contain six fields.');
  const [placement, turn, castling, ep, half, full] = parts;
  const rows = placement.split('/');
  if (rows.length !== 8) throw new RecordError(ERR.FEN_INVALID, 'FEN must contain eight ranks.');
  let whiteKings = 0, blackKings = 0;
  for (const row of rows) {
    let count = 0;
    for (const ch of row) {
      if (/^[1-8]$/.test(ch)) count += Number(ch);
      else if (/^[prnbqkPRNBQK]$/.test(ch)) { count += 1; if (ch === 'K') whiteKings++; if (ch === 'k') blackKings++; }
      else throw new RecordError(ERR.FEN_INVALID, 'FEN contains an invalid piece symbol.');
    }
    if (count !== 8) throw new RecordError(ERR.FEN_INVALID, 'Each FEN rank must expand to eight squares.');
  }
  if (!['w','b'].includes(turn)) throw new RecordError(ERR.FEN_INVALID, 'FEN active color is invalid.');
  if (!(castling === '-' || /^(K?Q?k?q?)$/.test(castling))) throw new RecordError(ERR.FEN_INVALID, 'FEN castling rights are invalid.');
  if (!(ep === '-' || /^[a-h][36]$/.test(ep))) throw new RecordError(ERR.FEN_INVALID, 'FEN en-passant square is invalid.');
  if (!/^\d+$/.test(half) || Number(half) < 0) throw new RecordError(ERR.FEN_INVALID, 'FEN halfmove clock is invalid.');
  if (!/^\d+$/.test(full) || Number(full) < 1) throw new RecordError(ERR.FEN_INVALID, 'FEN fullmove number is invalid.');
  if (strict && (whiteKings !== 1 || blackKings !== 1)) throw new RecordError(ERR.FEN_INVALID, 'Strict FEN requires exactly one king per side.');
  const state = parseFenUnsafe(fen);
  if (strict) {
    const wk = state.board.indexOf('K'), bk = state.board.indexOf('k');
    if (wk >= 0 && bk >= 0 && Math.max(Math.abs(rank(wk)-rank(bk)), Math.abs(file(wk)-file(bk))) <= 1) throw new RecordError(ERR.FEN_INVALID, 'Kings may not be adjacent.');
    const pawnRanksInvalid = state.board.some((p, i) => p && p.toLowerCase() === 'p' && [0,7].includes(rank(i)));
    if (pawnRanksInvalid) throw new RecordError(ERR.FEN_INVALID, 'Strict FEN may not contain pawns on first/eighth rank.');
    const rights = state.castling;
    if (rights.includes('K') && !(state.board[60] === 'K' && state.board[63] === 'R')) throw new RecordError(ERR.FEN_INVALID, 'White kingside castling right is inconsistent with pieces.');
    if (rights.includes('Q') && !(state.board[60] === 'K' && state.board[56] === 'R')) throw new RecordError(ERR.FEN_INVALID, 'White queenside castling right is inconsistent with pieces.');
    if (rights.includes('k') && !(state.board[4] === 'k' && state.board[7] === 'r')) throw new RecordError(ERR.FEN_INVALID, 'Black kingside castling right is inconsistent with pieces.');
    if (rights.includes('q') && !(state.board[4] === 'k' && state.board[0] === 'r')) throw new RecordError(ERR.FEN_INVALID, 'Black queenside castling right is inconsistent with pieces.');
    const whitePieces=state.board.filter(p=>p&&color(p)==='w'),blackPieces=state.board.filter(p=>p&&color(p)==='b');
    if(whitePieces.length>16||blackPieces.length>16)throw new RecordError(ERR.FEN_INVALID,'Strict FEN cannot contain more than sixteen pieces for one side.');
    if(whitePieces.filter(p=>p==='P').length>8||blackPieces.filter(p=>p==='p').length>8)throw new RecordError(ERR.FEN_INVALID,'Strict FEN cannot contain more than eight pawns for one side.');
    if (inCheck(state, enemy(state.turn))) throw new RecordError(ERR.FEN_INVALID, 'Strict FEN has the side that just moved still in check.');
    if (state.enPassant !== null) {
      const epRank = rank(state.enPassant);
      if ((state.turn === 'w' && epRank !== 2) || (state.turn === 'b' && epRank !== 5)) throw new RecordError(ERR.FEN_INVALID, 'En-passant target rank is inconsistent with side to move.');
      if(state.board[state.enPassant])throw new RecordError(ERR.FEN_INVALID,'En-passant target square must be empty.');
      const pawnIndex=state.enPassant+(state.turn==='w'?8:-8),expected=state.turn==='w'?'p':'P';
      if(!inBoard(rank(pawnIndex),file(pawnIndex))||state.board[pawnIndex]!==expected)throw new RecordError(ERR.FEN_INVALID,'En-passant target is not backed by the pawn that just advanced two squares.');
    }
  }
  return true;
}

function parseFenUnsafe(fen) {
  const [placement, turn, castling, ep, half='0', full='1'] = fen.trim().split(/\s+/);
  const board = Array(64).fill(null); let i = 0;
  for (const ch of placement) {
    if (ch === '/') continue;
    if (/\d/.test(ch)) i += Number(ch); else board[i++] = ch;
  }
  return {board, turn, castling:castling === '-' ? '' : castling, enPassant:ep === '-' ? null : sqToIndex(ep), halfmove:Number(half), fullmove:Number(full)};
}

export function parseFen(fen = START_FEN, options = {}) {
  validateFen(fen, options);
  return parseFenUnsafe(fen);
}

export function toFen(s) {
  let p = '';
  for (let r = 0; r < 8; r++) {
    let n = 0;
    for (let f = 0; f < 8; f++) {
      const x = s.board[r*8+f];
      if (!x) n++; else { if (n) { p += n; n = 0; } p += x; }
    }
    if (n) p += n;
    if (r < 7) p += '/';
  }
  return `${p} ${s.turn} ${s.castling || '-'} ${s.enPassant == null ? '-' : indexToSq(s.enPassant)} ${s.halfmove} ${s.fullmove}`;
}

function findKing(s,c){ return s.board.indexOf(c === 'w' ? 'K' : 'k'); }
export function isSquareAttacked(s,idx,by){
  const tr=rank(idx), tf=file(idx);
  const pawn=by==='w'?'P':'p', pawnDir=by==='w'?1:-1;
  for(const df of [-1,1]){const r=tr+pawnDir,f=tf+df;if(inBoard(r,f)&&s.board[r*8+f]===pawn)return true;}
  const n=by==='w'?'N':'n'; for(const [dr,df] of KNIGHT){const r=tr+dr,f=tf+df;if(inBoard(r,f)&&s.board[r*8+f]===n)return true;}
  const k=by==='w'?'K':'k'; for(const [dr,df] of KING){const r=tr+dr,f=tf+df;if(inBoard(r,f)&&s.board[r*8+f]===k)return true;}
  for(const [dirs,pieces] of [[BISHOP,by==='w'?['B','Q']:['b','q']],[ROOK,by==='w'?['R','Q']:['r','q']]]){
    for(const [dr,df] of dirs){let r=tr+dr,f=tf+df;while(inBoard(r,f)){const p=s.board[r*8+f];if(p){if(pieces.includes(p))return true;break;}r+=dr;f+=df;}}
  }
  return false;
}
export function inCheck(s,c=s.turn){ const k=findKing(s,c); return k<0 || isSquareAttacked(s,k,enemy(c)); }
function pushMove(out,from,to,piece,extra={}){out.push({from,to,piece,...extra});}
function pseudoMoves(s){
  const out=[], c=s.turn;
  for(let i=0;i<64;i++){
    const p=s.board[i]; if(!p||color(p)!==c)continue; const t=p.toLowerCase(),r=rank(i),f=file(i);
    if(t==='p'){
      const dr=c==='w'?-1:1,start=c==='w'?6:1,promo=c==='w'?0:7,oneR=r+dr;
      if(inBoard(oneR,f)&&!s.board[oneR*8+f]){
        const to=oneR*8+f; if(oneR===promo){for(const pr of ['q','r','b','n'])pushMove(out,i,to,p,{promotion:pr});}else pushMove(out,i,to,p);
        const twoR=r+2*dr; if(r===start&&!s.board[twoR*8+f])pushMove(out,i,twoR*8+f,p,{doublePawn:true});
      }
      for(const df of [-1,1]){const rr=r+dr,ff=f+df;if(!inBoard(rr,ff))continue;const to=rr*8+ff,target=s.board[to];if(target&&color(target)!==c){if(rr===promo){for(const pr of ['q','r','b','n'])pushMove(out,i,to,p,{capture:target,promotion:pr});}else pushMove(out,i,to,p,{capture:target});}else if(s.enPassant===to)pushMove(out,i,to,p,{enPassant:true,capture:c==='w'?'p':'P'});}
    } else if(t==='n'){
      for(const [dr,df] of KNIGHT){const rr=r+dr,ff=f+df;if(!inBoard(rr,ff))continue;const to=rr*8+ff,q=s.board[to];if(!q||color(q)!==c)pushMove(out,i,to,p,q?{capture:q}:{});}
    } else if(t==='b'||t==='r'||t==='q'){
      const dirs=t==='b'?BISHOP:t==='r'?ROOK:QUEEN;for(const [dr,df] of dirs){let rr=r+dr,ff=f+df;while(inBoard(rr,ff)){const to=rr*8+ff,q=s.board[to];if(!q)pushMove(out,i,to,p);else{if(color(q)!==c)pushMove(out,i,to,p,{capture:q});break;}rr+=dr;ff+=df;}}
    } else if(t==='k'){
      for(const [dr,df] of KING){const rr=r+dr,ff=f+df;if(!inBoard(rr,ff))continue;const to=rr*8+ff,q=s.board[to];if(!q||color(q)!==c)pushMove(out,i,to,p,q?{capture:q}:{});}
      if(c==='w'&&i===60&&!inCheck(s,'w')){
        if(s.castling.includes('K')&&!s.board[61]&&!s.board[62]&&s.board[63]==='R'&&!isSquareAttacked(s,61,'b')&&!isSquareAttacked(s,62,'b'))pushMove(out,60,62,p,{castle:'K'});
        if(s.castling.includes('Q')&&!s.board[59]&&!s.board[58]&&!s.board[57]&&s.board[56]==='R'&&!isSquareAttacked(s,59,'b')&&!isSquareAttacked(s,58,'b'))pushMove(out,60,58,p,{castle:'Q'});
      }
      if(c==='b'&&i===4&&!inCheck(s,'b')){
        if(s.castling.includes('k')&&!s.board[5]&&!s.board[6]&&s.board[7]==='r'&&!isSquareAttacked(s,5,'w')&&!isSquareAttacked(s,6,'w'))pushMove(out,4,6,p,{castle:'k'});
        if(s.castling.includes('q')&&!s.board[3]&&!s.board[2]&&!s.board[1]&&s.board[0]==='r'&&!isSquareAttacked(s,3,'w')&&!isSquareAttacked(s,2,'w'))pushMove(out,4,2,p,{castle:'q'});
      }
    }
  }
  return out;
}

export function applyMove(s,m){
  const n=clone(s),c=s.turn,p=s.board[m.from]; n.board[m.from]=null;
  if(m.enPassant){const cap=m.to+(c==='w'?8:-8);n.board[cap]=null;}
  n.board[m.to]=m.promotion?(c==='w'?m.promotion.toUpperCase():m.promotion):p;
  if(m.castle){if(m.to===62){n.board[63]=null;n.board[61]='R';}if(m.to===58){n.board[56]=null;n.board[59]='R';}if(m.to===6){n.board[7]=null;n.board[5]='r';}if(m.to===2){n.board[0]=null;n.board[3]='r';}}
  let rights=n.castling;
  if(p==='K')rights=rights.replace(/[KQ]/g,'');if(p==='k')rights=rights.replace(/[kq]/g,'');
  if(m.from===63||m.to===63)rights=rights.replace('K','');if(m.from===56||m.to===56)rights=rights.replace('Q','');if(m.from===7||m.to===7)rights=rights.replace('k','');if(m.from===0||m.to===0)rights=rights.replace('q','');n.castling=rights;
  n.enPassant=m.doublePawn?(m.from+m.to)/2:null; n.halfmove=(p.toLowerCase()==='p'||m.capture)?0:s.halfmove+1; n.fullmove=s.fullmove+(c==='b'?1:0); n.turn=enemy(c); return n;
}
export function legalMoves(s){return pseudoMoves(s).filter(m=>!inCheck(applyMove(s,m),s.turn));}
function suffix(n){if(!inCheck(n,n.turn))return '';return legalMoves(n).length?'+' :'#';}
function sanFor(s,m,all){
  if(m.castle)return (m.to%8===6?'O-O':'O-O-O')+suffix(applyMove(s,m));
  const t=m.piece.toLowerCase();let x='';if(t!=='p')x=t.toUpperCase();
  if(t!=='p'){
    const peers=all.filter(z=>z.to===m.to&&z.from!==m.from&&z.piece.toLowerCase()===t);
    if(peers.length){const sameFile=peers.some(z=>file(z.from)===file(m.from)),sameRank=peers.some(z=>rank(z.from)===rank(m.from));if(!sameFile)x+=FILES[file(m.from)];else if(!sameRank)x+=String(8-rank(m.from));else x+=indexToSq(m.from);}
  } else if(m.capture)x+=FILES[file(m.from)];
  if(m.capture)x+='x';x+=indexToSq(m.to);if(m.promotion)x+='='+m.promotion.toUpperCase();return x+suffix(applyMove(s,m));
}
export function movesWithSan(s){const all=legalMoves(s);return all.map(m=>({...m,san:sanFor(s,m,all),uci:indexToSq(m.from)+indexToSq(m.to)+(m.promotion||'')}));}
export function makeMove(s,input){
  const moves=movesWithSan(s);let m=null;
  if(typeof input==='string'){const norm=input.trim().replace(/0-0-0/g,'O-O-O').replace(/0-0/g,'O-O').replace(/[!?]+$/,'');m=moves.find(x=>x.san.replace(/[+#]$/,'')===norm.replace(/[+#]$/,''));}
  else m=moves.find(x=>x.from===input.from&&x.to===input.to&&(!input.promotion||x.promotion===input.promotion));
  if(!m)throw new Error('Illegal or unrecognized move');const next=applyMove(s,m);return {state:next,move:{...m,san:sanFor(s,m,moves),uci:indexToSq(m.from)+indexToSq(m.to)+(m.promotion||''),before:toFen(s),after:toFen(next)}};
}

export function replayMoves(moves,startFen=START_FEN){
  let s=parseFen(startFen);const history=[];
  for(let i=0;i<moves.length;i++){
    const expected=moves[i];const r=makeMove(s,expected.san);
    if(expected.ply!==i+1||expected.beforeFen!==r.move.before||expected.afterFen!==r.move.after||expected.uci!==r.move.uci||expected.san!==r.move.san)throw new RecordError(ERR.GAME_INVALID,`Move ledger invariant failed at ply ${i+1}.`);
    history.push(r.move);s=r.state;
  }
  return {state:s,history};
}
export function replaySans(sans,startFen=START_FEN){let s=parseFen(startFen);const history=[];for(const san of sans){const r=makeMove(s,san);history.push(r.move);s=r.state;}return {state:s,history};}

function insufficientMaterial(s){
  const pieces=s.board.filter(Boolean);
  if(pieces.some(p=>['p','r','q'].includes(p.toLowerCase())))return false;
  const minors=pieces.filter(p=>['b','n'].includes(p.toLowerCase()));
  if(minors.length===0)return true;
  if(minors.length===1)return true;
  if(minors.every(p=>p.toLowerCase()==='b')){
    const colors=[];for(let i=0;i<64;i++)if(s.board[i]?.toLowerCase()==='b')colors.push((rank(i)+file(i))%2);return new Set(colors).size===1;
  }
  return false;
}
export function repetitionKeyFromState(s){
  // FIDE repetition identity uses piece placement, side to move and castling
  // rights. An en-passant target only changes the legal move set when a legal
  // en-passant capture actually exists; a phantom FEN target must not split an
  // otherwise identical repetition state.
  const placement=toFen(s).split(' ')[0];
  const ep=legalMoves(s).some(m=>m.enPassant)?(s.enPassant==null?'-':indexToSq(s.enPassant)):'-';
  return `${placement} ${s.turn} ${s.castling||'-'} ${ep}`;
}
export function repetitionKey(fen){return repetitionKeyFromState(parseFen(fen));}
export function gameStatus(s,{positionHistory=[]}={}){
  const ms=legalMoves(s);
  if(!ms.length){if(inCheck(s))return {over:true,result:s.turn==='w'?'0-1':'1-0',reason:'checkmate'};return {over:true,result:'1/2-1/2',reason:'stalemate'};}
  if(insufficientMaterial(s))return {over:true,result:'1/2-1/2',reason:'insufficient-material'};
  if(s.halfmove>=150)return {over:true,result:'1/2-1/2',reason:'75-move-rule'};
  const key=repetitionKey(toFen(s));const repeats=positionHistory.map(repetitionKey).filter(x=>x===key).length;
  if(repeats>=5)return {over:true,result:'1/2-1/2',reason:'fivefold-repetition'};
  return {over:false,check:inCheck(s),claimableDraw:s.halfmove>=100||repeats>=3,claimReason:s.halfmove>=100?'50-move-rule':repeats>=3?'threefold-repetition':null};
}

export function canonicalTimeControl(input){
  const v=String(input||'').trim();if(!v)return '';
  if(/^\d+\+\d+$/.test(v)){const [minutes,inc]=v.split('+').map(Number);return `${minutes*60}+${inc}`;}
  if(/^\d+(?:\/\d+)?(?::\d+)?$/.test(v))return v;
  throw new Error('Time control must be minutes+increment (e.g. 90+30) or canonical PGN form.');
}
export function displayTimeControl(canonical){
  const v=String(canonical||'');const m=v.match(/^(\d+)\+(\d+)$/);if(!m)return v;const sec=Number(m[1]);if(sec%60===0)return `${sec/60} min + ${m[2]} sec`;return v;
}

export function pgnFromGame(game){
  const metadata=game.metadata||{}, moves=game.moves||[], startFen=game.startFen||START_FEN;
  validateFen(startFen);
  const esc=v=>String(v??'?').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
  const headers={Event:metadata.event||'?',Site:metadata.site||'?',Date:metadata.date||'????.??.??',Round:metadata.round||'?',White:metadata.white||'?',Black:metadata.black||'?',Result:metadata.result||'*'};
  if(metadata.timeControl)headers.TimeControl=metadata.timeControl;if(metadata.board)headers.Board=metadata.board;if(metadata.section)headers.Section=metadata.section;
  if(startFen!==START_FEN){headers.SetUp='1';headers.FEN=startFen;}
  let text=Object.entries(headers).map(([k,v])=>`[${k} "${esc(v)}"]`).join('\n')+'\n\n';
  const start=parseFen(startFen);let full=start.fullmove, turn=start.turn, body=[];
  for(const m of moves){if(turn==='w'){body.push(`${full}. ${m.san}`);turn='b';}else{if(body.length===0||!body.at(-1).startsWith(`${full}.`))body.push(`${full}... ${m.san}`);else body[body.length-1]+=` ${m.san}`;turn='w';full++;}}
  text+=body.join(' ')+' '+headers.Result;return text.trim()+'\n';
}
