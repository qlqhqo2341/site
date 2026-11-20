(function (root) {
  'use strict';
  const LEVELS = 36;
  const COLORS = ['#a775ed','#49c9ac','#f3a25f','#62b9ed','#ec7fa8','#f3d462','#8292f2'];
  const NAMES = ['라벤더','민트','살구','하늘','장미','레몬','아이리스'];
  const SYMBOLS = ['✦','◆','●','≋','♥','☀','✿'];
  const copy = value => JSON.parse(JSON.stringify(value));
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  function hash(text) { let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return n; }
  function random(seed) {
    let value=seed>>>0;
    return ()=>{value=(value+0x6D2B79F5)>>>0;let t=value;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
  }
  function settings(level) {
    return {colors:level<=3?3:level<=8?4:level<=16?5:level<=26?6:7,hidden:level>=9,chapter:Math.floor((level-1)/12)};
  }
  function complete(tube) { return tube.length===4&&tube.every(color=>color===tube[0]); }
  function won(round) { return round.tubes.every(tube=>!tube.length||complete(tube)); }
  function reveal(tubes,known) {
    return known.map((flags,i)=>flags.map((value,j)=>value||j===tubes[i].length-1||complete(tubes[i])));
  }
  function plan(round,from,to) {
    if(!integer(from)||!integer(to)||from===to||from>=round.tubes.length||to>=round.tubes.length)return null;
    const a=round.tubes[from],b=round.tubes[to];
    if(!a.length||b.length===4||complete(a)||(b.length&&b.at(-1)!==a.at(-1)))return null;
    let run=0;const color=a.at(-1);
    for(let j=a.length-1;j>=0&&a[j]===color&&round.known[from][j];j--)run++;
    const amount=Math.min(run,4-b.length);
    return amount?{from,to,color,amount}:null;
  }
  function pour(round,from,to) {
    if(won(round))return null;
    const move=plan(round,from,to);if(!move)return null;
    const tubes=round.tubes.map(t=>[...t]),known=round.known.map(k=>[...k]);
    tubes[from].splice(-move.amount);known[from].splice(-move.amount);
    tubes[to].push(...Array(move.amount).fill(move.color));known[to].push(...Array(move.amount).fill(true));
    return {...round,tubes,known:reveal(tubes,known),moves:round.moves+1};
  }
  function create(level) {
    if(!Number.isInteger(level)||level<1||level>LEVELS)throw new Error('Invalid stage');
    const config=settings(level),n=config.colors,rng=random(hash(`moonlit-sort:stage:${level}:v1`));
    const tubes=Array.from({length:n+2},(_,i)=>i<n?Array(4).fill(i+1):[]),reverse=[];
    // Reverse legal pours from a solved arrangement; the recorded inverse is a certificate.
    for(let step=0;step<14+level*2;step++) {
      const options=[];
      tubes.forEach((a,from)=>{
        if(!a.length)return;const color=a.at(-1);let run=0;for(let j=a.length-1;j>=0&&a[j]===color;j--)run++;
        tubes.forEach((b,to)=>{
          if(from===to||b.length===4||b.at(-1)===color)return;
          for(let amount=1;amount<=Math.min(run,4-b.length);amount++) {
            if(amount===run&&run<a.length)continue;
            if(!b.length&&amount===a.length)continue;
            const option={from,to,amount};options.push(option);if(b.length)options.push(option,option);
          }
        });
      });
      if(!options.length)break;
      const move=options[Math.floor(rng()*options.length)],color=tubes[move.from].at(-1);
      tubes[move.from].splice(-move.amount);tubes[move.to].push(...Array(move.amount).fill(color));
      reverse.push({from:move.to,to:move.from,amount:move.amount});
    }
    // Even the unlikely already-sorted draw is turned into a small, certified puzzle.
    if(tubes.every(t=>!t.length||complete(t))) {
      const empty=tubes.findIndex(t=>!t.length),source=tubes.findIndex(t=>complete(t));
      const color=tubes[source].pop();tubes[empty].push(color);reverse.push({from:empty,to:source,amount:1});
    }
    let known=tubes.map(tube=>tube.map((_,j)=>!config.hidden||j>=tube.length-2||rng()>.65));
    known=reveal(tubes,known);
    const round={level,colors:n,tubes,known,start:copy(tubes),startKnown:copy(known),route:reverse.reverse(),moves:0,hints:0,extra:false};
    return round;
  }
  function addBottle(round) {
    if(round.extra||won(round))return null;
    return {...round,tubes:[...round.tubes.map(t=>[...t]),[]],known:[...round.known.map(k=>[...k]),[]],extra:true};
  }
  function reset(round) { return {...copy(round),tubes:copy(round.start),known:copy(round.startKnown),moves:0,hints:0,extra:false}; }
  const exactKey = round=>round.tubes.map((tube,i)=>tube.map((color,j)=>(color+(round.known[i][j]?0:8)).toString(16)).join('')).join('|');
  const canonicalKey = round=>round.tubes.map((tube,i)=>tube.map((color,j)=>(color+(round.known[i][j]?0:8)).toString(16)).join('')).sort().join('|');
  function certificate(round) {
    let state=reset(round);if(round.extra)state=addBottle(state);const result=[];
    for(const step of round.route) {
      let remaining=step.amount;
      while(remaining>0&&!won(state)) {
        const move=plan(state,step.from,step.to);if(!move||move.amount>remaining)return null;
        result.push({state,move});state=pour(state,step.from,step.to);remaining-=move.amount;
      }
      if(won(state))break;
    }
    return won(state)?result:null;
  }
  function legalMoves(round) {
    const moves=[];
    for(let from=0;from<round.tubes.length;from++) {
      let usedEmpty=false;
      for(let to=0;to<round.tubes.length;to++) {
        const move=plan(round,from,to);if(!move)continue;
        if(!round.tubes[to].length){if(usedEmpty)continue;usedEmpty=true;if(round.tubes[from].every(c=>c===move.color)&&round.known[from].every(Boolean))continue;}
        moves.push(move);
      }
    }
    return moves;
  }
  function heuristic(round) {
    let segments=0,mixed=0,hidden=0;
    round.tubes.forEach((tube,i)=>{if(!tube.length)return;segments++;for(let j=1;j<tube.length;j++)if(tube[j]!==tube[j-1])segments++;if(new Set(tube).size>1)mixed++;hidden+=round.known[i].filter(v=>!v).length;});
    return (segments-round.colors)*1.8+mixed*.25+hidden*.1;
  }
  function fallback(round) {
    let best=null,value=-Infinity;
    for(const move of legalMoves(round)){const next=pour(round,move.from,move.to);const score=(heuristic(round)-heuristic(next))*20+(round.tubes[move.to].length?5:0)+(complete(next.tubes[move.to])?20:0)+(next.tubes[move.from].length?0:3);if(score>value){value=score;best=move;}}
    return best?{...best,certified:false}:null;
  }
  function suggest(round,options={}) {
    if(won(round))return null;
    const key=exactKey(round),proof=certificate(round),known=proof?.find(step=>exactKey(step.state)===key);
    if(known)return {...known.move,certified:true};
    if(options.search===false)return fallback(round);
    const maxNodes=options.maxNodes??22000,budget=options.budgetMs??1100,start=Date.now(),heap=[],seen=new Map();
    function push(node){heap.push(node);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=node.f)break;heap[i]=heap[p];i=p;}heap[i]=node;}
    function pop(){const result=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].f<heap[child].f)child++;if(heap[child].f>=last.f)break;heap[i]=heap[child];i=child;}heap[i]=last;}return result;}
    push({state:round,g:0,f:heuristic(round),first:null});seen.set(canonicalKey(round),0);
    for(let count=0;heap.length&&count<maxNodes;count++) {
      if(count%128===0&&Date.now()-start>budget)break;
      const node=pop();if(won(node.state))return {...node.first,certified:true};
      if(seen.get(canonicalKey(node.state))<node.g)continue;
      for(const move of legalMoves(node.state)) {
        const state=pour(node.state,move.from,move.to),key=canonicalKey(state),g=node.g+1;
        if(seen.has(key)&&seen.get(key)<=g)continue;
        seen.set(key,g);push({state,g,f:g+heuristic(state),first:node.first||move});
      }
    }
    return fallback(round);
  }
  function stars(round) {
    if(!won(round))return 0;
    const par=Math.max(8,Math.ceil(round.route.length*.72));
    return round.extra||round.hints>2?1:round.hints||round.moves>par?2:3;
  }
  function valid(round) {
    if(!round||!Number.isInteger(round.level)||round.level<1||round.level>LEVELS||round.colors!==settings(round.level).colors||!integer(round.moves)||!integer(round.hints)||typeof round.extra!=='boolean')return false;
    const check=(tubes,known,length)=>Array.isArray(tubes)&&tubes.length===length&&tubes.every(t=>Array.isArray(t)&&t.length<=4&&t.every(c=>Number.isInteger(c)&&c>=1&&c<=round.colors))&&Array.isArray(known)&&known.length===length&&known.every((k,i)=>Array.isArray(k)&&k.length===tubes[i].length&&k.every(v=>typeof v==='boolean')&&(!k.length||k.at(-1)))&&Array.from({length:round.colors},(_,i)=>tubes.flat().filter(c=>c===i+1).length).every(count=>count===4);
    return check(round.tubes,round.known,round.colors+2+(round.extra?1:0))&&check(round.start,round.startKnown,round.colors+2)&&Array.isArray(round.route)&&round.route.length<=150&&round.route.every(move=>move&&integer(move.from)&&integer(move.to)&&move.from<round.colors+2&&move.to<round.colors+2&&move.from!==move.to&&Number.isInteger(move.amount)&&move.amount>=1&&move.amount<=4);
  }
  const api={LEVELS,COLORS,NAMES,SYMBOLS,settings,create,complete,won,plan,pour,addBottle,reset,certificate,legalMoves,suggest,stars,valid,exactKey};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PotionEngine=Object.freeze(api);
})(typeof window==='object'?window:globalThis);
