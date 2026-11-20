(function(){
  'use strict';
  const E=window.PotionEngine,A=window.PotionArt,$=id=>document.getElementById(id),copy=value=>JSON.parse(JSON.stringify(value));
  const KEY='little-arcade:potions:v1',CHAPTERS=['초승달 정원','별빛 서고','보름달 온실'];
  const starPath='m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z';
  const fresh=level=>({round:E.create(level),history:[],awarded:false});
  let data={version:1,active:fresh(1),records:{},sound:false},selected=-1,hint=null,busy=false,thinking=false,worker=null,hintId=0,hintTimeout,animation=null,pending=null,winShown=false;
  let message='보낼 병을 고른 다음, 받을 병을 누르세요.',audio,bottleCount=0,justCompleted=new Set(),particleTimer;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  try{
    const saved=JSON.parse(localStorage.getItem(KEY));
    if(saved?.version===1){
      if(saved.records&&typeof saved.records==='object')for(let level=1;level<=E.LEVELS;level++){const record=saved.records[level];if(record&&Number.isInteger(record.stars)&&record.stars>=1&&record.stars<=3&&Number.isSafeInteger(record.moves)&&record.moves>0)data.records[level]={stars:record.stars,moves:record.moves};}
      const unlocked=highest();
      if(E.valid(saved.active?.round)&&saved.active.round.level<=unlocked){data.active={round:saved.active.round,history:Array.isArray(saved.active.history)?saved.active.history.slice(-60).filter(s=>E.valid(s)&&s.level===saved.active.round.level):[],awarded:saved.active.awarded===true};}
      data.sound=saved.sound===true;
    }
  }catch{}
  const round=()=>data.active.round;
  function highest(){let level=1;while(level<E.LEVELS&&data.records[level])level++;return level;}
  function save(){
    try{localStorage.setItem(KEY,JSON.stringify(data));localStorage.setItem('little-arcade:last',JSON.stringify({id:'potions',at:Date.now()}));$('save-status').textContent='진행 자동 저장';}
    catch{$('save-status').textContent='이 환경에서는 자동 저장 불가';}
  }
  function tone(kind='pour'){
    if(!data.sound)return;
    try{if(!audio){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audio=new Audio();}if(audio.state==='suspended')audio.resume().catch(()=>{});const notes=kind==='win'?[523,659,784,1046]:kind==='complete'?[659,880]:kind==='select'?[440]:[330,392];notes.forEach((hz,i)=>{const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime+i*.065;osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(.04,t+.012);gain.gain.exponentialRampToValueAtTime(.001,t+.19);osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+.21);});}catch{}
  }
  function award(){
    if(!E.won(round()))return;
    const stars=E.stars(round()),previous=data.records[round().level];
    data.records[round().level]={stars:Math.max(stars,previous?.stars||0),moves:Math.min(round().moves,previous?.moves??Infinity)};
    data.active.awarded=true;
  }
  function totalStars(){return Object.values(data.records).reduce((sum,record)=>sum+record.stars,0);}
  function bottleLabel(index){const tube=round().tubes[index],known=round().known[index];return `병 ${index+1}, ${tube.length?`아래부터 ${tube.map((color,j)=>known[j]?E.NAMES[color-1]:'가려진 색').join(', ')}`:'빈 병'}${E.complete(tube)?', 정리 완료':''}${selected===index?', 선택됨':''}${hint?.from===index?', 힌트: 보낼 병':hint?.to===index?', 힌트: 받을 병':''}`;}
  function ensureBottles(){
    if(bottleCount===round().tubes.length)return;
    bottleCount=round().tubes.length;$('board').replaceChildren();
    const cols=bottleCount<=6?3:bottleCount<=8?4:5;$('board').style.setProperty('--cols',cols);$('board').style.maxWidth=`${cols*70+(cols-1)*14}px`;
    for(let index=0;index<bottleCount;index++){const button=document.createElement('button');button.type='button';button.className='bottle';button.dataset.index=index;button.innerHTML='<span class="bottle-art"></span><span class="bottle-label"></span>';button.addEventListener('click',()=>tapBottle(index));$('board').append(button);}
  }
  function render(drawBottles=true){
    ensureBottles();
    const won=E.won(round()),level=round().level;
    $('level').textContent=level;$('chapter').textContent=CHAPTERS[E.settings(level).chapter];$('moves').textContent=round().moves;$('sorted').textContent=`${round().tubes.filter(E.complete).length} / ${round().colors}`;$('total-stars').textContent=totalStars();$('status').textContent=message;
    $('board').inert=busy||thinking||won;
    if(drawBottles)$('board').querySelectorAll('.bottle').forEach((button,index)=>{
      const complete=E.complete(round().tubes[index]);button.classList.toggle('selected',selected===index);button.classList.toggle('completed',complete);button.classList.toggle('just-completed',justCompleted.has(index));button.classList.toggle('hint-from',hint?.from===index);button.classList.toggle('hint-to',hint?.to===index);
      button.setAttribute('aria-label',bottleLabel(index));button.setAttribute('aria-pressed',String(selected===index));
      button.querySelector('.bottle-art').innerHTML=A.svg(round().tubes[index],round().known[index],{prefix:`vial-${index}`,complete});
      button.querySelector('.bottle-label').textContent=hint?.from===index?'보낼 병':hint?.to===index?'받을 병':complete?'완성':`병 ${index+1}`;
    });
    $('undo').disabled=busy||thinking||!data.active.history.length||won;$('hint').disabled=busy||thinking||won;$('extra').disabled=busy||thinking||round().extra||won;$('reset').disabled=busy||thinking;$('map').disabled=busy||thinking;$('help').disabled=busy||thinking;
    $('extra-left').textContent=round().extra?'사용함':'1회';$('hint').querySelector('span:last-child').textContent=thinking?'찾는 중…':'별빛 힌트';
    $('sound').setAttribute('aria-pressed',String(data.sound));$('sound').setAttribute('aria-label',data.sound?'소리 끄기':'소리 켜기');
    $('sound').innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5 5 9H2v6h3l5 4V5Z${data.sound?'m5 3c3 2 3 6 0 8m3-11c5 4 5 10 0 14':'m5 4 6 6m0-6-6 6'}"/></svg>`;
  }
  function particles(){
    if(reduced.matches)return;clearTimeout(particleTimer);const target=$('celebration');target.replaceChildren();
    for(let n=0;n<28;n++){const particle=document.createElement('i');particle.className='particle';particle.style.setProperty('--dx',`${(Math.random()-.5)*440}px`);particle.style.setProperty('--dy',`${(Math.random()-.6)*380}px`);particle.style.setProperty('--color',E.COLORS[n%E.COLORS.length]);particle.style.animationDelay=`${Math.random()*.15}s`;target.append(particle);}
    particleTimer=setTimeout(()=>target.replaceChildren(),1200);
  }
  function maybeWin(){
    if(!E.won(round())||winShown||busy||thinking||document.hidden||$('help-dialog').open||$('map-dialog').open)return;
    award();save();render();winShown=true;
    const stars=E.stars(round());$('win-stars').innerHTML=Array.from({length:3},(_,i)=>`<svg viewBox="0 0 24 24" class="${i<stars?'earned':''}" aria-hidden="true"><path d="${starPath}"/></svg>`).join('');$('win-stars').setAttribute('aria-label',`별 3개 중 ${stars}개`);
    $('win-copy').textContent=`스테이지 ${round().level} · ${round().moves}번 부어 ${round().colors}가지 색을 모았어요.${round().hints?` 힌트 ${round().hints}회.`:''}${round().extra?' 빈 병을 하나 더 사용했어요.':''}`;
    $('next').textContent=round().level<E.LEVELS?'다음 스테이지':'모든 여정 살펴보기';$('win-dialog').showModal();particles();tone('win');
  }
  function finishVisuals(){
    $('pour-ghost').hidden=true;$('pour-ghost').replaceChildren();$('stream-shadow').style.opacity=0;$('stream-color').style.opacity=0;
    $('board').querySelectorAll('.bottle-art').forEach(art=>art.style.visibility='');
  }
  function animatePour(before,move){
    const source=$('board').querySelector(`[data-index="${move.from}"] .bottle-art`),destination=$('board').querySelector(`[data-index="${move.to}"] .bottle-art`);
    if(reduced.matches||!source||!destination||document.hidden)return Promise.resolve();
    const from=source.getBoundingClientRect(),to=destination.getBoundingClientRect(),scale=from.width/80;
    if(!from.width||!to.width)return Promise.resolve();
    const targetX=to.left+to.width/2,targetY=to.top+17*to.width/80,angle=targetX<window.innerWidth/2?-68:68,radians=angle*Math.PI/180;
    const endLeft=targetX-Math.sin(radians)*101*scale-40*scale,endTop=targetY+Math.cos(radians)*101*scale-30*scale-118*scale;
    const ghost=$('pour-ghost');ghost.hidden=false;ghost.style.width=`${from.width}px`;ghost.style.height=`${from.height}px`;source.style.visibility='hidden';
    const duration=1050,start=performance.now(),ease=t=>t*t*(3-2*t);
    return new Promise(resolve=>{
      let request,finished=false;
      const finish=()=>{if(finished)return;finished=true;cancelAnimationFrame(request);animation=null;finishVisuals();resolve();};animation={finish};
      function frame(time){
        const progress=Math.min(1,(time-start)/duration);let x,y,rotation,poured;
        if(progress<.28){const t=ease(progress/.28);x=from.left+(endLeft-from.left)*t;y=from.top+(endTop-from.top)*t-Math.sin(t*Math.PI)*24;rotation=angle*t;poured=0;}
        else if(progress<.76){x=endLeft;y=endTop;rotation=angle;poured=ease((progress-.28)/.48);}
        else{const t=ease((progress-.76)/.24);x=endLeft+(from.left-endLeft)*t;y=endTop+(from.top-endTop)*t;rotation=angle*(1-t);poured=1;}
        ghost.style.left=`${x}px`;ghost.style.top=`${y}px`;ghost.style.transform=`rotate(${rotation}deg)`;
        ghost.innerHTML=A.svg(before.tubes[move.from],before.known[move.from],{prefix:'pouring',angle:rotation,drain:move.amount*poured,moving:true});
        destination.innerHTML=A.svg(before.tubes[move.to],before.known[move.to],{prefix:`receiving-${move.to}`,incoming:{color:move.color,amount:move.amount*poured},moving:true});
        if(progress>.28&&progress<.76){const r=rotation*Math.PI/180,sx=x+40*scale+Math.sin(r)*101*scale,sy=y+118*scale-Math.cos(r)*101*scale,d=`M${sx} ${sy}Q${(sx+targetX)/2} ${sy+15} ${targetX} ${targetY+8}`;$('stream-shadow').setAttribute('d',d);$('stream-color').setAttribute('d',d);$('stream-color').style.stroke=E.COLORS[move.color-1];$('stream-shadow').style.opacity=.34;$('stream-color').style.opacity=.95;}
        else{$('stream-shadow').style.opacity=0;$('stream-color').style.opacity=0;}
        if(progress>=1)finish();else request=requestAnimationFrame(frame);
      }
      request=requestAnimationFrame(frame);
    });
  }
  async function tapBottle(index){
    if(busy||thinking||E.won(round()))return;
    justCompleted.clear();
    if(selected===index){selected=-1;hint=null;message='다른 병을 골라도 괜찮아요.';render();return;}
    if(selected<0){if(!round().tubes[index].length){message='물이 들어 있는 병을 먼저 골라 주세요.';render();return;}if(E.complete(round().tubes[index])){message='이 병은 완성됐어요. 다른 색을 모아 볼까요?';render();return;}selected=index;message=`${E.NAMES[round().tubes[index].at(-1)-1]} 물약을 받을 병을 누르세요.`;render();tone('select');return;}
    const move=E.plan(round(),selected,index);
    if(!move){
      if(round().tubes[index].length&&!E.complete(round().tubes[index])){selected=index;hint=null;message='이 병을 새로 골랐어요. 같은 색이나 빈 병에 부어 주세요.';}
      else message='같은 색이 맨 위에 있고 자리가 남은 병에 부어 주세요.';
      render();const button=$('board').querySelector(`[data-index="${index}"]`);button.classList.remove('invalid');void button.offsetWidth;button.classList.add('invalid');return;
    }
    const before=copy(round()),after=E.pour(before,move.from,move.to);if(!after)return;
    data.active.history.push(before);data.active.history=data.active.history.slice(-60);data.active.round=after;selected=-1;hint=null;busy=true;
    message=`${E.NAMES[move.color-1]} 물약을 옮기고 있어요.`;award();save();render(false);tone();
    await animatePour(before,move);
    busy=false;after.tubes.forEach((tube,i)=>{if(E.complete(tube)&&!E.complete(before.tubes[i]))justCompleted.add(i);});
    const uncovered=after.known.flat().filter(Boolean).length-before.known.flat().filter(Boolean).length;
    message=E.won(after)?'모든 물약이 제자리를 찾았어요!':justCompleted.size?'한 병 완성! 마개가 닫혔어요.':uncovered>0?'숨겨진 물약의 색이 보였어요.':'잘 옮겼어요. 다음 색도 천천히 모아 보세요.';
    render();if(justCompleted.size&&!E.won(after)){particles();tone('complete');}maybeWin();
  }
  function cancelHint(){hintId++;clearTimeout(hintTimeout);if(worker){worker.terminate();worker=null;}thinking=false;}
  function applyHint(move,id){
    if(id!==hintId||!thinking)return;clearTimeout(hintTimeout);if(worker){worker.terminate();worker=null;}thinking=false;
    if(move&&E.plan(round(),move.from,move.to)){hint={from:move.from,to:move.to};selected=-1;round().hints++;message=move.certified?'빛나는 보낼 병과 받을 병을 차례로 눌러 보세요.':'이 색부터 모아 보세요. 막히면 한 수 되돌려도 좋아요.';save();}
    else{hint=null;message='지금은 부을 수 있는 자리가 없어요. 되돌리기나 빈 병 추가를 써 보세요.';}
    render();
  }
  function requestHint(){
    if(busy||thinking||E.won(round()))return;
    cancelHint();const id=hintId;thinking=true;message='별빛이 다음 자리를 찾고 있어요.';render();
    const fallback=()=>applyHint(E.suggest(round(),{search:false}),id);
    try{if(!window.Worker)throw Error('No worker');worker=new Worker('potion-solver.js');worker.onmessage=event=>{if(event.data?.id===id){if(event.data.error)fallback();else applyHint(event.data.move,id);}};worker.onerror=fallback;hintTimeout=setTimeout(fallback,2200);worker.postMessage({id,round:copy(round())});}
    catch{fallback();}
  }
  function closeDialogs(){for(const id of ['win-dialog','map-dialog','confirm-dialog'])if($(id).open)$(id).close();}
  function startStage(level){
    cancelHint();animation?.finish();closeDialogs();data.active=fresh(level);selected=-1;hint=null;busy=false;winShown=false;justCompleted.clear();
    message=level===9?'이제 ? 물약이 등장해요. 위의 색을 덜어 내면 보여요.':'보낼 병을 고른 다음, 받을 병을 누르세요.';save();render();
  }
  function requestStage(level){
    if(busy||thinking||level>highest()||level<1||level>E.LEVELS)return;
    if(!round().moves||E.won(round())){startStage(level);return;}
    pending=()=>startStage(level);$('confirm-title').textContent=level===round().level?'다시 풀어 볼까요?':'다른 스테이지로 갈까요?';$('confirm-copy').textContent='현재 스테이지의 진행은 초기화돼요. 모은 별과 완료 기록은 그대로 남아요.';$('confirm-dialog').showModal();
  }
  function renderMap(){
    const unlocked=highest();$('stage-map').replaceChildren();
    for(let chapter=0;chapter<3;chapter++){
      const section=document.createElement('section');section.className='map-chapter';const title=document.createElement('h3');title.textContent=CHAPTERS[chapter];section.append(title);const grid=document.createElement('div');grid.className='map-grid';
      for(let n=1;n<=12;n++){const level=chapter*12+n,record=data.records[level],button=document.createElement('button');button.type='button';button.className='map-stage'+(round().level===level?' current':'');button.dataset.level=level;button.disabled=level>unlocked;button.setAttribute('aria-label',`스테이지 ${level}${record?`, 별 ${record.stars}개, 최고 ${record.moves}회`:level>unlocked?', 잠김':', 도전 가능'}`);button.innerHTML=`<b>${level}</b>${level>unlocked?'<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="9" width="10" height="8" rx="2"/><path d="M7 9V6a3 3 0 0 1 6 0v3"/></svg>':`<span aria-hidden="true">${record?'★'.repeat(record.stars)+'☆'.repeat(3-record.stars):'·'}</span>`}`;button.addEventListener('click',()=>{$('map-dialog').close();if(level!==round().level||E.won(round()))requestStage(level);});grid.append(button);}
      section.append(grid);$('stage-map').append(section);
    }
  }
  function openMap(){if(busy||thinking)return;if($('win-dialog').open)$('win-dialog').close();renderMap();$('map-dialog').showModal();}
  $('undo').addEventListener('click',()=>{
    if(busy||thinking||!data.active.history.length||E.won(round()))return;
    const hints=round().hints;data.active.round=data.active.history.pop();round().hints=Math.max(hints,round().hints);selected=-1;hint=null;justCompleted.clear();message='한 수 되돌렸어요. 다른 길도 살펴보세요.';save();render();
  });
  $('extra').addEventListener('click',()=>{
    if(busy||thinking||round().extra||E.won(round()))return;
    const next=E.addBottle(round());if(!next)return;data.active.round=next;data.active.history=data.active.history.map(previous=>E.addBottle(previous)||previous);selected=-1;hint=null;justCompleted.clear();message='빈 병 하나를 더 꺼냈어요. 여유 있게 색을 옮겨 보세요.';save();render();tone('select');
  });
  $('hint').addEventListener('click',requestHint);$('map').addEventListener('click',openMap);$('close-map').addEventListener('click',()=>{$('map-dialog').close();maybeWin();});
  $('help').addEventListener('click',()=>$('help-dialog').showModal());$('close-help').addEventListener('click',()=>{$('help-dialog').close();maybeWin();});
  $('reset').addEventListener('click',()=>requestStage(round().level));$('cancel').addEventListener('click',()=>{pending=null;$('confirm-dialog').close();});$('confirm-dialog').addEventListener('cancel',()=>{pending=null;});$('confirm').addEventListener('click',()=>{$('confirm-dialog').close();const next=pending;pending=null;next?.();});
  $('next').addEventListener('click',()=>{if(round().level<E.LEVELS)startStage(round().level+1);else openMap();});$('win-map').addEventListener('click',openMap);$('replay').addEventListener('click',()=>startStage(round().level));
  $('sound').addEventListener('click',()=>{data.sound=!data.sound;save();render(!busy);tone('select');});
  $('map-dialog').addEventListener('cancel',()=>setTimeout(maybeWin,0));$('help-dialog').addEventListener('cancel',()=>setTimeout(maybeWin,0));
  document.addEventListener('visibilitychange',()=>{if(document.hidden){animation?.finish();cancelHint();if(busy)busy=false;finishVisuals();save();render();}else maybeWin();});
  window.addEventListener('resize',()=>{if(animation)animation.finish();});
  award();save();render();setTimeout(maybeWin,0);
})();
