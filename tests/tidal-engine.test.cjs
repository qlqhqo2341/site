const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../games/tidal-deck/tidal-engine.js');
const copy=x=>JSON.parse(JSON.stringify(x));
const id=(rank,suit=0)=>suit*13+rank-2;
function withHand(ids,seed='fixture'){
  const r=E.create(seed);r.hand=[...ids,...Array.from({length:52},(_,i)=>i).filter(i=>!ids.includes(i)).slice(0,8-ids.length)];r.deck=Array.from({length:52},(_,i)=>i).filter(i=>!r.hand.includes(i));return r;
}
function best(run){
  let best={score:-1,ids:[]};
  function walk(start,ids){if(ids.length){const q=E.quote(run,ids);if(q.score>best.score)best={...q,ids:[...ids]};}if(ids.length===5)return;for(let i=start;i<run.hand.length;i++){ids.push(run.hand[i]);walk(i+1,ids);ids.pop();}}
  walk(0,[]);return best;
}
function shopFixture(){const r=withHand([id(10),id(11),id(12),id(13),id(14)]);return E.play(r,r.hand.slice(0,5));}

test('every five-card hand matches the independently counted poker distribution',()=>{
  const counts=Array(9).fill(0),cards=Array(5);
  for(let a=0;a<48;a++)for(let b=a+1;b<49;b++)for(let c=b+1;c<50;c++)for(let d=c+1;d<51;d++)for(let e=d+1;e<52;e++){
    cards[0]=a;cards[1]=b;cards[2]=c;cards[3]=d;cards[4]=e;counts[E.evaluate(cards).type]++;
  }
  assert.deepEqual(counts,[1302540,1098240,123552,54912,10200,5108,3744,624,40]);
});

test('aces work at either straight end, never wrap, and partial hands score only their actual group',()=>{
  assert.equal(E.evaluate([id(14),id(2,1),id(3,2),id(4,3),id(5)]).type,4);
  assert.equal(E.evaluate([id(10),id(11),id(12),id(13),id(14)]).type,8);
  assert.equal(E.evaluate([id(12),id(13,1),id(14,2),id(2),id(3,1)]).type,0);
  for(const [cards,type,length]of [[[id(7),id(7,1)],1,2],[[id(7),id(7,1),id(7,2)],3,3],[[id(7),id(7,1),id(7,2),id(7,3)],7,4],[[id(3),id(10,1),id(14,2)],0,1]]){
    const result=E.evaluate(cards);assert.equal(result.type,type);assert.equal(result.scoring.length,length);
  }
  for(const bad of [[],[1,1],[-1],[52],[1.5],[0,1,2,3,4,5],null])assert.equal(E.evaluate(bad),null);
});

test('chips, additive relics, multiplicative relics and boss effects agree with the displayed preview',()=>{
  const cards=[id(8),id(8,1),id(13,2)],r=withHand(cards),before=copy(r);
  const base=E.quote(r,cards);assert.equal(base.type,1);assert.equal(base.chips,36);assert.equal(base.mult,4);assert.equal(base.score,144);assert.deepEqual(base.scoring,cards.slice(0,2));
  const foam=E.quote({...r,relics:['coral','foam','crown']},cards);assert.equal(foam.chips,46);assert.equal(foam.mult,10);assert.equal(foam.score,460);
  const echo=E.quote({...r,relics:['coral','twins','echo'],played:[0,1,0,0,0,0,0,0,0]},cards);assert.equal(echo.score,550);assert.equal(echo.mult,15.3);
  assert.deepEqual(r,before);
  const boss=E.quote({...r,round:2},cards);assert.equal(boss.score,72);
  const pressure=E.quote({...r,round:8},cards);assert.equal(pressure.chips,28);assert.equal(pressure.score,112);
  const level=E.quote({...r,levels:[0,2,0,0,0,0,0,0,0]},cards);assert.equal(level.chips,72);assert.equal(level.mult,6);assert.equal(level.score,432);
  const paid=E.play({...r,relics:['coral','treasure']},cards);assert.equal(paid.coins,r.coins+2);assert.equal(paid.score,base.score);
});

test('play and discard consume unique cards, enforce limits and leave the original run untouched',()=>{
  const r=E.create('cards'),before=copy(r),cards=r.hand.slice(0,5);
  assert.equal(E.play(r,[]),null);assert.equal(E.play(r,[cards[0],cards[0]]),null);assert.equal(E.discard(r,[r.deck[0]]),null);assert.equal(E.play(r,r.hand),null);
  const next=E.discard(r,cards);assert.ok(E.valid(next));assert.equal(next.hands,4);assert.equal(next.discards,2);assert.equal(next.deck.length,r.deck.length-5);assert.ok(cards.every(c=>!next.hand.includes(c)));assert.deepEqual(r,before);
  const played=E.play(next,next.hand.slice(0,2));assert.ok(E.valid(played));assert.equal(played.hands,3);assert.equal(played.last.score,E.quote(next,next.hand.slice(0,2)).score);
  assert.equal(E.discard({...r,discards:0},cards),null);assert.equal(E.play({...r,phase:'lost'},cards),null);
});

test('shops account for rewards, sold inventory, capacity, sales, upgrades and reroll costs',()=>{
  let r=shopFixture();assert.equal(r.phase,'shop');assert.ok(E.valid(r));assert.equal(r.reward.total,7);assert.equal(r.coins,11);
  const relic=r.shop.offers.findIndex(o=>o.kind==='relic'),offer=r.shop.offers[relic],before=copy(r);r=E.buy(r,relic);assert.ok(E.valid(r));assert.equal(r.coins,before.coins-offer.cost);assert.ok(r.relics.includes(offer.id));assert.equal(E.buy(r,relic),null);
  const sold=E.sell(r,offer.id);assert.ok(E.valid(sold));assert.equal(sold.coins,r.coins+Math.floor(offer.cost/2));assert.equal(E.sell(sold,offer.id),null);
  const level=r.shop.offers.findIndex(o=>o.kind==='level'),levelOffer=r.shop.offers[level];const upgraded=E.buy({...r,coins:20},level);assert.equal(upgraded.levels[levelOffer.id],1);assert.equal(upgraded.coins,20-levelOffer.cost);
  const rerolled=E.reroll({...r,coins:20});assert.equal(rerolled.coins,18);assert.equal(rerolled.shop.rolls,1);assert.ok(rerolled.shop.offers.every(o=>o.kind!=='relic'||!r.relics.includes(o.id)));
  assert.equal(E.reroll({...r,coins:1}),null);
  const full={...before,relics:['coral','pearl','ink','reef']};assert.equal(E.buy(full,relic),null);
  const next=E.advance(r);assert.ok(E.valid(next));assert.equal(next.round,1);assert.equal(next.hands,4);assert.equal(next.discards,3);assert.equal(next.score,0);assert.deepEqual(next.relics,r.relics);assert.equal(next.hand.length,8);assert.equal(next.deck.length,44);assert.equal(next.spent.length,0);
  assert.equal(E.advance(E.create('not-shop')),null);
});

test('a final-hand clear wins before exhaustion; a missed target loses and cannot be played again',()=>{
  const r=withHand([id(10),id(11),id(12),id(13),id(14)]);r.hands=1;r.round=8;r.score=E.TARGETS[8]-1;
  const won=E.play(r,r.hand.slice(0,5));assert.equal(won.phase,'won');assert.ok(E.valid(won));assert.equal(won.hands,0);assert.equal(E.advance(won),null);assert.equal(E.play(won,won.hand.slice(0,1)),null);
  const poor=E.create('lost');poor.round=8;poor.hands=1;const lost=E.play(poor,[poor.hand[0]]);assert.equal(lost.phase,'lost');assert.ok(E.valid(lost));
  const five=shopFixture();five.round=4;const sixth=E.advance(five);assert.equal(sixth.discards,2);assert.equal(E.condition(sixth.round).type,'discard');
});

test('seeded voyages survive JSON reload, keep the full 52-card partition and include winnable builds',()=>{
  let wins=0,checked=0;
  for(let seed=0;seed<35;seed++){
    let r=E.create('balance:'+seed);assert.deepEqual(r,E.create('balance:'+seed));
    for(let guard=0;guard<150&&['play','shop'].includes(r.phase);guard++){
      assert.ok(E.valid(r));assert.ok(E.valid(copy(r)));checked++;
      if(r.phase==='shop'){
        for(const name of ['crown','shell','lantern','twins','reef','ink','echo','pearl','current']){const i=r.shop.offers.findIndex(o=>o.kind==='relic'&&o.id===name&&!o.sold);if(i>=0)r=E.buy(r,i)||r;}
        const levels=r.shop.offers.map((o,i)=>({o,i})).filter(x=>x.o.kind==='level').sort((a,b)=>r.played[b.o.id]-r.played[a.o.id]);for(const{i}of levels)r=E.buy(r,i)||r;
        if(r.coins>8&&r.relics.length<4){r=E.reroll(r)||r;for(let i=0;i<r.shop.offers.length;i++)r=E.buy(r,i)||r;}
        const original=copy(r),next=E.advance(r);assert.deepEqual(E.advance(copy(r)),next);assert.deepEqual(r,original);r=next;continue;
      }
      const chosen=best(r),needed=(E.TARGETS[r.round]-r.score)/r.hands;
      if(r.discards&&chosen.score<needed*1.1){const discard=r.hand.filter(c=>!chosen.scoring.includes(c)).slice(0,5);if(discard.length){r=E.discard(r,discard);continue;}}
      const old=copy(r),next=E.play(r,chosen.ids);assert.deepEqual(next,E.play(copy(r),chosen.ids));assert.deepEqual(r,old);assert.equal(next.score-r.score,chosen.score);r=next;
    }
    assert.ok(E.valid(r));assert.ok(['won','lost'].includes(r.phase));if(r.phase==='won')wins++;
  }
  assert.ok(checked>500);assert.ok(wins>0&&wins<35);
});

test('malformed saves reject bad decks, stale scoring data, invalid shops and broken counters',()=>{
  const r=E.create('save');assert.ok(E.valid(r));
  const played=E.play(r,[r.hand[0]]),shop=shopFixture();
  for(const bad of [null,{}, {...r,rng:-1},{...r,round:9},{...r,hands:0},{...r,coins:-1},{...r,levels:[0]},{...r,relics:['unknown']},{...r,relics:['coral','coral']},{...r,hand:r.hand.map(()=>0)},{...r,deck:r.deck.slice(1)},{...r,stats:null},{...r,last:{}},{...played,last:{...played.last,type:99}},{...played,last:{...played.last,score:Infinity}},{...shop,reward:null},{...shop,shop:{...shop.shop,offers:[{kind:'bad',cost:0,sold:false}]}},{...shop,shop:{...shop.shop,offers:[{kind:'level',id:99,cost:0,sold:false}]}}])assert.equal(E.valid(bad),false);
});

test('scoring steps reveal only contributing cards and apply additions, the boss penalty, then multipliers',()=>{
  const cards=[id(8,1),id(13,2),id(8,3),id(4),id(2)];
  const run=withHand(cards);
  run.round=2;
  run.relics=['current','twins','echo','moon'];
  run.played[1]=1;
  const quote=E.quote(run,cards,{withSteps:true});
  assert.deepEqual(quote.steps.map(({kind,cardId,relicId,chips,mult})=>[kind,cardId??relicId,chips,mult]),[
    ['base',undefined,20,2],['chips',id(8,1),28,2],['chips',id(8,3),36,2],
    ['mult','twins',36,7],['mult',undefined,36,5],['mult','current',36,8],
    ['mult','echo',36,13.6],['mult','moon',36,23.12]
  ]);
  assert.equal(quote.score,832);
  assert.equal(E.play(run,cards).last.score,quote.score);
  assert.ok(!('steps' in E.play(run,cards).last));

  run.round=8;
  run.relics=['foam'];
  const pressure=E.quote(run,cards,{withSteps:true});
  assert.deepEqual(pressure.steps.filter(step=>step.cardId!==undefined).map(step=>step.chips),[24,29,33,35,36]);
  assert.equal(pressure.steps[1].relicId,'foam');
  assert.equal(pressure.steps.at(-1).chips,pressure.chips);
  assert.ok(E.valid(E.play(run,cards)));
});
