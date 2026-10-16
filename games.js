(function () {
  'use strict';
  const {games,preview}=window.ArcadeCatalog,$=id=>document.getElementById(id);
  let favorites=new Set(),filter='all';
  try {const saved=JSON.parse(localStorage.getItem('little-arcade:favorites'));if(Array.isArray(saved))favorites=new Set(saved.filter(id=>games.some(game=>game.id===id)));}catch{}
  function progress(game){
    try{const value=JSON.parse(localStorage.getItem(game.key));if(game.id==='night'){const state=value?.games?.[value?.mode||'endless']?.state;return state?.moves>0?'이어서 하기':'플레이';}if(game.id==='train')return value?.state?.moves>0?'이어서 하기':'플레이';if(value?.awarded)return '다시 도전';return value?.state?.moves>0||value?.state?.open?.length?'이어서 하기':'플레이';}catch{return '플레이';}
  }
  let last;
  try {const saved=JSON.parse(localStorage.getItem('little-arcade:last'));last=games.find(game=>game.id===saved?.id);}catch{}
  if(!last)last=games.find(game=>progress(game)==='이어서 하기');
  const feature=last||games.find(game=>game.id==='water');
  $('featured').href=feature.href;$('featured-name').textContent=feature.name;$('featured-tag').textContent=feature.en;$('featured-art').innerHTML=preview(feature.id);$('featured-label').textContent=last?'마지막에 하던 한 판':'오늘의 한 판';$('featured-action').textContent=last?'이어서 →':'플레이 →';
  games.forEach((game,index)=>{
    const card=document.createElement('article');card.className='game-card';card.dataset.id=game.id;card.style.setProperty('--tint',`${game.accent}18`);
    card.innerHTML=`<a class="game-link" href="${game.href}" aria-label="${game.name} ${progress(game)}"><div class="card-art">${preview(game.id)}</div><div class="card-body"><div class="card-kicker"><span>${game.tag}</span>${['night','train'].includes(game.id)?'':'<b class="new">NEW</b>'}</div><h3 class="card-title">${game.name}</h3><p class="card-description">${game.description}</p><p class="card-detail">${game.detail}</p><div class="card-bottom"><span>GAME ${String(index+1).padStart(2,'0')}</span><span>${progress(game)} →</span></div></div></a><button class="favorite" type="button" data-favorite="${game.id}" aria-label="${game.name} 즐겨찾기" aria-pressed="false">♡</button>`;
    card.querySelector('.favorite').addEventListener('click',()=>{if(favorites.has(game.id))favorites.delete(game.id);else favorites.add(game.id);try{localStorage.setItem('little-arcade:favorites',JSON.stringify([...favorites]));}catch{}applyFilter();});
    $('game-grid').append(card);
  });
  function visibleGames(){return games.filter(game=>filter==='all'||(filter==='favorites'?favorites.has(game.id):game.group===filter));}
  function applyFilter(){
    const visible=new Set(visibleGames().map(game=>game.id));
    $('game-grid').querySelectorAll('.game-card').forEach(card=>{card.hidden=!visible.has(card.dataset.id);const button=card.querySelector('.favorite'),active=favorites.has(card.dataset.id);button.setAttribute('aria-pressed',String(active));button.textContent=active?'♥':'♡';});
    document.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===filter)));
    $('empty').hidden=visible.size>0;$('filter-status').textContent=`${visible.size}개의 게임이 보여요.`;
  }
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;applyFilter();}));
  $('show-all').addEventListener('click',()=>{filter='all';applyFilter();});
  $('random').addEventListener('click',()=>{let choices=visibleGames();if(!choices.length)choices=games;const seed=new Uint32Array(1);let r=Math.random();if(window.crypto?.getRandomValues)r=crypto.getRandomValues(seed)[0]/4294967296;window.location.href=choices[Math.floor(r*choices.length)].href;});
  applyFilter();
})();
