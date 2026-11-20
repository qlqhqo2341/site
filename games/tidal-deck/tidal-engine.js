(function(root){
  'use strict';
  const HANDS=[
    {id:'high',name:'하이 카드',chips:12,mult:1,growth:12},
    {id:'pair',name:'원 페어',chips:20,mult:2,growth:18},
    {id:'two',name:'투 페어',chips:32,mult:3,growth:20},
    {id:'three',name:'트리플',chips:40,mult:3,growth:22},
    {id:'straight',name:'스트레이트',chips:45,mult:4,growth:25},
    {id:'flush',name:'플러시',chips:50,mult:4,growth:25},
    {id:'full',name:'풀 하우스',chips:60,mult:5,growth:28},
    {id:'four',name:'포 카드',chips:90,mult:7,growth:35},
    {id:'royal',name:'스트레이트 플러시',chips:120,mult:8,growth:40}
  ];
  const RELICS=[
    {id:'coral',name:'작은 산호',text:'모든 핸드에 배수 +2',price:4,icon:'coral'},
    {id:'pearl',name:'새벽 진주',text:'모든 핸드에 칩 +45',price:5,icon:'pearl'},
    {id:'twins',name:'쌍둥이 조개',text:'원 페어·투 페어에 배수 +5',price:5,icon:'shell'},
    {id:'reef',name:'붉은 해초',text:'점수에 쓰인 ♥·♦ 한 장마다 배수 +3',price:6,icon:'weed'},
    {id:'ink',name:'밤빛 잉크',text:'점수에 쓰인 ♠·♣ 한 장마다 배수 +3',price:6,icon:'ink'},
    {id:'lantern',name:'잠수등',text:'카드를 3장 이하로 내면 배수 +7',price:6,icon:'lantern'},
    {id:'current',name:'유리 해파리',text:'카드를 5장 내면 최종 배수 ×1.6',price:7,icon:'jelly'},
    {id:'crown',name:'가라앉은 왕관',text:'점수에 쓰인 J·Q·K 한 장마다 배수 +6',price:7,icon:'crown'},
    {id:'echo',name:'고래의 메아리',text:'이번 항해에서 낸 적 있는 족보면 최종 배수 ×1.7',price:7,icon:'whale'},
    {id:'compass',name:'별의 나침반',text:'스트레이트·플러시 계열에 칩 +70',price:5,icon:'compass'},
    {id:'shell',name:'소라의 노래',text:'남은 버리기 횟수마다 배수 +2',price:6,icon:'spiral'},
    {id:'anchor',name:'은빛 닻',text:'이번 수 뒤에 남는 핸드마다 칩 +25',price:5,icon:'anchor'},
    {id:'foam',name:'물거품 렌즈',text:'족보에 포함되지 않은 카드도 칩·유물 계산에 사용',price:5,icon:'bubbles'},
    {id:'moon',name:'산호빛 달',text:'점수 카드에 ♥와 ♦가 함께 있으면 최종 배수 ×1.7',price:7,icon:'moon'},
    {id:'treasure',name:'표류한 보물',text:'핸드를 낼 때마다 진주 2개 획득',price:4,icon:'chest'}
  ];
  const TARGETS=[180,360,650,1050,1700,2600,3800,5600,8500];
  const SUITS=[{symbol:'♠',name:'스페이드',red:false},{symbol:'♥',name:'하트',red:true},{symbol:'♣',name:'클로버',red:false},{symbol:'♦',name:'다이아몬드',red:true}];
  const copy=value=>JSON.parse(JSON.stringify(value));
  const card=id=>({id,rank:id%13+2,suit:Math.floor(id/13)});
  const points=id=>{const rank=card(id).rank;return rank===14?11:Math.min(rank,10);};
  const face=id=>card(id).rank>=11&&card(id).rank<=13;
  const rankName=id=>({11:'J',12:'Q',13:'K',14:'A'}[card(id).rank]||String(card(id).rank));
  function hash(seed){let n=2166136261;for(const c of String(seed))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0||1;}
  function random(run){let n=run.rng;n^=n<<13;n^=n>>>17;n^=n<<5;run.rng=n>>>0;return run.rng/4294967296;}
  function shuffled(run,values){const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(random(run)*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
  function deal(run){while(run.hand.length<8&&run.deck.length)run.hand.push(run.deck.pop());}
  function condition(round){
    return round===2?{name:'탁류',text:'이번 라운드는 총 배수 −2',type:'mult'}:round===5?{name:'거센 조류',text:'이번 라운드는 버리기 2회',type:'discard'}:round===8?{name:'심해의 수압',text:'이번 라운드는 카드 자체의 칩이 절반',type:'chips'}:null;
  }
  function begin(run){run.phase='play';run.score=0;run.hands=4;run.discards=run.round===5?2:3;run.hand=[];run.spent=[];run.deck=shuffled(run,Array.from({length:52},(_,i)=>i));run.shop=null;run.last=null;run.reward=null;deal(run);return run;}
  function create(seed='voyage',mode='free'){return begin({version:1,seed:String(seed).slice(0,80),mode:mode==='daily'?'daily':'free',rng:hash(seed),round:0,coins:4,relics:['coral'],levels:Array(9).fill(0),played:Array(9).fill(0),stats:{hands:0,discards:0,best:0,total:0}});}
  function evaluate(ids){
    if(!Array.isArray(ids)||ids.length<1||ids.length>5||ids.some(id=>!Number.isInteger(id)||id<0||id>51)||new Set(ids).size!==ids.length)return null;
    const groups=new Map();for(const id of ids){const rank=card(id).rank;if(!groups.has(rank))groups.set(rank,[]);groups.get(rank).push(id);}
    const ordered=[...groups].sort((a,b)=>b[1].length-a[1].length||b[0]-a[0]);
    const ranks=[...groups.keys()].sort((a,b)=>a-b),flush=ids.length===5&&ids.every(id=>card(id).suit===card(ids[0]).suit);
    const straight=ids.length===5&&ranks.length===5&&(ranks[4]-ranks[0]===4||ranks.join(',')==='2,3,4,5,14');
    let type=0,scoring;
    if(straight&&flush)type=8;else if(ordered[0][1].length===4)type=7;else if(ordered[0][1].length===3&&ordered[1]?.[1].length===2)type=6;else if(flush)type=5;else if(straight)type=4;else if(ordered[0][1].length===3)type=3;else if(ordered[0][1].length===2&&ordered[1]?.[1].length===2)type=2;else if(ordered[0][1].length===2)type=1;
    if([4,5,6,8].includes(type))scoring=[...ids];else if(type===2)scoring=ordered.slice(0,2).flatMap(g=>g[1]);else scoring=[...ordered[0][1]];
    return {type,scoring};
  }
  function selection(run,ids){return run?.phase==='play'&&Array.isArray(ids)&&ids.length>=1&&ids.length<=5&&new Set(ids).size===ids.length&&ids.every(id=>run.hand.includes(id));}
  function quote(run,ids){
    if(!selection(run,ids))return null;
    const hand=evaluate(ids),base=HANDS[hand.type],level=run.levels[hand.type];
    const scoring=run.relics.includes('foam')?[...ids]:hand.scoring;
    const pressure=run.round===8?.5:1,cardChips=scoring.reduce((sum,id)=>sum+points(id),0)*pressure;
    let chips=base.chips+base.growth*level+cardChips,mult=base.mult+level,factor=1,bonusCoins=0;
    const effects=[{name:base.name,detail:`Lv.${level+1} · ${base.chips+base.growth*level} 칩 × ${base.mult+level} 배수`},{name:'카드 칩',detail:`+${cardChips}${pressure<1?' · 수압으로 절반':''}`}];
    function bonus(id,c,m,x=1){if(!c&&!m&&x===1)return;const relic=RELICS.find(r=>r.id===id);chips+=c;mult+=m;factor*=x;effects.push({name:relic.name,detail:[c?`칩 +${c}`:'',m?`배수 +${m}`:'',x!==1?`최종 배수 ×${x}`:''].filter(Boolean).join(' · ')});}
    for(const id of run.relics){
      if(id==='coral')bonus(id,0,2);
      if(id==='pearl')bonus(id,45,0);
      if(id==='twins'&&[1,2].includes(hand.type))bonus(id,0,5);
      if(id==='reef')bonus(id,0,3*scoring.filter(c=>SUITS[card(c).suit].red).length);
      if(id==='ink')bonus(id,0,3*scoring.filter(c=>!SUITS[card(c).suit].red).length);
      if(id==='lantern'&&ids.length<=3)bonus(id,0,7);
      if(id==='current'&&ids.length===5)bonus(id,0,0,1.6);
      if(id==='crown')bonus(id,0,6*scoring.filter(face).length);
      if(id==='echo'&&run.played[hand.type]>0)bonus(id,0,0,1.7);
      if(id==='compass'&&[4,5,8].includes(hand.type))bonus(id,70,0);
      if(id==='shell')bonus(id,0,2*run.discards);
      if(id==='anchor')bonus(id,25*Math.max(0,run.hands-1),0);
      if(id==='moon'&&scoring.some(c=>card(c).suit===1)&&scoring.some(c=>card(c).suit===3))bonus(id,0,0,1.7);
      if(id==='foam')effects.push({name:'물거품 렌즈',detail:'선택한 카드 전부 계산'});
      if(id==='treasure'){bonusCoins+=2;effects.push({name:'표류한 보물',detail:'진주 +2'});}
    }
    if(run.round===2){mult-=2;effects.push({name:'탁류',detail:'총 배수 −2 · 최소 1'});}
    mult=Math.round(Math.max(1,mult)*factor*1000)/1000;
    return {type:hand.type,scoring,chips,mult,score:Math.floor(chips*mult+1e-7),effects,bonusCoins};
  }
  function offers(run){
    const available=RELICS.filter(r=>!run.relics.includes(r.id));
    return [...shuffled(run,available).slice(0,2).map(r=>({kind:'relic',id:r.id,cost:r.price,sold:false})),...shuffled(run,HANDS.map((_,i)=>i).filter(i=>run.levels[i]<10)).slice(0,2).map(i=>({kind:'level',id:i,cost:3+Math.floor(run.levels[i]/2),sold:false}))];
  }
  function play(run,ids){
    const q=quote(run,ids);if(!q)return null;
    const next=copy(run);next.hand=next.hand.filter(id=>!ids.includes(id));next.spent.push(...ids);next.hands--;next.score+=q.score;next.coins+=q.bonusCoins;next.played[q.type]++;next.stats.hands++;next.stats.total+=q.score;next.stats.best=Math.max(next.stats.best,q.score);next.last={...q,cards:[...ids]};deal(next);
    if(next.score>=TARGETS[next.round]){
      const reward={base:4,spare:next.hands,interest:Math.min(3,Math.floor(next.coins/5)),boss:(next.round+1)%3===0?2:0};
      reward.total=reward.base+reward.spare+reward.interest+reward.boss;next.coins+=reward.total;next.reward=reward;
      if(next.round===8)next.phase='won';else{next.phase='shop';next.shop={offers:offers(next),rolls:0};}
    }else if(!next.hands)next.phase='lost';
    return next;
  }
  function discard(run,ids){
    if(!selection(run,ids)||!run.discards)return null;
    const next=copy(run);next.discards--;next.stats.discards++;next.hand=next.hand.filter(id=>!ids.includes(id));next.spent.push(...ids);deal(next);return next;
  }
  function buy(run,index){
    if(run?.phase!=='shop'||!Number.isInteger(index))return null;
    const offer=run.shop.offers[index];if(!offer||offer.sold||run.coins<offer.cost||offer.kind==='relic'&&(run.relics.length>=4||run.relics.includes(offer.id)))return null;
    const next=copy(run);next.coins-=offer.cost;next.shop.offers[index].sold=true;
    if(offer.kind==='relic')next.relics.push(offer.id);else next.levels[offer.id]++;
    return next;
  }
  function sell(run,id){if(run?.phase!=='shop'||!run.relics.includes(id))return null;const next=copy(run);next.relics=next.relics.filter(r=>r!==id);next.coins+=Math.floor(RELICS.find(r=>r.id===id).price/2);return next;}
  function reroll(run){if(run?.phase!=='shop'||run.coins<2+run.shop.rolls)return null;const next=copy(run);next.coins-=2+next.shop.rolls;next.shop.rolls++;next.shop.offers=offers(next);return next;}
  function advance(run){if(run?.phase!=='shop'||run.round>=8)return null;const next=copy(run);next.round++;return begin(next);}
  function valid(run){
    try{
      const int=(n,max=1e12)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
      if(!run||run.version!==1||typeof run.seed!=='string'||run.seed.length>80||!['free','daily'].includes(run.mode)||!int(run.rng,4294967295)||!int(run.round,8)||!['play','shop','won','lost'].includes(run.phase)||!int(run.score)||!int(run.coins)||!int(run.hands,4)||!int(run.discards,3))return false;
      if(!Array.isArray(run.relics)||run.relics.length>4||new Set(run.relics).size!==run.relics.length||run.relics.some(id=>!RELICS.some(r=>r.id===id)))return false;
      if(!Array.isArray(run.levels)||run.levels.length!==9||run.levels.some(n=>!int(n,10))||!Array.isArray(run.played)||run.played.length!==9||run.played.some(n=>!int(n,36)))return false;
      if(![run.deck,run.hand,run.spent].every(Array.isArray)||run.hand.length>8)return false;
      const all=[...run.deck,...run.hand,...run.spent];if(all.length!==52||new Set(all).size!==52||all.some(id=>!int(id,51)))return false;
      if(!run.stats||!['hands','discards','best','total'].every(key=>int(run.stats[key])))return false;
      if(run.last!==null){
        const last=run.last,hand=evaluate(last?.cards);
        if(!hand||last.type!==hand.type||!int(last.score)||!Number.isFinite(last.chips)||last.chips<0||!Number.isFinite(last.mult)||last.mult<1||Math.floor(last.chips*last.mult+1e-7)!==last.score||!int(last.bonusCoins,2))return false;
        if(!Array.isArray(last.scoring)||!last.scoring.length||last.scoring.some(id=>!last.cards.includes(id))||last.cards.some(id=>!run.spent.includes(id)))return false;
        if(!Array.isArray(last.effects)||last.effects.length>20||last.effects.some(e=>!e||typeof e.name!=='string'||typeof e.detail!=='string'||e.name.length>60||e.detail.length>100))return false;
      }
      if(run.reward!==null&&(!run.reward||!['base','spare','interest','boss','total'].every(key=>int(run.reward[key],20))||run.reward.total!==run.reward.base+run.reward.spare+run.reward.interest+run.reward.boss))return false;
      if(['shop','won'].includes(run.phase)&&!run.reward)return false;
      if(run.phase==='play'&&(!run.hands||run.score>=TARGETS[run.round]))return false;
      if(run.phase==='lost'&&(run.hands!==0||run.score>=TARGETS[run.round]))return false;
      if(run.phase==='won'&&(run.round!==8||run.score<TARGETS[8]))return false;
      if(run.phase==='shop'){
        if(run.round===8||run.score<TARGETS[run.round]||!run.shop||!int(run.shop.rolls,100)||!Array.isArray(run.shop.offers)||run.shop.offers.length>4)return false;
        if(run.shop.offers.some(o=>!o||!int(o.cost,20)||typeof o.sold!=='boolean'||(o.kind==='relic'?!RELICS.some(r=>r.id===o.id):o.kind==='level'?!int(o.id,8):true)))return false;
      }
      return true;
    }catch{return false;}
  }
  const api={HANDS,RELICS,TARGETS,SUITS,card,points,face,rankName,create,evaluate,quote,play,discard,buy,sell,reroll,advance,condition,valid};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TidalEngine=api;
})(typeof window==='object'?window:globalThis);
