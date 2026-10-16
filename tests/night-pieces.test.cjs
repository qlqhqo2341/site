const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'night-pieces.html'), 'utf8');
const context = vm.createContext({ window: {} });
vm.runInContext(html.match(/<script id="puzzle-engine">([\s\S]*?)<\/script>/)[1], context);
const G = context.window.NightPieces;
const plain = value => JSON.parse(JSON.stringify(value));
const empty = () => Array(64).fill(0);

test('every rotation preserves cells, stays normalized and fits at its exact boundary', () => {
  G.SHAPES.forEach((base, id) => {
    for (let turn = 0; turn < 4; turn++) {
      const piece = { id, turn }, shape = G.shape(piece);
      assert.equal(shape.cells.length, base.length);
      assert.equal(new Set(shape.cells.map(([x,y]) => `${x},${y}`)).size, base.length);
      assert.equal(Math.min(...shape.cells.map(cell => cell[0])), 0);
      assert.equal(Math.min(...shape.cells.map(cell => cell[1])), 0);
      assert.ok(G.fits(empty(), piece, 8 - shape.h, 8 - shape.w));
      assert.equal(G.fits(empty(), piece, 9 - shape.h, 8 - shape.w), false);
      assert.equal(G.fits(empty(), piece, 8 - shape.h, 9 - shape.w), false);
    }
  });
});

test('overlap, negative coordinates and fractional positions never modify the board', () => {
  const board = empty(); board[0] = 1;
  const before = [...board], piece = { id: 4, turn: 0 };
  for (const [row,col] of [[0,0], [-1,0], [0,-1], [7,7], [.5,0]]) {
    assert.equal(G.place(board,piece,row,col), null);
    assert.deepEqual(board,before);
  }
});

test('a crossing row and column clear together and their intersection counts once', () => {
  const board = empty();
  for (let n = 0; n < 7; n++) { board[56+n] = 1; board[n*8+7] = 2; }
  const result = G.place(board,{id:0,turn:0},7,7);
  assert.equal(result.clear.count,2);
  assert.equal(result.clear.indices.length,15);
  assert.equal(result.board.filter(Boolean).length,0);
  assert.equal(result.perfect,true);
  assert.equal(result.points,445);
  assert.equal(result.combo,1);
  assert.equal(board.filter(Boolean).length,14);
});

test('two parallel rows, combo bonuses and a non-clearing turn score correctly', () => {
  const board = empty();
  for(let row=0;row<2;row++) for(let col=0;col<7;col++) board[row*8+col]=1;
  const result = G.place(board,{id:1,turn:1},0,7,2);
  assert.equal(result.clear.count,2);
  assert.equal(result.clear.indices.length,16);
  assert.equal(result.points,550);
  assert.equal(result.combo,3);
  const calm = G.place(empty(),{id:0,turn:0},0,0,5);
  assert.equal(calm.combo,0);
  assert.equal(calm.points,5);
});

test('game-over and hints consider every rotation', () => {
  const board = Array(64).fill(1);
  for (let row=2;row<6;row++) board[row*8+3]=0;
  const horizontal = {id:5,turn:0};
  assert.equal(G.findPlacement(board,horizontal,false),null);
  const hint = G.findPlacement(board,horizontal);
  assert.ok(hint);
  assert.ok(G.fits(board,hint.piece,hint.row,hint.col));
  assert.equal(hint.piece.turn,1);
  assert.equal(G.findPlacement(Array(64).fill(1),{id:0,turn:0}),null);
});

test('fresh trays offer a playable shape on a cramped board', () => {
  const board = Array.from({length:64},(_,i) => (Math.floor(i/8)+i%8)%2 ? 1 : 0);
  for(let seed=0;seed<100;seed++) {
    const dealt = G.deal(board,seed);
    assert.ok(dealt.hand.some(piece=>G.findPlacement(board,piece)));
  }
});

test('hints prioritize clearing a line and return an actionable placement', () => {
  const board=empty(); for(let n=0;n<7;n++)board[n]=1;
  const hand=[{id:0,turn:0},{id:4,turn:0},null];
  const hint=G.suggest(board,hand,0);
  assert.equal(hint.index,0);
  assert.equal(hint.row,0);
  assert.equal(hint.col,7);
  assert.equal(G.place(board,hint.piece,hint.row,hint.col).clear.count,1);
  assert.equal(G.suggest(Array(64).fill(1),hand),null);
});

test('daily seeds replay exactly; 2,500 opening boards have no already-completed lines', () => {
  const seed = G.hash('night-pieces:2026-10-16');
  assert.deepEqual(plain(G.create(seed)),plain(G.create(seed)));
  assert.notDeepEqual(plain(G.create(seed)),plain(G.create(G.hash('night-pieces:2026-10-17'))));
  for(let n=0;n<2500;n++) {
    const state=G.create(n);
    assert.ok(G.valid(state),`invalid opening seed ${n}`);
    assert.equal(G.linesOf(state.board).count,0);
  }
});

test('saved states reject malformed boards, pieces and counters', () => {
  const good = plain(G.create(42));
  assert.ok(G.valid(good));
  const bad = [null,{}, {...good,board:Array(63).fill(0)}, {...good,board:Array(64).fill(8)},
    {...good,hand:[null,null,null]}, {...good,hand:[{id:99,turn:0},null,null]},
    {...good,hand:[{id:0,turn:4},null,null]}, {...good,score:-1}, {...good,moves:NaN},
    {...good,seed:2**32}, {...good,board:Array(64).fill(1)}];
  bad.forEach(value=>assert.equal(G.valid(value),false));
});

test('8,000 legal placements preserve occupancy, scores and serializable state', () => {
  let checked=0;
  for(let seed=0;checked<8000;seed++) {
    const state=plain(G.create(seed));
    for(let turn=0;turn<150&&checked<8000;turn++) {
      const index=state.hand.findIndex(piece=>piece&&G.findPlacement(state.board,piece));
      if(index<0) break;
      const found=G.findPlacement(state.board,state.hand[index]);
      const before=[...state.board], result=G.place(state.board,found.piece,found.row,found.col,state.combo);
      assert.ok(result);
      assert.deepEqual(state.board,before);
      assert.equal(result.board.filter(Boolean).length,before.filter(Boolean).length+G.shape(found.piece).cells.length-result.clear.indices.length);
      assert.equal(G.linesOf(result.board).count,0);
      state.board=plain(result.board);state.score+=result.points;state.moves++;state.lines+=result.clear.count;state.combo=result.combo;state.hand[index]=null;
      if(state.hand.every(piece=>!piece)) { const drawn=G.deal(state.board,state.seed);state.hand=plain(drawn.hand);state.seed=drawn.seed;state.hands++; }
      assert.ok(G.valid(JSON.parse(JSON.stringify(state))));
      checked++;
    }
  }
  assert.equal(checked,8000);
});
