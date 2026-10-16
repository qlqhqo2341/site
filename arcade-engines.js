(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  function random(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value + 0x6D2B79F5) >>> 0;
      let t = value; t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(values, rng) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }
  function around(index, n) {
    const row = Math.floor(index / n), col = index % n;
    return [[row - 1, col], [row, col + 1], [row + 1, col], [row, col - 1]].filter(([r,c]) => r >= 0 && r < n && c >= 0 && c < n).map(([r,c]) => r * n + c);
  }
  function lightsToggle(board, n, index) {
    const next = [...board]; [index, ...around(index,n)].forEach(i => { next[i] ^= 1; }); return next;
  }
  function lightsSolve(board,n) {
    const size = n*n, rhs = 1n << BigInt(size), mask = rhs-1n;
    const rows = board.map((value,i) => [i,...around(i,n)].reduce((bits,j) => bits | (1n<<BigInt(j)), value ? rhs : 0n));
    const pivots = []; let rank = 0;
    for (let col = 0; col < size; col++) {
      const bit = 1n<<BigInt(col), pivot = rows.findIndex((row,index) => index >= rank && Boolean(row & bit));
      if (pivot < 0) continue;
      [rows[rank],rows[pivot]] = [rows[pivot],rows[rank]];
      for (let row=0;row<size;row++) if (row !== rank && (rows[row]&bit)) rows[row] ^= rows[rank];
      pivots.push(col); rank++;
    }
    if (rows.some(row => !(row&mask) && Boolean(row&rhs))) return null;
    let base = 0n;
    pivots.forEach((col,row) => { if (rows[row]&rhs) base |= 1n<<BigInt(col); });
    const free = Array.from({length:size},(_,i)=>i).filter(i=>!pivots.includes(i));
    const basis = free.map(col => {
      let bits = 1n<<BigInt(col);
      pivots.forEach((pivot,row) => { if (rows[row]&(1n<<BigInt(col))) bits |= 1n<<BigInt(pivot); });
      return bits;
    });
    let best = base, weight = size+1;
    for (let choice=0;choice<2**basis.length;choice++) {
      let bits=base; basis.forEach((vector,j)=>{if(choice&(1<<j))bits^=vector;});
      let count=0, copy=bits; while(copy){copy&=copy-1n;count++;}
      if(count<weight){weight=count;best=bits;}
    }
    return Array.from({length:size},(_,i)=>i).filter(i=>Boolean(best&(1n<<BigInt(i))));
  }
  const lights = {
    create(n,seed) {
      const rng=random(seed);let board=Array(n*n).fill(0);
      for(let i=0;i<n*n;i++)if(rng()<.52)board=lightsToggle(board,n,i);
      if(board.every(v=>!v))board=lightsToggle(board,n,0);
      return {n,board,start:[...board],moves:0,hints:0,optimal:lightsSolve(board,n).length};
    },
    act(state,index) { if(!integer(index)||index>=state.n**2||this.won(state))return null;return {...clone(state),board:lightsToggle(state.board,state.n,index),moves:state.moves+1}; },
    won: state => state.board.every(v=>!v),
    solve: state => lightsSolve(state.board,state.n),
    valid(s) { return Boolean(s&&[4,5,6].includes(s.n)&&[s.board,s.start].every(a=>Array.isArray(a)&&a.length===s.n**2&&a.every(v=>v===0||v===1))&&integer(s.moves)&&integer(s.hints)&&integer(s.optimal)&&s.optimal>0&&s.optimal<=s.n**2&&lightsSolve(s.board,s.n)!==null&&lightsSolve(s.start,s.n)!==null); }
  };
  function waterWon(tubes) { return tubes.every(tube=>!tube.length||(tube.length===4&&tube.every(v=>v===tube[0]))); }
  function waterPour(tubes,from,to) {
    if(!integer(from)||!integer(to)||from>=tubes.length||to>=tubes.length||from===to)return null;
    const a=tubes[from],b=tubes[to];if(!a.length||b.length===4||(b.length&&b.at(-1)!==a.at(-1)))return null;
    const color=a.at(-1);let count=0;for(let i=a.length-1;i>=0&&a[i]===color;i--)count++;
    count=Math.min(count,4-b.length);const next=tubes.map(t=>[...t]);next[from].splice(-count);next[to].push(...Array(count).fill(color));return next;
  }
  const water = {
    create(n,seed) {
      const rng=random(seed),tubes=Array.from({length:n+2},(_,i)=>i<n?Array(4).fill(i+1):[]), reverse=[];
      for(let step=0;step<35+n*9;step++) {
        const options=[];
        tubes.forEach((source,from)=>{
          if(!source.length)return;const color=source.at(-1);let run=0;for(let i=source.length-1;i>=0&&source[i]===color;i--)run++;
          tubes.forEach((dest,to)=>{
            if(from===to||dest.length===4||dest.at(-1)===color)return;
            const max=Math.min(run,4-dest.length);
            for(let count=1;count<=max;count++) {
              if(count===run&&source.length>run)continue;
              if(!dest.length&&count===source.length)continue;
              options.push({from,to,count,weight:dest.length?3:1});
            }
          });
        });
        if(!options.length)break;
        const weighted=options.flatMap(option=>Array(option.weight).fill(option));const pick=weighted[Math.floor(rng()*weighted.length)];
        const color=tubes[pick.from].at(-1);tubes[pick.from].splice(-pick.count);tubes[pick.to].push(...Array(pick.count).fill(color));reverse.push({from:pick.to,to:pick.from});
      }
      return {n,tubes,start:clone(tubes),solution:reverse.reverse(),moves:0};
    },
    act(state,from,to) {if(this.won(state))return null;const tubes=waterPour(state.tubes,from,to);return tubes?{...clone(state),tubes,moves:state.moves+1}:null;},
    won: state => waterWon(state.tubes),
    pour: waterPour,
    valid(s) {
      if(!s||![4,5,6].includes(s.n)||!integer(s.moves)||!Array.isArray(s.solution)||s.solution.length>150||!s.solution.every(p=>p&&integer(p.from)&&integer(p.to)&&p.from<s.n+2&&p.to<s.n+2))return false;
      return [s.tubes,s.start].every(tubes=>Array.isArray(tubes)&&tubes.length===s.n+2&&tubes.every(t=>Array.isArray(t)&&t.length<=4&&t.every(v=>integer(v)&&v>=1&&v<=s.n))&&Array.from({length:s.n},(_,i)=>tubes.flat().filter(v=>v===i+1).length).every(count=>count===4));
    }
  };
  const number = {
    create(n,seed) {
      const rng=random(seed),board=Array.from({length:n*n},(_,i)=>(i+1)%(n*n));let blank=board.length-1,previous=-1;
      for(let step=0;step<(n===3?65:150);step++){const choices=around(blank,n).filter(i=>i!==previous),pick=choices[Math.floor(rng()*choices.length)];[board[blank],board[pick]]=[board[pick],board[blank]];previous=blank;blank=pick;}
      if(board.every((v,i)=>v===(i+1)%(n*n))){const pick=around(blank,n)[0];[board[blank],board[pick]]=[board[pick],board[blank]];}
      return {n,board,start:[...board],moves:0};
    },
    act(state,index) {const blank=state.board.indexOf(0);if(this.won(state)||!around(blank,state.n).includes(index))return null;const board=[...state.board];[board[index],board[blank]]=[board[blank],board[index]];return {...clone(state),board,moves:state.moves+1};},
    won: s=>s.board.every((v,i)=>v===(i+1)%(s.n*s.n)),
    distance(s) {return s.board.reduce((sum,v,i)=>v?sum+Math.abs(Math.floor(i/s.n)-Math.floor((v-1)/s.n))+Math.abs(i%s.n-(v-1)%s.n):sum,0);},
    valid(s) {
      if(!s||![3,4].includes(s.n)||!integer(s.moves))return false;
      return [s.board,s.start].every(a=>{
        if(!Array.isArray(a)||a.length!==s.n*s.n||new Set(a).size!==a.length||!a.every(v=>integer(v)&&v<a.length))return false;
        const values=a.filter(Boolean);let inversions=0;for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++)if(values[i]>values[j])inversions++;
        return s.n%2?inversions%2===0:(inversions+s.n-Math.floor(a.indexOf(0)/s.n))%2===1;
      });
    }
  };
  const memory = {
    create(pairs,seed) {const deck=shuffle(Array.from({length:pairs*2},(_,i)=>i%pairs),random(seed));return {pairs,deck,matched:Array(pairs*2).fill(false),open:[],moves:0,peeks:0};},
    act(state,index) {
      if(!integer(index)||index>=state.deck.length||this.won(state)||state.matched[index]||state.open.includes(index)||state.open.length===2)return null;
      const next=clone(state);next.open.push(index);
      if(next.open.length===2){next.moves++;const[a,b]=next.open;if(next.deck[a]===next.deck[b]){next.matched[a]=true;next.matched[b]=true;next.open=[];}}
      return next;
    },
    settle(state) {return {...clone(state),open:state.open.length===2?[]:[...state.open]};},
    won: s=>s.matched.every(Boolean),
    valid(s) {
      return Boolean(s&&[8,10,12].includes(s.pairs)&&Array.isArray(s.deck)&&s.deck.length===s.pairs*2&&s.deck.every(v=>integer(v)&&v<s.pairs)&&Array.from({length:s.pairs},(_,i)=>s.deck.filter(v=>v===i).length).every(n=>n===2)&&Array.isArray(s.matched)&&s.matched.length===s.deck.length&&s.matched.every(v=>typeof v==='boolean')&&s.deck.every((v,i)=>s.matched[i]===s.matched[s.deck.lastIndexOf(v)]&&s.matched[i]===s.matched[s.deck.indexOf(v)])&&Array.isArray(s.open)&&s.open.length<=2&&new Set(s.open).size===s.open.length&&s.open.every(i=>integer(i)&&i<s.deck.length&&!s.matched[i])&&integer(s.moves)&&[0,1].includes(s.peeks));
    }
  };
  const DIRECTIONS=[[-1,0,1,4],[0,1,2,8],[1,0,4,1],[0,-1,8,2]];
  const rotate = mask => ((mask<<1)&15)|((mask>>3)&1);
  function connections(board,n,source) {
    const found=new Set([source]),queue=[source];let leaks=0;
    for(let head=0;head<queue.length;head++) {
      const index=queue[head],r=Math.floor(index/n),c=index%n;
      for(const[dy,dx,bit,opposite]of DIRECTIONS)if(board[index]&bit){const y=r+dy,x=c+dx,to=y*n+x;if(y<0||y>=n||x<0||x>=n||!(board[to]&opposite)){leaks++;continue;}if(!found.has(to)){found.add(to);queue.push(to);}}
    }
    return {indices:[...found],count:found.size,leaks};
  }
  const pipes = {
    create(n,seed) {
      const rng=random(seed),solution=Array(n*n).fill(0),source=Math.floor(n/2)*n+Math.floor(n/2),visited=new Set([source]),stack=[source];
      while(stack.length){const i=stack.at(-1),r=Math.floor(i/n),c=i%n;const options=DIRECTIONS.filter(([dy,dx])=>r+dy>=0&&r+dy<n&&c+dx>=0&&c+dx<n&&!visited.has((r+dy)*n+c+dx));if(!options.length){stack.pop();continue;}const[dy,dx,bit,opposite]=options[Math.floor(rng()*options.length)],to=(r+dy)*n+c+dx;solution[i]|=bit;solution[to]|=opposite;visited.add(to);stack.push(to);}
      const board=solution.map(mask=>{for(let t=Math.floor(rng()*4);t>0;t--)mask=rotate(mask);return mask;});
      if(connections(board,n,source).count===n*n){const i=board.findIndex(mask=>mask!==15);board[i]=rotate(board[i]);}
      return {n,source,solution,board,start:[...board],moves:0,hints:0};
    },
    act(state,index) {if(!integer(index)||index>=state.board.length||this.won(state))return null;const next=clone(state);next.board[index]=rotate(next.board[index]);next.moves++;return next;},
    hint(state) {const index=state.board.findIndex((v,i)=>v!==state.solution[i]);if(index<0||this.won(state))return null;const next=clone(state);next.board[index]=next.solution[index];next.moves++;next.hints++;return {state:next,index};},
    connections: s=>connections(s.board,s.n,s.source),
    won: s=>connections(s.board,s.n,s.source).count===s.n*s.n,
    rotate,
    valid(s) {
      if(!s||![4,5,6].includes(s.n)||!integer(s.moves)||!integer(s.hints)||!integer(s.source)||s.source>=s.n*s.n||![s.board,s.start,s.solution].every(a=>Array.isArray(a)&&a.length===s.n*s.n&&a.every(v=>integer(v)&&v>=1&&v<=15)))return false;
      if(connections(s.solution,s.n,s.source).count!==s.n*s.n||connections(s.solution,s.n,s.source).leaks)return false;
      return [s.board,s.start].every(a=>a.every((v,i)=>{let mask=s.solution[i];for(let k=0;k<4;k++){if(mask===v)return true;mask=rotate(mask);}return false;}));
    }
  };
  const engines={lights,water,number,memory,pipes};
  if(typeof module==='object'&&module.exports)module.exports=engines;
  else root.ArcadeEngines=Object.freeze(engines);
})(typeof window==='object'?window:globalThis);
