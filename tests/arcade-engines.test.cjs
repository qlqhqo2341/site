const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../arcade-engines.js');
const copy = value => JSON.parse(JSON.stringify(value));

test('all five games generate deterministic, valid, unfinished puzzles', () => {
  for (const kind of Object.keys(E)) {
    const levels = kind === 'memory' ? [8,10,12] : kind === 'number' ? [3,4] : [4,5,6];
    for (const level of levels) for (let seed=0;seed<100;seed++) {
      const state=E[kind].create(level,seed);
      assert.ok(E[kind].valid(state),`${kind}/${level}/${seed}`);
      assert.equal(E[kind].won(state),false);
      assert.deepEqual(state,E[kind].create(level,seed));
    }
  }
});

test('light hints solve every size and pressing a cell twice is reversible', () => {
  for(const n of [4,5,6])for(let seed=0;seed<100;seed++) {
    const state=E.lights.create(n,seed),before=copy(state);
    let next=state;
    for(const index of E.lights.solve(state))next=E.lights.act(next,index);
    assert.ok(E.lights.won(next));
    assert.equal(next.moves,state.optimal);
    assert.deepEqual(state,before);
    if(!E.lights.won(E.lights.act(state,0))) {
      const twice=E.lights.act(E.lights.act(state,0),0);
      assert.deepEqual(twice.board,state.board);
    }
  }
});

test('a single-cross light puzzle is solved in the optimal one move', () => {
  const board=Array(16).fill(0);[5,1,4,6,9].forEach(i=>board[i]=1);
  const state={n:4,board,start:[...board],moves:0,hints:0,optimal:1};
  assert.deepEqual(E.lights.solve(state),[5]);
});

test('water generation carries a real legal solution for every difficulty', () => {
  for(const n of [4,5,6])for(let seed=0;seed<150;seed++) {
    const start=E.water.create(n,seed);let state=start;
    assert.ok(start.solution.length>0);
    for(const step of start.solution) {
      state=E.water.act(state,step.from,step.to);
      assert.ok(state,`illegal inverse at ${n}/${seed}`);
      assert.ok(E.water.valid(state));
    }
    assert.ok(E.water.won(state));
    assert.deepEqual(start.tubes,start.start);
  }
});

test('water pours contiguous top colors, respects capacity and never mixes colors', () => {
  const tubes=[[2,2,1,1],[1,1,1],[],[3,3,3,3]];
  const before=copy(tubes),poured=E.water.pour(tubes,0,1);
  assert.deepEqual(poured,[[2,2,1],[1,1,1,1],[],[3,3,3,3]]);
  assert.deepEqual(tubes,before);
  for(const [from,to]of [[0,0],[0,3],[2,0],[1,3],[-1,0],[0,99]])assert.equal(E.water.pour(tubes,from,to),null);
});

test('number puzzles retain solvability after 5,000 legal sliding moves', () => {
  for(const n of [3,4]) {
    let state=E.number.create(n,51),moves=0;
    for(let i=0;i<2500;i++) {
      if(E.number.won(state))state=E.number.create(n,i+100);
      const blank=state.board.indexOf(0),row=Math.floor(blank/n),col=blank%n;
      const target=row>0?blank-n:col>0?blank-1:blank+1;
      const before=copy(state),next=E.number.act(state,target);
      assert.ok(next);assert.ok(E.number.valid(next));assert.deepEqual(state,before);
      assert.equal(next.moves,state.moves+1);state=next;moves++;
    }
    assert.equal(moves,2500);
  }
  const impossible={n:4,board:[2,1,3,4,5,6,7,8,9,10,11,12,13,14,15,0],start:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,0],moves:0};
  assert.equal(E.number.valid(impossible),false);
});

test('number win checks require both ordered tiles and the final blank', () => {
  const state={n:3,board:[1,2,3,4,5,6,7,0,8],start:[1,2,3,4,5,6,7,0,8],moves:0};
  assert.equal(E.number.distance(state),1);assert.equal(E.number.act(state,0),null);
  const next=E.number.act(state,8);assert.ok(E.number.won(next));assert.equal(E.number.distance(next),0);
});

test('memory matches, mismatches, duplicate flips and final completion', () => {
  let state=E.memory.create(8,33);
  const first=0,same=state.deck.lastIndexOf(state.deck[first]);
  state=E.memory.act(state,first);assert.equal(E.memory.act(state,first),null);assert.equal(state.moves,0);
  state=E.memory.act(state,same);assert.equal(state.moves,1);assert.equal(state.matched.filter(Boolean).length,2);
  const a=state.matched.findIndex(v=>!v),b=state.deck.findIndex((v,i)=>v!==state.deck[a]&&!state.matched[i]);
  state=E.memory.act(E.memory.act(state,a),b);assert.equal(state.open.length,2);assert.equal(E.memory.act(state,3),null);
  state=E.memory.settle(state);assert.deepEqual(state.open,[]);
  for(let value=0;value<8;value++) {
    const indices=state.deck.flatMap((v,i)=>v===value&&!state.matched[i]?[i]:[]);
    if(indices.length)state=E.memory.act(E.memory.act(state,indices[0]),indices[1]);
  }
  assert.ok(E.memory.won(state));assert.ok(E.memory.valid(state));
});

test('pipe networks rotate in four steps and hints complete every generated network', () => {
  for(let mask=1;mask<16;mask++){let value=mask;for(let i=0;i<4;i++)value=E.pipes.rotate(value);assert.equal(value,mask);}
  for(const n of [4,5,6])for(let seed=0;seed<100;seed++) {
    let state=E.pipes.create(n,seed),count=0;
    while(!E.pipes.won(state)&&count++<n*n){const hint=E.pipes.hint(state);assert.ok(hint);state=hint.state;assert.ok(E.pipes.valid(state));}
    assert.ok(E.pipes.won(state));assert.equal(E.pipes.connections(state).leaks,0);
  }
});

test('all save validators reject corrupt shapes, counters and content', () => {
  for(const kind of Object.keys(E)) {
    assert.equal(E[kind].valid(null),false);assert.equal(E[kind].valid({}),false);
    const state=E[kind].create(kind==='memory'?8:kind==='number'?3:4,17);
    assert.equal(E[kind].valid({...state,moves:-1}),false);
  }
  assert.equal(E.lights.valid({...E.lights.create(4,1),board:[1,2]}),false);
  assert.equal(E.water.valid({...E.water.create(4,1),tubes:[[]]}),false);
  assert.equal(E.number.valid({...E.number.create(3,1),board:Array(9).fill(1)}),false);
  assert.equal(E.memory.valid({...E.memory.create(8,1),matched:Array(16).fill('yes')}),false);
  assert.equal(E.pipes.valid({...E.pipes.create(4,1),source:99}),false);
});
