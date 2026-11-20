(function(){
  'use strict';
  const source=document.currentScript||Array.from(document.scripts).find(script=>script.src.endsWith('/shared/offline-client.js'));
  const scriptURL=new URL(source?.src||'shared/offline-client.js',document.baseURI);
  const scope=new URL('../',scriptURL),workerURL=new URL('games-sw.js',scope);
  let panel=document.getElementById('arcade-offline-status');
  if(!panel){
    panel=document.createElement('div');panel.id='arcade-offline-status';panel.className='arcade-offline-note';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
    panel.innerHTML='<span data-offline-title></span><button data-offline-retry type="button" hidden>다시 시도</button>';
    const footer=document.querySelector('footer');if(footer)footer.before(panel);else document.body.append(panel);
  }
  const title=panel.querySelector('[data-offline-title]'),detail=panel.querySelector('[data-offline-detail]'),retry=panel.querySelector('[data-offline-retry]');
  const registrations=new WeakSet(),workers=new WeakSet();
  let registration=null,ready=false,waiting=false,loading=true,failed=false,unsupported=false,gameCount=0,starting=null,refreshing=null,retiring=null,retired=false;
  const own=worker=>worker?.scriptURL===workerURL.href;
  function render(){
    const offline=navigator.onLine===false,pending=loading&&!failed;
    panel.dataset.state=unsupported?'unsupported':ready?(offline?'offline':'ready'):pending?'loading':'error';
    if(unsupported){title.textContent='이 브라우저에서는 오프라인 저장을 지원하지 않아요.';if(detail)detail.textContent='온라인 상태에서는 게임을 그대로 플레이할 수 있어요.';}
    else if(ready){
      title.textContent=offline?'오프라인으로 플레이 중':'오프라인 준비 완료';
      if(detail)detail.textContent=waiting?'새 버전이 준비됐어요. 게임 창을 모두 닫았다 다시 열면 적용돼요.':offline?`저장한 게임 ${gameCount}개와 진행 기록을 그대로 사용할 수 있어요.`:`게임 ${gameCount}개를 저장했어요. 연결이 끊겨도 이 보관함에서 열 수 있어요.`;
      else if(waiting)title.textContent+=' · 새 버전은 창을 닫은 뒤 적용';
    }else if(pending){title.textContent=offline?'저장된 게임 확인 중':'오프라인 플레이 준비 중';if(detail)detail.textContent=offline?'이 브라우저에 저장된 게임을 확인하고 있어요.':'게임을 저장하고 있어요. 준비 완료 표시가 나올 때까지 잠깐 열어두세요.';}
    else{title.textContent='오프라인 저장이 아직 완료되지 않았어요.';if(detail)detail.textContent='인터넷 연결과 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.';}
    if(retry){retry.hidden=unsupported||ready||(!failed&&!offline);retry.disabled=loading;}
  }
  function request(worker,type,timeout=8000){
    return new Promise((resolve,reject)=>{
      const channel=new MessageChannel();
      const timer=setTimeout(()=>{channel.port1.close();reject(new Error('Offline status timeout'));},timeout);
      channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};
      try{worker.postMessage({type},[channel.port2]);}catch(error){clearTimeout(timer);channel.port1.close();reject(error);}
    });
  }
  function accept(value){
    if(value?.type!=='ARCADE_OFFLINE_STATUS'||typeof value.ready!=='boolean')return;
    if(Number.isInteger(value.gameCount)&&value.gameCount>0)gameCount=value.gameCount;
    ready=value.ready;failed=!ready&&value.error===true;loading=false;waiting=Boolean(registration?.waiting);render();
    if(ready)retireLegacy(registration?.active||navigator.serviceWorker?.controller);
  }
  function retireLegacy(worker){
    if(retired||retiring||!own(worker))return;
    retiring=(async()=>{
      const parent=new URL('../',scope),oldURL=new URL('games-sw.js',parent).href;
      const old=await navigator.serviceWorker.getRegistration(parent.href);
      if(old){
        if(old.scope!==parent.href||![old.active,old.waiting,old.installing].some(value=>value?.scriptURL===oldURL))return;
        await old.unregister();
      }
      const result=await request(worker,'ARCADE_OFFLINE_CLEAN_LEGACY');retired=result?.blocked===false;
    })().catch(()=>{}).finally(()=>{retiring=null;});
  }
  function refresh(worker=navigator.serviceWorker?.controller){
    if(!own(worker))return Promise.resolve();
    if(refreshing)return refreshing;
    refreshing=request(worker,'ARCADE_OFFLINE_GET_STATUS').then(value=>{
      accept(value);
      if(!ready&&navigator.onLine!==false){loading=true;failed=false;render();return request(worker,'ARCADE_OFFLINE_PREPARE',45000).then(accept);}
    }).catch(()=>{if(!ready){failed=true;loading=false;render();}}).finally(()=>{refreshing=null;});
    return refreshing;
  }
  function watchWorker(worker){
    if(!worker||workers.has(worker))return;workers.add(worker);
    worker.addEventListener('statechange',()=>{
      waiting=Boolean(registration?.waiting)||(worker.state==='installed'&&Boolean(registration?.active));
      if(worker.state==='activated')refresh(registration?.active||worker);
      if(worker.state==='redundant'&&!ready&&!registration?.active){failed=true;loading=false;}
      render();
    });
  }
  function setup(value){
    registration=value;waiting=Boolean(value.waiting);
    if(!registrations.has(value)){registrations.add(value);value.addEventListener('updatefound',()=>{watchWorker(value.installing);render();});}
    watchWorker(value.installing);watchWorker(value.waiting);watchWorker(value.active);
    render();return refresh(value.active||navigator.serviceWorker.controller);
  }
  function start(){
    if(starting)return starting;
    if(!('serviceWorker'in navigator)||!window.isSecureContext){unsupported=true;loading=false;render();return Promise.resolve();}
    loading=!ready;failed=false;render();
    starting=navigator.serviceWorker.register(workerURL.href,{scope:scope.href,updateViaCache:'none'}).then(async value=>{
      await setup(value);if(navigator.onLine!==false)value.update().catch(()=>{});
    }).catch(async()=>{
      try{const value=await navigator.serviceWorker.getRegistration(scope.href);if(value?.scope===scope.href&&own(value.active)){await setup(value);return;}}catch{}
      if(!ready){failed=true;loading=false;render();}
    }).finally(()=>{starting=null;});
    return starting;
  }
  retry?.addEventListener('click',start);
  if('serviceWorker'in navigator){
    navigator.serviceWorker.addEventListener('controllerchange',()=>refresh());
    navigator.serviceWorker.addEventListener('message',event=>{if(own(event.source)&&event.source===navigator.serviceWorker.controller)accept(event.data);});
  }
  window.addEventListener('offline',render);window.addEventListener('online',()=>{render();start();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){waiting=Boolean(registration?.waiting);render();refresh();}});
  render();start();
})();
