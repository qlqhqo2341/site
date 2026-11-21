(function(){
  'use strict';
  const E=window.TidalEngine,A=window.TidalArt,$=id=>document.getElementById(id),KEY='little-arcade:tidal:v1';
  const number=value=>Number(value).toLocaleString('ko-KR',{maximumFractionDigits:3});
  const descriptions=['가장 높은 카드 한 장','같은 숫자 2장','같은 숫자 2장씩 두 쌍','같은 숫자 3장','연속된 숫자 5장','같은 무늬 5장','트리플 + 원 페어','같은 숫자 4장','같은 무늬의 연속 숫자 5장'];
  const depthNames=['산호 정원','푸른 침묵','별 없는 바다'];
  let data={version:1,run:null,records:{best:0,wins:0,runs:0},sound:false},selected=new Set(),sort='rank',busy=false,audio,timer,calculation=null,detailRelic=null;
  let activePress=null, lastTouch=null;
  const pressControls='#deck, #relics [data-relic]';
  const randomSeed=()=>{const values=new Uint32Array(2);if(window.crypto?.getRandomValues)crypto.getRandomValues(values);else{values[0]=Date.now();values[1]=Math.random()*4294967296;}return Array.from(values,n=>n.toString(36)).join('-');};
  const day=()=>{const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};
  try{
    const saved=JSON.parse(localStorage.getItem(KEY));
    if(saved?.version===1){
      if(E.valid(saved.run))data.run=saved.run;
      if(saved.records)for(const key of ['best','wins','runs'])if(Number.isSafeInteger(saved.records[key])&&saved.records[key]>=0)data.records[key]=saved.records[key];
      data.sound=saved.sound===true;
    }
  }catch{}
  if(!data.run)data.run=E.create(randomSeed());
  const run=()=>data.run;
  function save(){
    try{localStorage.setItem(KEY,JSON.stringify(data));localStorage.setItem('little-arcade:last',JSON.stringify({id:'tidal',at:Date.now()}));$('save-status').textContent='항해 자동 저장';}
    catch{$('save-status').textContent='이 환경에서는 자동 저장 불가';}
  }
  function sound(win=false){
    if(!data.sound)return;
    try{if(!audio){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;audio=new Context();}if(audio.state==='suspended')audio.resume().catch(()=>{});
      (win?[392,494,587]:[294]).forEach((hz,i)=>{const osc=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+i*.09;osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(.001,at);gain.gain.exponentialRampToValueAtTime(.04,at+.012);gain.gain.exponentialRampToValueAtTime(.001,at+.22);osc.connect(gain);gain.connect(audio.destination);osc.start(at);osc.stop(at+.25);});
    }catch{}
  }
  function message(text){$('notice').textContent=text;}
  function cardHTML(id,mini=false){
    const c=E.card(id),s=E.SUITS[c.suit],rank=E.rankName(id),name=`${s.name} ${rank==='A'?'에이스':rank}`;
    return `<${mini?'span':'button'} class="playing-card ${s.red?'red':''} ${E.face(id)?'court':''}" ${mini?`aria-label="${name}" data-played="${id}"`:`type="button" data-card="${id}" aria-label="${name}, ${E.points(id)}칩" aria-pressed="false"`}><span class="card-corner">${rank}<small>${s.symbol}</small></span><span class="card-pip" aria-hidden="true">${s.symbol}</span><span class="card-corner card-bottom" aria-hidden="true">${rank}<small>${s.symbol}</small></span>${mini?'':'<i class="score-dot" aria-hidden="true"></i>'}</${mini?'span':'button'}>`;
  }
  function refreshSelection(){
    const hand=E.evaluate([...selected]);
    for(const button of $('hand').querySelectorAll('[data-card]')){
      button.setAttribute('aria-pressed',String(selected.has(Number(button.dataset.card))));
      button.disabled=busy||run().phase!=='play';
    }
    $('selection-label').textContent=hand?`${selected.size}장 선택 · Lv.${run().levels[hand.type]+1}`:'1–5장을 골라 주세요';
    $('hand-name').textContent=hand?E.HANDS[hand.type].name:'선택한 족보 없음';
    $('play-count').textContent=`${selected.size} / 5`;
    $('play').disabled=busy||!hand;
    $('discard').disabled=busy||!hand||!run().discards;
    $('clear-selection').disabled=busy||!hand;
  }
  function renderHand(){
    const cards=[...run().hand].sort((a,b)=>sort==='suit'?E.card(a).suit-E.card(b).suit||E.card(b).rank-E.card(a).rank:E.card(b).rank-E.card(a).rank||E.card(a).suit-E.card(b).suit);
    $('hand').innerHTML=cards.map(id=>cardHTML(id)).join('');$('hand-count').textContent=cards.length;
    $('sort-rank').setAttribute('aria-pressed',String(sort==='rank'));$('sort-suit').setAttribute('aria-pressed',String(sort==='suit'));refreshSelection();
  }
  function renderRelics(){
    $('relic-count').textContent=`${run().relics.length} / 4`;
    $('sell-menu').hidden=run().phase!=='shop'||busy||!run().relics.length;
    $('relics').innerHTML=Array.from({length:4},(_,i)=>{const relic=E.RELICS.find(r=>r.id===run().relics[i]);return relic?`<button class="relic-slot" data-relic="${relic.id}" type="button" aria-label="${relic.name}: ${relic.text}">${A.icon(relic.icon)}<span>${relic.name}</span></button>`:'<div class="relic-slot empty">유물 자리</div>';}).join('');
  }
  function renderRoundScore(score){
    const pct=Math.min(100,Math.floor(score/E.TARGETS[run().round]*100));
    $('round-score').textContent=number(score);
    $('progress').setAttribute('aria-valuenow',pct);
    $('progress').querySelector('i').style.width=`${pct}%`;
  }
  function renderStats(){
    const r=run(),depth=Math.floor(r.round/3);
    $('depth-name').textContent=depthNames[depth];$('depth-label').textContent=`수심 ${(r.round+1)*100} m`;$('round-label').textContent=`${r.round+1} / 9`;
    $('target').textContent=number(E.TARGETS[r.round]);
    renderRoundScore(calculation?.banked===false?calculation.previousScore:r.score);
    const pending=calculation&&!calculation.banked;
    $('hands').textContent=r.hands;
    $('discards').textContent=r.discards;
    $('coins').textContent=pending?calculation.previousCoins:r.coins;
    const best=pending?calculation.previousBest:data.records.best;
    $('record').textContent=best?number(best):'—';
    $('route').innerHTML=E.TARGETS.map((target,i)=>`<i class="${i<r.round?'done':i===r.round?'current':''} ${(i+1)%3===0?'boss':''}" aria-label="${i+1}라운드${i===r.round?', 현재':''}${i<r.round?', 완료':''}"></i>`).join('');
    const condition=E.condition(r.round);$('condition').classList.toggle('boss-condition',Boolean(condition));$('condition').innerHTML=condition?`<b>특별 조건 · ${condition.name}</b>${condition.text}`:`<b>${(r.round+1)%3===2?'다음은 특별 라운드':'작은 항해 노트'}</b>${(r.round+1)%3===2?'유물을 챙기고, 한 수 앞을 준비해요.':'남은 핸드와 모아 둔 진주는 클리어 보상이 돼요.'}`;
    $('mode-label').textContent=r.mode==='daily'?`오늘의 도전 · ${r.seed.replace('daily:','')}`:'자유 항해';
    $('sound').textContent=data.sound?'소리 켜짐':'소리 꺼짐';$('sound').setAttribute('aria-pressed',String(data.sound));
  }
  function renderTable(){
    const r=run(),last=r.last;
    $('table-label').textContent=`${depthNames[Math.floor(r.round/3)]} · ${r.round+1}번째 잠수`;
    $('deck-count').textContent=r.deck.length;$('played-cards').innerHTML=last?.cards?.length?last.cards.map(id=>cardHTML(id,true)).join(''):'';
    $('table-message').textContent=calculation?E.HANDS[last.type].name:last?`${E.HANDS[last.type].name} · ${number(last.chips)} 칩 × ${number(last.mult)} 배수`:'서두르지 말고, 좋은 패를 골라요.';
    $('last-score').textContent=last&&!calculation?`+${number(last.score)}`:'';
    $('last-calculation').hidden=!last||busy;
  }
  function renderShop(){
    const r=run(),reward=r.reward;
    $('reward').innerHTML=reward?`<span>기본 ${reward.base} + 남은 핸드 ${reward.spare} + 이자 ${reward.interest}${reward.boss?` + 특별 보너스 ${reward.boss}`:''}</span><strong>진주 +${reward.total}</strong>`:'';
    $('shop-offers').innerHTML=r.shop.offers.map((offer,index)=>{
      const relic=offer.kind==='relic'?E.RELICS.find(r=>r.id===offer.id):null,hand=offer.kind==='level'?E.HANDS[offer.id]:null;
      const blocked=offer.sold||r.coins<offer.cost||(relic&&r.relics.length>=4);
      const title=relic?relic.name:hand.name;
      const text=relic?relic.text:`Lv.${r.levels[offer.id]+1} → ${r.levels[offer.id]+2}<br>기본 칩 +${hand.growth} · 배수 +1`;
      return `<article class="shop-card ${offer.sold?'sold':''}"><span class="offer-kind">${relic?'SEA RELIC':'HAND UPGRADE'}</span><div class="shop-art ${relic?'':'level-art'}">${relic?A.icon(relic.icon):'✧'}</div><h3>${title}</h3><p>${text}</p><button type="button" data-buy="${index}" ${blocked?'disabled':''} aria-label="${title} ${offer.sold?'구매 완료':offer.cost+' 진주로 구매'}">${offer.sold?'구매 완료':relic&&r.relics.length>=4?'유물 자리가 가득 찼어요':`${offer.cost} 진주 · 구매`}</button></article>`;
    }).join('');
    const price=2+r.shop.rolls;$('reroll').textContent=`새 상품 보기 · ${price} 진주`;$('reroll').disabled=r.coins<price;
    $('continue').textContent=`${r.round+2}라운드로 출발`;
  }
  function renderResult(){
    const r=run(),won=r.phase==='won';$('result-icon').innerHTML=A.icon(won?'crown':'anchor');$('result-kicker').textContent=won?'THE DEEP IS YOURS':'UNTIL THE NEXT TIDE';
    $('result-title').textContent=won?'심해의 끝에 닿았어요.':'오늘의 잠수는 여기까지.';
    $('result-copy').textContent=won?'작은 산호 하나로 시작한 항해가, 멋진 조합이 되었네요.':`${number(E.TARGETS[r.round]-r.score)}점이 모자랐어요. 다음에는 다른 유물 조합을 만나볼까요.`;
    $('result-round').textContent=`${r.round+1} / 9`;$('result-best').textContent=number(r.stats.best);$('result-total').textContent=number(r.stats.total);
    $('retry').textContent=r.mode==='daily'?'같은 오늘의 바다에 다시 도전':'새로운 덱으로 다시 항해';
  }
  function render(){
    hidePressTip();
    const phase=run().phase;$('play-zone').hidden=phase!=='play'&&!busy;$('shop-zone').hidden=phase!=='shop'||busy;$('result-zone').hidden=!['won','lost'].includes(phase)||busy;
    renderStats();renderRelics();renderTable();renderHand();
    if(phase==='shop'&&!busy)renderShop();if(['won','lost'].includes(phase)&&!busy)renderResult();
    for(const id of ['new-voyage','sort-rank','sort-suit','deck','help'])$(id).disabled=busy;
  }
  function focusPhase(){
    const id=run().phase==='shop'?'shop-title':['won','lost'].includes(run().phase)?'result-title':null;
    if(id){$(id).tabIndex=-1;$(id).focus();}
  }
  function commit(next){
    if(!next||busy)return false;
    const before=run().phase;
    data.run=next;
    selected.clear();
    data.records.best=Math.max(data.records.best,next.stats.best);
    if(before==='play'&&['won','lost'].includes(next.phase)){
      data.records.runs++;
      if(next.phase==='won')data.records.wins++;
    }
    save();
    busy=Boolean(calculation);
    render();
    if(!calculation){
      if(next.phase!==before)focusPhase();
      sound();
    }
    return true;
  }
  function highlightScoreSource(step){
    document.querySelectorAll('.score-source').forEach(element=>element.classList.remove('score-source'));
    if(step.cardId!==undefined){
      const card=$('played-cards').querySelector(`[data-played="${step.cardId}"]`);
      if(card){card.dataset.gain=step.detail.split(' · ')[0];card.classList.add('score-source','counted');}
    }
    if(step.relicId)$('relics').querySelector(`[data-relic="${step.relicId}"]`)?.classList.add('score-source');
  }
  function showScoreStep(index){
    const {steps,previousScore}=calculation;
    const {last,score}=run();
    const step=steps[index];
    highlightScoreSource(step||{});
    $('chip-value').textContent=number(step?.chips??last.chips);
    $('mult-value').textContent=number(step?.mult??last.mult);
    const panel=$('score-panel');
    delete panel.dataset.tone;
    void panel.offsetWidth;
    if(step){
      panel.dataset.tone=step.kind;
      $('hand-name').textContent=step.name;
      $('step-detail').textContent=step.detail;
      timer=setTimeout(()=>showScoreStep(index+1),step.kind==='chips'&&step.cardId!==undefined?250:380);
      return;
    }
    $('hand-name').textContent=E.HANDS[last.type].name;
    if(index===steps.length){
      panel.dataset.tone='pending';
      $('step-detail').textContent='칩 × 배수';
      timer=setTimeout(()=>showScoreStep(index+1),460);
      return;
    }
    if(index===steps.length+1){
      $('hand-score').textContent=number(last.score);
      $('last-score').textContent=`+${number(last.score)}`;
      panel.dataset.tone='total';
      $('step-detail').textContent=`${number(last.chips)} × ${number(last.mult)} = ${number(last.score)}`;
      sound(run().phase==='shop'||run().phase==='won');
      timer=setTimeout(()=>showScoreStep(index+1),660);
      return;
    }
    calculation.banked=true;
    panel.dataset.tone='bank';
    $('step-detail').textContent=`라운드 점수 ${number(previousScore)} + ${number(last.score)} = ${number(score)}`;
    renderStats();
    timer=setTimeout(finishScoring,740);
  }
  function finishScoring({focus=true}={}){
    if(!calculation)return;
    clearTimeout(timer);
    const focusCard=calculation.restoreFocus;
    calculation=null;
    busy=false;
    $('score-panel').classList.remove('is-scoring');
    delete $('score-panel').dataset.tone;
    $('score-step').hidden=true;
    $('score-equation').hidden=true;
    $('hand-score').textContent='?';
    render();
    if(focus){
      focusPhase();
      if(focusCard&&run().phase==='play')$('hand').querySelector('[data-card]')?.focus({preventScroll:true});
    }
    const {phase,last,reward}=run();
    const gained=`${E.HANDS[last.type].name} ${number(last.score)}점`;
    if(phase==='shop')message(`${gained}. 목표 달성! 진주 ${reward.total}개를 받았어요.`);
    else if(phase==='won')message(`${gained}. 9라운드를 모두 통과했어요!`);
    else message(`${gained}을 모았어요.${last.bonusCoins?' 진주 +'+last.bonusCoins:''}`);
  }
  function playSelected(){
    if(busy)return;
    const ids=[...selected];
    const quote=E.quote(run(),ids,{withSteps:true});
    if(!quote)return;
    const next=E.play(run(),ids);
    calculation={
      steps:quote.steps,previousScore:run().score,previousCoins:run().coins,
      previousBest:data.records.best,banked:false,
      restoreFocus:document.activeElement===$('play')&&$('play').matches(':focus-visible')
    };
    commit(next);
    message('');
    $('score-panel').classList.add('is-scoring');
    $('score-step').hidden=false;
    $('selection-label').textContent='점수 계산';
    $('score-equation').hidden=false;
    $('hand-score').textContent='?';
    showScoreStep(0);
  }
  function start(mode){
    if(busy)return;
    selected.clear();
    data.run=E.create(mode==='daily'?'daily:'+day():randomSeed(),mode);save();$('voyage-dialog').close();render();message(mode==='daily'?`${day()}의 덱이에요. 같은 선택은 같은 결과로 이어져요.`:'새로운 바다가 열렸어요. 카드를 골라 보세요.');
  }
  function showHelp(){
    $('hand-guide').innerHTML=E.HANDS.map((hand,i)=>`<div class="guide-row"><b>${hand.name}<br><span>Lv.${run().levels[i]+1}</span></b><span>${descriptions[i]}</span><span>${number(hand.chips+run().levels[i]*hand.growth)} 칩<br>× ${hand.mult+run().levels[i]} 배수</span></div>`).reverse().join('');
    $('help-dialog').showModal();
  }
  $('hand').addEventListener('click',event=>{
    const button=event.target.closest('[data-card]');if(!button||busy||run().phase!=='play')return;const id=Number(button.dataset.card);
    if(selected.has(id))selected.delete(id);else{if(selected.size===5){message('한 번에 최대 5장까지 고를 수 있어요.');return;}selected.add(id);}
    message('');refreshSelection();
  });
  $('clear-selection').addEventListener('click',()=>{selected.clear();refreshSelection();});
  $('play').addEventListener('click',playSelected);
  $('discard').addEventListener('click',()=>{const count=selected.size;if(commit(E.discard(run(),[...selected]))){message(`${count}장을 바꾸었어요. 핸드는 그대로예요.`);$('hand').classList.remove('dealing');void $('hand').offsetWidth;$('hand').classList.add('dealing');}});
  for(const type of ['rank','suit'])$('sort-'+type).addEventListener('click',()=>{sort=type;renderHand();});
  $('shop-offers').addEventListener('click',event=>{const button=event.target.closest('[data-buy]');if(button){const next=E.buy(run(),Number(button.dataset.buy));if(commit(next))message('새로운 조합이 준비됐어요. 다음 수심에서 사용해 보세요.');}});
  $('reroll').addEventListener('click',()=>{if(commit(E.reroll(run())))message('정박지에 새 상품이 도착했어요.');});
  $('continue').addEventListener('click',()=>{if(commit(E.advance(run())))message('패와 덱을 새로 섞었어요. 유물과 족보 레벨은 그대로예요.');});
  function relicById(id){return E.RELICS.find(relic=>relic.id===id);}
  function relicSellPrice(relic){return Math.floor(relic.price/2);}
  function showRelicDetails(relic){
    detailRelic=relic.id;
    $('detail-kicker').textContent='RELIC COLLECTION';
    $('detail-title').textContent=relic.name;
    $('detail-content').innerHTML=A.icon(relic.icon)+`<p>${relic.text}</p>`;
    $('sell-relic').hidden=run().phase!=='shop';
    $('sell-relic').textContent=`${relicSellPrice(relic)} 진주에 팔기`;
    if(!$('detail-dialog').open)$('detail-dialog').showModal();
    else $('sell-relic').focus();
  }
  function deckInfo(){
    const {deck,hand,spent}=run();
    const counts=Array(E.SUITS.length).fill(0);
    for(const id of deck)counts[E.card(id).suit]++;
    return {counts,summary:`남은 덱 ${deck.length}장 · 손패 ${hand.length}장 · 이미 사용한 카드 ${spent.length}장`};
  }
  function showDeckDetails(){
    const {counts,summary}=deckInfo();
    $('detail-kicker').textContent='BELOW THE SURFACE';
    $('detail-title').textContent='아직 만나지 않은 카드';
    $('detail-content').innerHTML=`<p>${summary}</p><div class="deck-grid">${E.SUITS.map((s,i)=>`<div>${s.symbol} ${s.name}<br><strong>${counts[i]}장</strong></div>`).join('')}</div><p class="help-foot">새 라운드가 시작되면 52장을 모두 다시 섞어요.</p>`;
    $('sell-relic').hidden=true;
    $('detail-dialog').showModal();
  }
  function hidePressTip(){
    if(!activePress)return;
    activePress.control.classList.remove('detail-held');
    lastTouch={control:activePress.control,ended:Date.now()};
    activePress=null;
    $('press-tip').hidden=true;
  }
  function positionPressTip(tip,control,x,y){
    const viewport=window.visualViewport;
    const left=(viewport?.offsetLeft||0)+10, top=(viewport?.offsetTop||0)+10;
    const right=left+(viewport?.width||window.innerWidth)-20;
    const bottom=top+(viewport?.height||window.innerHeight)-20;
    const anchor=control.getBoundingClientRect();
    const gap=24;
    const above=Math.min(anchor.top,y)-gap;
    const below=Math.max(anchor.bottom,y)+gap;
    tip.style.maxWidth=`${Math.max(0,right-left)}px`;
    tip.style.maxHeight='none';
    const {width,height}=tip.getBoundingClientRect();
    const useAbove=above-top>=height||above-top>=bottom-below;
    const room=Math.max(0,useAbove?above-top:bottom-below);
    if(!room)return false;
    const boxLeft=Math.min(Math.max(x-width/2,left),right-width);
    tip.style.left=`${boxLeft}px`;
    tip.style.top=`${useAbove?above-Math.min(height,room):below}px`;
    tip.style.maxHeight=`${room}px`;
    return true;
  }
  function showPressTip(event){
    hidePressTip();
    if(event.pointerType!=='touch'){lastTouch=null;return;}
    if(!event.isPrimary||busy)return;
    const control=event.target.closest(pressControls);
    if(!control||control.disabled)return;
    const relic=relicById(control.dataset.relic);
    const deck=relic?null:deckInfo();
    $('press-tip-title').textContent=relic?.name||'남은 덱';
    $('press-tip-text').textContent=relic?.text||deck.summary;
    $('press-tip-suits').hidden=!deck;
    $('press-tip-suits').textContent=deck?E.SUITS.map((s,i)=>`${s.symbol} ${deck.counts[i]}장`).join(' · '):'';
    const tip=$('press-tip');
    activePress={control,id:event.pointerId,x:event.clientX,y:event.clientY};
    control.classList.add('detail-held');
    tip.hidden=false;
    if(!positionPressTip(tip,control,event.clientX,event.clientY))hidePressTip();
  }
  function isTouchClick(event,control){
    if(event.pointerType==='touch'||event.sourceCapabilities?.firesTouchEvents)return true;
    return event.detail>0&&lastTouch?.control===control&&Date.now()-lastTouch.ended<750;
  }
  document.addEventListener('pointerdown',showPressTip,{passive:true});
  document.addEventListener('pointermove',event=>{
    if(event.pointerId===activePress?.id&&Math.hypot(event.clientX-activePress.x,event.clientY-activePress.y)>12)hidePressTip();
  },{passive:true});
  for(const type of ['pointerup','pointercancel','lostpointercapture']){
    document.addEventListener(type,event=>{if(event.pointerId===activePress?.id)hidePressTip();},true);
  }
  for(const type of ['resize','blur','pagehide'])window.addEventListener(type,hidePressTip);
  window.visualViewport?.addEventListener('resize',hidePressTip);
  window.visualViewport?.addEventListener('scroll',hidePressTip);
  document.addEventListener('scroll',hidePressTip,{capture:true,passive:true});
  document.addEventListener('contextmenu',event=>{
    const control=event.target.closest(pressControls);
    if(control&&(activePress?.control===control||isTouchClick(event,control)))event.preventDefault();
  });
  $('relics').addEventListener('click',event=>{
    const button=event.target.closest('[data-relic]');
    if(button&&!busy&&!isTouchClick(event,button))showRelicDetails(relicById(button.dataset.relic));
  });
  $('deck').addEventListener('click',event=>{
    if(!busy&&!isTouchClick(event,$('deck')))showDeckDetails();
  });
  $('sell-menu').addEventListener('click',()=>{
    if(run().phase!=='shop'||busy)return;
    $('detail-kicker').textContent='정박지';
    $('detail-title').textContent='팔 유물 고르기';
    $('detail-content').innerHTML=`<div class="relic-sale-list">${run().relics.map(id=>{
      const relic=relicById(id);
      return `<button type="button" class="discard-button" data-sale-relic="${id}"><span>${relic.name}</span><span>${relicSellPrice(relic)} 진주</span></button>`;
    }).join('')}</div>`;
    $('sell-relic').hidden=true;
    $('detail-dialog').showModal();
  });
  $('detail-content').addEventListener('click',event=>{
    const button=event.target.closest('[data-sale-relic]');
    if(button&&run().phase==='shop')showRelicDetails(relicById(button.dataset.saleRelic));
  });
  $('sell-relic').addEventListener('click',()=>{
    if(commit(E.sell(run(),detailRelic))){
      $('detail-dialog').close();
      const nextControl=$('sell-menu').hidden?$('continue'):$('sell-menu');
      nextControl.focus({preventScroll:true});
      message('유물을 팔아 자리를 비웠어요.');
    }
  });
  $('last-calculation').addEventListener('click',()=>{
    const last=run().last;
    if(!last||busy)return;
    $('detail-kicker').textContent='직전 계산';
    $('detail-title').textContent=`${E.HANDS[last.type].name} · ${number(last.score)}점`;
    const summary=document.createElement('p');
    summary.textContent=`${number(last.chips)} 칩 × ${number(last.mult)} 배수`;
    const effects=document.createElement('dl');
    effects.className='score-history';
    for(const {name,detail} of last.effects){
      const label=document.createElement('dt');
      const value=document.createElement('dd');
      label.textContent=name;
      value.textContent=detail;
      effects.append(label,value);
    }
    $('detail-content').replaceChildren(summary,effects);
    $('sell-relic').hidden=true;
    $('detail-dialog').showModal();
  });
  $('help').addEventListener('click',showHelp);$('result-help').addEventListener('click',showHelp);
  $('new-voyage').addEventListener('click',()=>{$('daily-label').textContent=`${day()} · 같은 덱, 같은 출발.`;$('new-warning').textContent=['won','lost'].includes(run().phase)?'새로운 항해를 시작해 보세요. 최고 기록은 남아요.':'새로 시작하면 현재 항해는 끝나요. 최고 기록은 남아요.';$('voyage-dialog').showModal();});
  $('start-free').addEventListener('click',()=>start('free'));$('start-daily').addEventListener('click',()=>start('daily'));$('retry').addEventListener('click',()=>start(run().mode));
  $('sound').addEventListener('click',()=>{data.sound=!data.sound;save();renderStats();sound();});
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}}));
  window.addEventListener('pagehide',()=>{if(calculation)finishScoring({focus:false});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){hidePressTip();if(calculation)finishScoring({focus:false});save();}});
  $('table-emblem').innerHTML=A.icon('compass');save();render();
})();
