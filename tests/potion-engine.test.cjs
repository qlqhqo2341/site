const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../games/moonlit-sort/potion-engine.js');
const A=require('../games/moonlit-sort/potion-art.js');
const copy=value=>JSON.parse(JSON.stringify(value));

test('all 36 stages are deterministic, valid, unfinished and progressively introduce colors',()=>{
  const counts=new Set();
  for(let level=1;level<=36;level++){
    const round=E.create(level);counts.add(round.colors);
    assert.ok(E.valid(round));assert.equal(E.won(round),false);assert.deepEqual(round,E.create(level));
    assert.equal(round.tubes.length,round.colors+2);
    assert.ok(round.known.every((flags,i)=>!flags.length||flags.at(-1)));
    if(level<9)assert.ok(round.known.flat().every(Boolean));
    else assert.ok(round.known.flat().some(flag=>!flag));
  }
  assert.deepEqual([...counts],[3,4,5,6,7]);
});

test('every stage has a legal certificate, including partial pours that reveal hidden layers',()=>{
  let checked=0;
  for(let level=1;level<=36;level++){
    const start=E.create(level),proof=E.certificate(start);assert.ok(proof?.length);
    let round=start;
    for(const step of proof){
      assert.equal(E.exactKey(round),E.exactKey(step.state));
      const before=copy(round),move=E.plan(round,step.move.from,step.move.to);
      assert.deepEqual(move,step.move);
      round=E.pour(round,move.from,move.to);assert.ok(E.valid(round));assert.deepEqual(before,step.state);
      assert.equal(round.moves,before.moves+1);
      for(let color=1;color<=round.colors;color++)assert.equal(round.tubes.flat().filter(c=>c===color).length,4);
      checked++;
    }
    assert.ok(E.won(round));assert.equal(start.moves,0);
  }
  assert.ok(checked>400);
});

test('a concealed matching color stays behind until it is exposed',()=>{
  const round={...E.create(1),tubes:[[1,1,1],[1],[2,2,2,2],[3,3,3,3],[]],known:[[true,false,true],[true],[true,true,true,true],[true,true,true,true],[]]};
  assert.ok(E.valid(round));assert.equal(E.plan(round,0,1).amount,1);
  const first=E.pour(round,0,1);assert.deepEqual(first.tubes[0],[1,1]);assert.deepEqual(first.known[0],[true,true]);
  assert.equal(E.plan(first,0,1).amount,2);
  const second=E.pour(first,0,1);assert.ok(E.won(second));assert.equal(second.moves,2);
  assert.deepEqual(round.known[0],[true,false,true]);
});

test('pour rules reject mixed colors, full targets, completed sources and invalid indices',()=>{
  const round={...E.create(1),tubes:[[1,2],[1,1,1],[2,2,2],[3,3,3,3],[]],known:[[true,true],[true,true,true],[true,true,true],[true,true,true,true],[]]};
  for(const [from,to]of [[0,1],[0,3],[3,4],[0,0],[-1,0],[0,99],[4,0]])assert.equal(E.plan(round,from,to),null);
  const move=E.plan(round,0,2);assert.equal(move.amount,1);assert.equal(move.color,2);
  const next=E.pour(round,0,2);assert.deepEqual(next.tubes[2],[2,2,2,2]);assert.deepEqual(round.tubes[0],[1,2]);
});

test('one extra vial preserves volume, certificate and reset behavior',()=>{
  for(const level of [1,9,20,36]){
    const initial=E.create(level),extra=E.addBottle(initial);assert.ok(E.valid(extra));
    assert.equal(extra.tubes.length,initial.tubes.length+1);assert.equal(E.addBottle(extra),null);
    assert.deepEqual(extra.tubes.flat(),initial.tubes.flat());assert.ok(E.certificate(extra));
    const reset=E.reset(extra);assert.ok(E.valid(reset));assert.equal(reset.extra,false);assert.deepEqual(reset.tubes,initial.tubes);
  }
});

test('hints on certified paths are valid and do not mutate state',()=>{
  for(const level of [1,9,18,36]){
    let round=E.create(level),steps=0;
    while(!E.won(round)&&steps++<90){
      const before=copy(round),hint=E.suggest(round,{search:false});assert.ok(hint?.certified);
      assert.ok(E.plan(round,hint.from,hint.to));assert.deepEqual(round,before);
      round=E.pour(round,hint.from,hint.to);
    }
    assert.ok(E.won(round));
  }
});

test('off-path search and bounded fallback return only legal moves',()=>{
  let round=E.create(9),proof=E.certificate(round),alternative=E.legalMoves(round).find(move=>move.from!==proof[0].move.from||move.to!==proof[0].move.to);
  assert.ok(alternative);round=E.pour(round,alternative.from,alternative.to);
  const before=copy(round),hint=E.suggest(round,{maxNodes:3000,budgetMs:100});
  if(hint)assert.ok(E.plan(round,hint.from,hint.to));
  assert.deepEqual(round,before);
});

test('stars account for moves, hints and the extra vial',()=>{
  const base=E.create(1),solved={...base,tubes:[[1,1,1,1],[2,2,2,2],[3,3,3,3],[],[]],known:Array.from({length:5},(_,i)=>i<3?Array(4).fill(true):[]),moves:4};
  assert.equal(E.stars(base),0);assert.equal(E.stars(solved),3);assert.equal(E.stars({...solved,hints:1}),2);assert.equal(E.stars({...solved,hints:3}),1);assert.equal(E.stars({...solved,extra:true}),1);
});

test('saved-state validation rejects damaged counts, concealed tops and malformed routes',()=>{
  const good=E.create(12);assert.ok(E.valid(JSON.parse(JSON.stringify(good))));
  for(const value of [null,{}, {...good,moves:-1},{...good,level:37},{...good,colors:99},{...good,tubes:[[]]},{...good,extra:true},{...good,route:[{from:99,to:1,amount:1}]}])assert.equal(E.valid(value),false);
  const top=copy(good),index=top.tubes.findIndex(t=>t.length);top.known[index][top.known[index].length-1]=false;assert.equal(E.valid(top),false);
  const volume=copy(good);volume.tubes[index].pop();volume.known[index].pop();assert.equal(E.valid(volume),false);
});

test('liquid horizons stay horizontal and monotone through the full tilt range',()=>{
  assert.ok(Math.abs(A.height(4,0)-52)<.001);assert.ok(A.unitArea>1000);
  for(let angle=-75;angle<=75;angle+=5){
    let previous=Infinity;
    for(let volume=0;volume<=4;volume+=.125){const horizon=A.height(volume,angle);assert.ok(Number.isFinite(horizon));assert.ok(horizon<previous);previous=horizon;}
  }
});

test('bottle artwork masks unknown colors and supports fractional animated pours',()=>{
  const hidden=A.svg([1],[false],{prefix:'hidden'});assert.ok(hidden.includes('>?<'));assert.ok(!hidden.includes(E.COLORS[0]));
  const moving=A.svg([1,2],[true,true],{prefix:'moving',angle:68,drain:.5,incoming:{color:3,amount:.25},moving:true});
  assert.ok(moving.includes('rotate(-68 40 118)'));assert.ok(moving.includes('moving-clip'));assert.ok(!moving.includes('NaN'));assert.ok(moving.includes(E.COLORS[2]));
});

test('game library includes the new game and keeps counts, previews and local links consistent',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),repo=path.join(__dirname,'../games'),context=vm.createContext({window:{}});
  vm.runInContext(fs.readFileSync(path.join(repo,'shared/arcade-catalog.js'),'utf8'),context);
  const {games,preview}=context.window.ArcadeCatalog;
  assert.equal(new Set(games.map(game=>game.id)).size,games.length);assert.ok(games.some(game=>game.id==='potions'));
  games.forEach(game=>{assert.ok(fs.existsSync(path.join(repo,game.href,'index.html')));assert.ok(preview(game.id).startsWith('<svg'));});
  const html=fs.readFileSync(path.join(repo,'index.html'),'utf8');
  assert.equal(Number(html.match(/id="collection-count">(\d+)/)[1]),games.length);assert.equal(Number(html.match(/id="all-count">(\d+)/)[1]),games.length);
  const page=fs.readFileSync(path.join(repo,'moonlit-sort/index.html'),'utf8');
  for(const match of page.matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(fs.existsSync(path.join(repo,'moonlit-sort',match[1])));
});
