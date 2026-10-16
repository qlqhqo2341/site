(function () {
  'use strict';
  const kind=document.body.dataset.game, E=window.ArcadeEngines[kind], catalog=window.ArcadeCatalog, meta=catalog.games.find(game=>game.id===kind);
  const $=id=>document.getElementById(id), clone=value=>JSON.parse(JSON.stringify(value)), format=value=>value.toLocaleString('ko-KR');
  const configs={
    lights:{title:'생각을 켜고,<br><em>불빛은 끄고.</em>',copy:'누른 칸과 위아래, 양옆의 불빛이 바뀌어요.<br>모든 불빛을 끄는 작은 논리 실험.',options:[[4,'4 × 4'],[5,'5 × 5'],[6,'6 × 6']],main:'누른 횟수',action:'한 칸 힌트',hint:'불빛 하나를 누르면 십자 모양으로 바뀌어요.',rules:['한 칸을 누르면 그 칸과 바로 위·아래·왼쪽·오른쪽의 상태가 반대로 바뀌어요.','불이 켜진 칸도, 꺼진 칸도 누를 수 있어요. 모두 끄면 성공이에요.','모든 배치는 풀 수 있도록 만들어져요. 한 칸 힌트는 지금 필요한 칸 하나를 표시해 줘요.'],end:'고요한 밤이 되었어요',endCopy:s=>`${s.moves}번 눌러 불빛을 모두 껐어요.<br>처음 배치의 최소 해법은 ${s.optimal}수예요.`},
    water:{title:'흩어진 색을,<br><em>제자리에.</em>',copy:'같은 색이 만나도록 조금씩 옮겨요.<br>빈 병 하나가 생각보다 큰 여유가 될 거예요.',options:[[4,'4가지 색'],[5,'5가지 색'],[6,'6가지 색']],main:'부은 횟수',action:null,hint:'물을 보낼 병을 고른 뒤, 받을 병을 누르세요.',rules:['병 하나를 고르고 다른 병을 누르면 맨 위의 물을 부어요.','빈 병이나 맨 위가 같은 색인 병에만 부을 수 있어요. 한 병에는 네 칸까지 들어가요.','맨 위에 연속된 같은 색은 자리가 되는 만큼 함께 이동해요. 병을 다시 누르면 선택이 풀려요.','같은 색을 각각 한 병에 네 칸씩 모으면 성공! 막혔다면 되돌리거나 처음 배치부터 다시 해 보세요. 색의 숫자 표시는 색을 구분하는 보조 표시예요.'],end:'모든 색이 자리를 찾았어요',endCopy:s=>`${s.moves}번 부어 ${s.n}가지 색을 정리했어요.<br>빈 병도 제 몫을 톡톡히 했네요.`},
    number:{title:'한 칸의 빈틈이,<br><em>길을 만들어요.</em>',copy:'숫자를 조금씩 밀어 순서대로 맞춰요.<br>어디로 비켜야 할지, 천천히 생각해 봐요.',options:[[3,'3 × 3'],[4,'4 × 4']],main:'움직인 횟수',action:null,hint:'빈칸 옆 숫자를 눌러 1부터 차례로 맞추세요.',rules:['빈칸과 상하좌우로 맞닿은 숫자를 누르면 빈칸으로 이동해요.','왼쪽 위부터 1, 2, 3… 순서대로 맞추고, 빈칸은 오른쪽 아래에 두세요.','초록색 숫자는 제자리에 있는 숫자예요. 필요하면 다시 움직여도 괜찮아요.','방향키와 스와이프는 빈칸이 이동할 방향을 뜻해요. 모든 배치는 완성된 판에서 섞어, 풀 수 있는 상태예요.'],end:'걸음마다 제자리로',endCopy:s=>`${s.moves}번 움직여 숫자를 모두 맞췄어요.<br>작은 빈틈으로 길을 잘 만들었네요.`},
    memory:{title:'잠깐 본 그림을,<br><em>기억해 봐요.</em>',copy:'사라진 그림은 어디쯤 있었을까요.<br>한 장씩 뒤집어 같은 그림을 찾아요.',options:[[8,'8쌍'],[10,'10쌍'],[12,'12쌍']],main:'짝 찾기 시도',action:'잠깐 전체 보기',hint:'카드 두 장을 뒤집어 같은 그림의 짝을 찾으세요.',rules:['카드를 두 장씩 뒤집으세요. 같은 그림이면 열린 채로 남아요.','다른 그림이면 잠깐 보여준 뒤 다시 닫혀요. 두 번째 카드를 열 때 한 번의 시도로 세어요.','잠깐 전체 보기는 한 판에 한 번만 쓸 수 있어요. 모든 그림을 약 1초 동안 보여줘요.','진행과 기록은 자동 저장돼요. 카드 위치는 새 배치를 고를 때만 바뀌어요.'],end:'모든 잔상을 기억했어요',endCopy:s=>`${s.moves}번 시도해 ${s.pairs}쌍을 찾았어요.<br>${s.peeks?'전체 보기의 도움도 한 번 받았어요.':'전체 보기 없이 완성했어요!'}`},
    pipes:{title:'작은 빛 하나로,<br><em>모든 길을 이어요.</em>',copy:'돌려진 조각 사이로 길을 이어요.<br>금빛 시작점의 빛을 모든 칸에 보내세요.',options:[[4,'4 × 4'],[5,'5 × 5'],[6,'6 × 6']],main:'돌린 횟수',action:'한 칸 맞추기',hint:'조각을 눌러 회전하고, 모든 칸에 빛을 보내세요.',rules:['칸을 누르면 길이 시계 방향으로 90도 돌아가요.','금빛 점이 시작점이에요. 길의 끝이 서로 마주 닿으면 빛이 흘러 초록색으로 바뀌어요.','모든 칸을 시작점과 연결하면 성공이에요. 화면 가장자리로 나가는 길은 연결되지 않아요.','한 칸 맞추기는 원래 해답과 다른 조각 하나를 맞춰 줘요. 사용 횟수도 함께 기록해요.'],end:'모든 별에 빛이 닿았어요',endCopy:s=>`${s.moves}번 회전해 ${s.n*s.n}칸을 연결했어요.<br>한 칸 도움은 ${s.hints}번 사용했어요.`}
  };
  const config=configs[kind], storageKey=meta.key, reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const seed=()=>{const values=new Uint32Array(1);if(window.crypto?.getRandomValues)return crypto.getRandomValues(values)[0];return Date.now()>>>0;};
  let data={version:1,state:E.create(config.options[0][0],seed()),history:[],wins:0,best:{},awarded:false};
  try {
    const saved=JSON.parse(localStorage.getItem(storageKey));
    if(saved?.version===1&&E.valid(saved.state)) {
      data.state=saved.state;data.history=Array.isArray(saved.history)?saved.history.slice(-40).filter(s=>E.valid(s)):[];
      data.wins=Number.isSafeInteger(saved.wins)&&saved.wins>=0?saved.wins:0;data.awarded=saved.awarded===true;
      if(saved.best&&typeof saved.best==='object')for(const[value]of config.options)if(Number.isSafeInteger(saved.best[value])&&saved.best[value]>0)data.best[value]=saved.best[value];
    }
  } catch {}
  if(kind==='memory'&&data.state.open.length===2)data.state=E.settle(data.state);
  let sound=false,audio,selected=-1,hintMark=-1,peeking=false,busy=false,settleTimer,peekTimer,fxTimer,pointer=null,suppressClick=0,pending=null,message=config.hint,layout='',lastWon=false;
  try {sound=JSON.parse(localStorage.getItem('little-arcade:prefs'))?.sound===true;}catch{}
  document.documentElement.style.setProperty('--accent',meta.accent);
  $('app').innerHTML=`<div class="shell"><header class="topbar"><a class="brand" href="games.html"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>LITTLE ARCADE</a><a class="back-link" href="games.html">모든 게임 ↗</a></header><main class="play-layout"><section class="intro"><div class="edition">A LITTLE BREAK · ${meta.en}</div><h1>${config.title}</h1><p>${config.copy}</p><div class="intro-art">${catalog.preview(kind)}</div><div class="intro-foot">시간 제한 없이, 내 속도로.<br>자동 저장된 자리에서 언제든 다시 시작해요.<br><span id="wins-copy"></span></div></section><section class="game" aria-label="${meta.name} 게임"><div class="game-header"><div class="game-title"><h2>${meta.name}</h2><small>${meta.en}</small></div><div class="header-actions"><button id="sound" class="icon-button" type="button" aria-label="소리 켜기" aria-pressed="false">♪</button><button id="help" class="icon-button" type="button" aria-label="게임 방법">?</button></div></div><div id="difficulty" class="difficulty" role="group" aria-label="난이도">${config.options.map(([value,label])=>`<button type="button" data-level="${value}" aria-pressed="false">${label}</button>`).join('')}</div><div class="stats"><div class="stat-main"><small>${config.main}</small><strong id="moves">0</strong></div><div class="stat-group"><div class="stat-other"><small id="status-label"></small><strong id="status"></strong></div><div class="stat-other"><small>최소 기록</small><strong id="best">—</strong></div></div></div><div class="board-meta"><b id="meta-left"></b><span id="meta-right"></span></div><div class="stage"><div id="board"></div><div id="finish" class="finish" hidden><div><div class="finish-icon" aria-hidden="true">✧</div><h3>${config.end}</h3><p id="finish-copy"></p><div class="finish-actions"><button id="finish-next" class="primary" type="button">새 배치로 한 판 더</button><a class="secondary" href="games.html" style="text-decoration:none">다른 게임 골라 보기</a></div></div></div><div id="sparks" class="sparks" aria-hidden="true"></div></div><div class="controls">${kind!=='memory'?'<button id="undo" class="control" type="button">↶ 되돌리기</button>':''}${config.action?`<button id="action" class="control" type="button">${config.action}</button>`:''}<button id="reset" class="control" type="button">처음 배치</button><button id="new" class="control" type="button">새 배치</button></div><p id="play-hint" class="play-hint"></p><div id="announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div></section></main><footer><span>한 판의 여유, 가벼운 귀갓길.</span><span id="save-status" class="saved">진행 자동 저장</span></footer></div><dialog id="help-dialog" aria-labelledby="help-title"><h2 id="help-title">${meta.name} 하는 법</h2><ul>${config.rules.map(rule=>`<li>${rule}</li>`).join('')}</ul><p>최소 기록은 현재 난이도에서 완성한 판의 가장 적은 ${kind==='memory'?'시도':'이동'} 횟수예요. 새 배치마다 출발점은 달라요.</p><button id="close-help" class="primary full-button" type="button">알겠어요, 시작!</button></dialog><dialog id="confirm-dialog" aria-labelledby="confirm-title"><h2 id="confirm-title">다시 시작할까요?</h2><p id="confirm-copy">현재 진행은 초기화돼요.<br>완료 기록과 다른 게임의 진행은 그대로 남아요.</p><div class="dialog-actions"><button id="cancel" class="secondary" type="button" autofocus>이어 할래요</button><button id="confirm" class="primary" type="button">시작하기</button></div></dialog>`;
  const s=()=>data.state, level=()=>kind==='memory'?s().pairs:s().n;
  function announce(text){$('announcement').textContent=text;}
  function save(){
    try{localStorage.setItem(storageKey,JSON.stringify(data));localStorage.setItem('little-arcade:last',JSON.stringify({id:kind,at:Date.now()}));$('save-status').textContent=`진행 자동 저장 · 소리 ${sound?'ON':'OFF'}`;}
    catch{$('save-status').textContent='이 환경에서는 자동 저장 불가';}
  }
  function tone(win=false){
    if(!sound)return;
    try{if(!audio){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audio=new Audio();}if(audio.state==='suspended')audio.resume().catch(()=>{});(win?[523,659,784,1046]:[392]).forEach((hz,i)=>{const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime+i*.07;osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(.045,t+.008);gain.gain.exponentialRampToValueAtTime(.001,t+.2);osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+.22);});}catch{}
  }
  function award(){if(E.won(s())&&!data.awarded){data.awarded=true;data.wins++;const key=level();data.best[key]=Math.min(data.best[key]??Infinity,s().moves);save();}}
  const SYMBOLS=[
    '<path d="M7 22Q4 5 23 5Q23 24 7 22Zm0 0L19 10"/>',
    '<path d="M22 5A11 11 0 1 0 25 22A11 11 0 0 1 22 5Z"/>',
    '<path d="m16 3 4 8 9 1-6.5 6 1.5 10-8-5-8 5 1.5-10L3 12l9-1Z"/>',
    '<circle cx="16" cy="16" r="8"/><ellipse cx="16" cy="16" rx="15" ry="4" transform="rotate(-25 16 16)"/>',
    '<path d="M3 12q4-6 8 0t8 0 10 0M3 21q4-6 8 0t8 0 10 0"/>',
    '<path d="m16 3 12 13-12 13L4 16 16 3Zm0 0v26M4 16h24"/>',
    '<circle cx="16" cy="16" r="4"/><path d="M16 12C5 0 0 14 12 16 0 27 15 32 16 20 27 32 32 17 20 16 32 5 17 0 16 12Z"/>',
    '<path d="M5 24V8h22v16H5Zm0-16 11 9L27 8"/>',
    '<path d="M16 27C-7 13 8-2 16 9c8-11 23 4 0 18Z"/>',
    '<path d="M6 16a10 10 0 0 1 20 0M9 16a7 7 0 0 1 14 0M12 16a4 4 0 0 1 8 0M4 23h24"/>',
    '<path d="M10 5v15a5 5 0 1 0 5 5V11l12-3v12a5 5 0 1 1-5-5V5L10 8"/>',
    '<path d="M4 23 12 7l7 16H4Zm11 0 8-12 7 12H15Z"/>'
  ];
  const SYMBOL_NAMES=['나뭇잎','초승달','별','토성','파도','보석','꽃','편지','하트','무지개','음표','산'];
  const COLORS=['#b7a1d6','#96c5b0','#e0ad85','#89b5ce','#d4a0af','#d4cb92'];
  function pipeSvg(mask,source){let paths='';if(mask&1)paths+='M25 25V0';if(mask&2)paths+='M25 25H50';if(mask&4)paths+='M25 25V50';if(mask&8)paths+='M25 25H0';return `<svg class="pipe-art" viewBox="0 0 50 50" aria-hidden="true"><path class="pipe-path" d="${paths}"/><circle class="pipe-dot" cx="25" cy="25" r="4"/>${source?'<circle class="source-dot" cx="25" cy="25" r="7"/>':''}</svg>`;}
  function buildBoard(){
    const current=`${kind}:${level()}`;if(layout===current)return;layout=current;
    const board=$('board');board.replaceChildren();board.removeAttribute('role');board.className='';
    if(kind==='water'){board.className='bottles';board.setAttribute('role','group');board.setAttribute('aria-label','색 물 병');for(let i=0;i<s().tubes.length;i++){const button=document.createElement('button');button.type='button';button.className='bottle';button.dataset.index=i;button.innerHTML='<span class="bottle-neck"></span><span class="bottle-body"></span><span class="bottle-number"></span>';board.append(button);}return;}
    if(kind==='number'){board.className='number-board';board.setAttribute('role','group');board.setAttribute('aria-label','숫자 슬라이드 퍼즐');for(let v=1;v<s().n*s().n;v++){const button=document.createElement('button');button.type='button';button.className='number-tile';button.dataset.value=v;button.innerHTML=`<span>${v}</span>`;board.append(button);}const empty=document.createElement('span');empty.className='number-empty';empty.textContent='·';empty.setAttribute('aria-hidden','true');board.append(empty);return;}
    board.className='grid-board'+(kind==='memory'?' memory-board':'');const n=kind==='memory'?4:s().n;board.style.gridTemplateColumns=`repeat(${n},1fr)`;board.style.aspectRatio=kind==='memory'?`${4}/${s().deck.length/4}`:'1';board.setAttribute('role','grid');board.setAttribute('aria-label',kind==='memory'?'짝 맞추기 카드':kind==='lights'?'불빛 퍼즐':'회전하는 빛의 길');
    const count=kind==='memory'?s().deck.length:s().n*s().n;
    for(let row=0;row<Math.ceil(count/n);row++){const line=document.createElement('div');line.className='grid-row';line.setAttribute('role','row');for(let col=0;col<n&&row*n+col<count;col++){const i=row*n+col,button=document.createElement('button');button.type='button';button.dataset.index=i;button.setAttribute('role','gridcell');button.className=kind==='memory'?'memory-card':`grid-cell ${kind==='lights'?'light-cell':'pipe-cell'}`;if(kind==='memory'){button.innerHTML=`<span class="card-inner"><span class="card-face card-back" aria-hidden="true">✧</span><span class="card-face card-front" aria-hidden="true"></span></span>`;}if(kind==='pipes'){button.innerHTML=pipeSvg(s().solution[i],i===s().source);button.dataset.angle=0;}line.append(button);}board.append(line);}
  }
  function render(){
    award();buildBoard();const won=E.won(s()),board=$('board');
    $('moves').textContent=format(s().moves);$('best').textContent=data.best[level()]?format(data.best[level()]):'—';$('wins-copy').textContent=`지금까지 ${data.wins}판 완성했어요.`;
    $('difficulty').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.level)===level())));
    $('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'소리 끄기':'소리 켜기');
    $('sound').textContent=sound?'♫':'♪';$('play-hint').textContent=message;
    if(kind==='lights'){
      board.querySelectorAll('button').forEach((button,i)=>{button.classList.toggle('lit',Boolean(s().board[i]));button.classList.toggle('hinted',hintMark===i);button.setAttribute('aria-label',`${Math.floor(i/s().n)+1}행 ${i%s().n+1}열, 불 ${s().board[i]?'켜짐':'꺼짐'}${hintMark===i?', 힌트 칸':''}`);button.setAttribute('aria-pressed',String(Boolean(s().board[i])));});
      $('status-label').textContent='꺼진 불';$('status').textContent=`${s().board.filter(v=>!v).length}/${s().board.length}`;$('meta-left').textContent='모든 불빛을 꺼 주세요';$('meta-right').textContent=`처음 배치 최단 ${s().optimal}수`;
    } else if(kind==='water'){
      board.querySelectorAll('button').forEach((button,i)=>{const tube=s().tubes[i],complete=tube.length===4&&tube.every(v=>v===tube[0]);button.classList.toggle('selected',selected===i);button.classList.toggle('complete',complete);button.setAttribute('aria-pressed',String(selected===i));button.setAttribute('aria-label',`${i+1}번 병, ${tube.length?`아래부터 ${tube.map(v=>`${v}번 색`).join(', ')}`:'빈 병'}${selected===i?', 선택됨':''}`);button.querySelector('.bottle-number').textContent=complete?`${String(i+1).padStart(2,'0')} ✓`:String(i+1).padStart(2,'0');button.querySelector('.bottle-body').innerHTML=tube.map((v,j)=>`<i class="water-layer" style="--water:${COLORS[v-1]};height:25%;bottom:${j*25}%" aria-hidden="true">${v}</i>`).join('');});
      $('status-label').textContent='정렬된 병';$('status').textContent=`${s().tubes.filter(t=>t.length===4&&t.every(v=>v===t[0])).length}/${s().n}`;$('meta-left').textContent=selected<0?'한 병씩, 차분하게.':`${selected+1}번 병 → 받을 병을 고르세요`;$('meta-right').textContent=`${s().n}가지 색 · 병당 4칸`;
    } else if(kind==='number'){
      const n=s().n;board.querySelectorAll('button').forEach(button=>{const v=Number(button.dataset.value),i=s().board.indexOf(v);button.style.width=`${100/n}%`;button.style.height=`${100/n}%`;button.style.left=`${i%n*100/n}%`;button.style.top=`${Math.floor(i/n)*100/n}%`;button.dataset.index=i;button.classList.toggle('correct',i===v-1);button.setAttribute('aria-label',`숫자 ${v}, ${Math.floor(i/n)+1}행 ${i%n+1}열`);});const blank=s().board.indexOf(0),empty=board.querySelector('.number-empty');empty.style.width=`${100/n}%`;empty.style.height=`${100/n}%`;empty.style.left=`${blank%n*100/n}%`;empty.style.top=`${Math.floor(blank/n)*100/n}%`;
      $('status-label').textContent='제자리';$('status').textContent=`${s().board.filter((v,i)=>v&&v===i+1).length}/${n*n-1}`;$('meta-left').textContent='왼쪽 위부터 1, 2, 3…';$('meta-right').textContent='빈칸은 오른쪽 아래';
    } else if(kind==='memory'){
      board.querySelectorAll('button').forEach((button,i)=>{const visible=peeking||s().open.includes(i)||s().matched[i];button.classList.toggle('revealed',visible);button.classList.toggle('matched',s().matched[i]);button.disabled=s().matched[i];button.setAttribute('aria-label',`${i+1}번 카드, ${visible?SYMBOL_NAMES[s().deck[i]]:'뒤집혀 있음'}${s().matched[i]?', 짝 찾음':''}`);const face=button.querySelector('.card-front');face.style.setProperty('--card',COLORS[s().deck[i]%COLORS.length]);face.innerHTML=`<svg viewBox="0 0 32 32">${SYMBOLS[s().deck[i]]}</svg>`;});
      $('status-label').textContent='찾은 짝';$('status').textContent=`${s().matched.filter(Boolean).length/2}/${s().pairs}`;$('meta-left').textContent=peeking?'그림의 자리를 기억해 보세요':'기억은 한 장씩 쌓여요';$('meta-right').textContent=`전체 보기 ${s().peeks?'사용함':'1회 남음'}`;
    } else {
      const connected=new Set(E.connections(s()).indices);board.querySelectorAll('button').forEach((button,i)=>{button.classList.toggle('connected',connected.has(i));button.classList.toggle('source',i===s().source);button.classList.toggle('hinted',hintMark===i);let mask=s().solution[i],target=0;while(mask!==s().board[i]&&target<4){mask=E.rotate(mask);target++;}const previous=Number(button.dataset.angle),mod=((previous%360)+360)%360;let delta=(target*90-mod+360)%360;if(delta>180)delta-=360;const angle=previous+delta;button.dataset.angle=angle;button.querySelector('svg').style.transform=`rotate(${angle}deg)`;button.setAttribute('aria-label',`${Math.floor(i/s().n)+1}행 ${i%s().n+1}열, ${i===s().source?'시작점, ':''}${connected.has(i)?'빛 연결됨':'연결 안 됨'}. 눌러 회전`);});
      $('status-label').textContent='빛이 닿은 칸';$('status').textContent=`${connected.size}/${s().board.length}`;$('meta-left').textContent='금빛 점에서 모든 칸으로';$('meta-right').textContent=`한 칸 도움 ${s().hints}회`;
    }
    $('undo')&&($('undo').disabled=busy||!data.history.length);
    if($('action'))$('action').disabled=busy||won||(kind==='memory'&&s().peeks>0);
    $('finish').hidden=!won;board.inert=won;
    if(won){$('finish-copy').innerHTML=config.endCopy(s());if(!lastWon){announce(config.end.replace(/<[^>]*>/g,'')+`. ${s().moves}회.`);$('finish-next').focus({preventScroll:true});celebrate();tone(true);}}
    lastWon=won;
  }
  function commit(next,storeHistory=true){if(!next)return false;if(storeHistory&&kind!=='memory'){data.history.push(clone(s()));data.history=data.history.slice(-40);}data.state=next;hintMark=-1;selected=-1;save();render();return true;}
  function act(index){
    if(busy||E.won(s())||$('help-dialog').open||$('confirm-dialog').open)return;
    if(kind==='water'){
      if(selected<0){if(!s().tubes[index].length){message='물이 들어 있는 병을 먼저 골라 주세요.';render();return;}selected=index;message='받을 병을 눌러 주세요. 같은 병을 누르면 선택이 풀려요.';render();return;}
      if(selected===index){selected=-1;message=config.hint;render();return;}
      const next=E.act(s(),selected,index);
      if(!next){if(s().tubes[index].length){selected=index;message='이 병을 새로 골랐어요. 같은 색이나 빈 병에 부어 보세요.';}else message='이 병으로는 부을 수 없어요.';render();announce(message);return;}
      message='잘 옮겼어요. 위에 놓인 색을 살펴보세요.';commit(next);const target=$('board').querySelector(`[data-index="${index}"]`);target.classList.remove('receiving');void target.offsetWidth;target.classList.add('receiving');tone();announce(`${next.moves}번 부었어요.`);return;
    }
    const next=E.act(s(),index);if(!next){if(kind==='number'){message='빈칸과 맞닿은 숫자만 움직일 수 있어요.';render();announce(message);}return;}
    message=config.hint;commit(next);if(!E.won(s()))tone();
    if(kind==='memory'&&s().open.length===2){busy=true;message='잠깐 기억해 두세요.';render();settleTimer=setTimeout(()=>{data.state=E.settle(s());busy=false;message=config.hint;save();render();},750);}
    if(!E.won(s()))announce(kind==='memory'?`${s().open.length===1?'카드 한 장을 열었어요.':`${s().matched.filter(Boolean).length/2}쌍을 찾았어요.`}`:`${config.main} ${s().moves}회.`);
  }
  function cancelTimers(){clearTimeout(settleTimer);clearTimeout(peekTimer);clearTimeout(fxTimer);busy=false;peeking=false;pointer=null;$('sparks').replaceChildren();}
  function resetState(){const current=clone(s());current.moves=0;if('hints'in current)current.hints=0;if(kind==='water')current.tubes=clone(current.start);else if(kind==='memory'){current.matched=Array(current.deck.length).fill(false);current.open=[];current.peeks=0;}else current.board=[...current.start];return current;}
  function start(type,value=level()){cancelTimers();data.state=type==='same'?resetState():E.create(value,seed());data.history=[];data.awarded=false;selected=-1;hintMark=-1;message=config.hint;lastWon=false;layout='';save();render();announce('새로운 한 판을 시작했어요.');}
  function requestStart(type,value=level()){if(busy)return;if(!s().moves&&!E.won(s())){start(type,value);return;}if(E.won(s())){start(type,value);return;}pending=()=>start(type,value);$('confirm-copy').innerHTML=type==='same'?'현재 퍼즐의 처음 배치로 돌아가요.<br>이동 횟수도 0부터 시작해요.':'현재 진행은 초기화돼요.<br>완료 기록과 다른 게임의 진행은 그대로 남아요.';$('confirm-dialog').showModal();}
  function action(){
    if(busy||E.won(s()))return;
    if(kind==='lights'){const solution=E.solve(s());hintMark=solution[0]??-1;data.state.hints++;message=`테두리로 표시한 ${Math.floor(hintMark/s().n)+1}행 ${hintMark%s().n+1}열을 눌러 보세요.`;save();render();announce(message);}
    if(kind==='pipes'){const next=E.hint(s());if(next){message='한 조각을 원래 방향에 맞췄어요.';commit(next.state);hintMark=next.index;render();tone();announce(message);}}
    if(kind==='memory'&&!s().peeks){data.state.peeks=1;peeking=true;busy=true;message='자리를 기억해 보세요. 잠시 후 다시 닫혀요.';save();render();announce(message);peekTimer=setTimeout(()=>{peeking=false;busy=false;message=config.hint;render();},1350);}
  }
  function celebrate(){if(reduced.matches)return;const target=$('sparks');target.replaceChildren();for(let i=0;i<22;i++){const spark=document.createElement('i');spark.className='spark';spark.style.setProperty('--dx',`${(Math.random()-.5)*320}px`);spark.style.setProperty('--dy',`${(Math.random()-.6)*300}px`);spark.style.animationDelay=`${Math.random()*.15}s`;spark.style.background=COLORS[i%COLORS.length];target.append(spark);}fxTimer=setTimeout(()=>target.replaceChildren(),1200);}
  $('board').addEventListener('click',event=>{if(performance.now()<suppressClick)return;const button=event.target.closest('button[data-index]');if(button)act(Number(button.dataset.index));});
  $('undo')?.addEventListener('click',()=>{if(busy||!data.history.length)return;cancelTimers();data.state=data.history.pop();selected=-1;hintMark=-1;message='한 수 되돌렸어요. 다른 방법을 살펴보세요.';save();render();announce(message);});
  $('action')?.addEventListener('click',action);$('reset').addEventListener('click',()=>requestStart('same'));$('new').addEventListener('click',()=>requestStart('new'));$('finish-next').addEventListener('click',()=>start('new'));
  $('difficulty').addEventListener('click',event=>{const button=event.target.closest('[data-level]');if(button&&Number(button.dataset.level)!==level())requestStart('new',Number(button.dataset.level));});
  $('help').addEventListener('click',()=>$('help-dialog').showModal());$('close-help').addEventListener('click',()=>$('help-dialog').close());$('cancel').addEventListener('click',()=>{pending=null;$('confirm-dialog').close();});$('confirm-dialog').addEventListener('cancel',()=>{pending=null;});$('confirm').addEventListener('click',()=>{$('confirm-dialog').close();const next=pending;pending=null;next?.();});
  $('sound').addEventListener('click',()=>{sound=!sound;try{localStorage.setItem('little-arcade:prefs',JSON.stringify({sound}));}catch{}save();render();tone();});
  if(kind==='number'){
    function blankMove(direction){const n=s().n,blank=s().board.indexOf(0),row=Math.floor(blank/n),col=blank%n,delta={left:[0,-1],right:[0,1],up:[-1,0],down:[1,0]}[direction],r=row+delta[0],c=col+delta[1];if(r>=0&&r<n&&c>=0&&c<n)act(r*n+c);}
    document.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||$('help-dialog').open||$('confirm-dialog').open||event.target.closest('input,textarea,select,[contenteditable=true]'))return;const direction={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[event.key];if(direction){event.preventDefault();blankMove(direction);}});
    $('board').addEventListener('pointerdown',event=>{if(event.isPrimary&&event.button===0){const tile=event.target.closest('button[data-index]');pointer={id:event.pointerId,x:event.clientX,y:event.clientY,index:tile?Number(tile.dataset.index):null};$('board').setPointerCapture(event.pointerId);}});
    $('board').addEventListener('pointerup',event=>{if(!pointer||pointer.id!==event.pointerId)return;const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y,index=pointer.index;pointer=null;if(Math.max(Math.abs(dx),Math.abs(dy))<24){if(index!==null)act(index);}else blankMove(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');suppressClick=performance.now()+250;});
    $('board').addEventListener('pointercancel',()=>{pointer=null;});
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(kind==='memory'&&s().open.length===2)data.state=E.settle(s());cancelTimers();save();render();}});
  save();render();
})();
