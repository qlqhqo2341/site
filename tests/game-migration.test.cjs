const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createHarness,MemoryCacheStorage,release,root,gameRoot}=require('./helpers/offline-worker.cjs');
const {redirect,routes}=require('../scripts/build-legacy-redirects.cjs');

for(const scope of ['https://example.test/','https://example.test/site/'])test(`old HTML bookmarks preserve their destination, query and fragment at ${scope}`,()=>{
  for(const [file,target]of Object.entries(routes)){
    const html=fs.readFileSync(path.join(root,file),'utf8');assert.equal(html,redirect(file,target));assert.ok(html.length<1200);
    let replaced;const location={search:'?from=bookmark',hash:'#continue',replace(value){replaced=value;}};
    vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{URL,document:{baseURI:new URL(file,scope).href},location});
    assert.equal(replaced,new URL('games/'+target+'?from=bookmark#continue',scope).href);
    assert.ok(fs.existsSync(path.join(gameRoot,target.endsWith('.html')?target:target+'index.html')));
  }
});

test('the host alias /games/ redirects to the explicit library index without duplicating its path',()=>{
  const html=fs.readFileSync(path.join(root,'games.html'),'utf8');
  for(const prefix of ['/','/site/'])for(const entry of ['games','games/','games.html']){
    let replaced;const location={search:'?via=alias',hash:'#resume',replace(value){replaced=value;}};
    vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{URL,document:{baseURI:'https://example.test'+prefix+entry},location});
    assert.equal(replaced,'https://example.test'+prefix+'games/index.html?via=alias#resume');
  }
});

test('an incomplete migration keeps the old offline cache and root registration',async()=>{
  const caches=new MemoryCacheStorage(),legacyName='little-arcade-offline:%2F:v1-old';
  const old=await caches.open(legacyName);await old.put('https://example.test/potion.js',new Response('old game'));
  for(const invalid of [undefined,Buffer.from('mixed release')]){
    const h=createHarness({legacy:true,cacheStorage:caches});h.network.set(new URL('moonlit-sort/potion.js',h.gameScope).href,invalid);
    await assert.rejects(h.install());assert.equal(h.skipped,0);assert.equal(h.unregistered,0);
    assert.equal(await(await old.match('https://example.test/potion.js')).text(),'old game');
    const target=await caches.open(h.cacheName);assert.equal(await target.match(new URL('__arcade_offline_ready__',h.gameScope).href),undefined);
  }
});

for(const scope of ['https://example.test/','https://example.test/site/'])test(`root migration prepares all games before retiring itself at ${scope}`,async()=>{
  const clients=[],navigated=[],caches=new MemoryCacheStorage();let h;
  for(const file of [...Object.keys(routes),'moonlit-sort','index.html','clock/index.html','games/moonlit-sort/'])clients.push({
    url:new URL(file+'?from=old#resume',scope).href,
    async navigate(url){assert.equal(h.unregistered,1);assert.equal(h.skipped,1);navigated.push(url);this.navigated=true;this.url=url;}
  });
  h=createHarness({legacy:true,scope,clients,cacheStorage:caches});
  const oldName=`little-arcade-offline:${encodeURIComponent(new URL(scope).pathname)}:v1-old`;
  const old=await caches.open(oldName);await old.put(new URL('potion.js',scope).href,new Response('old game'));
  await h.install();assert.equal(h.skipped,1);assert.equal(h.unregistered,0);assert.equal(h.calls.length,release.assets.length);
  h.setOffline();h.calls.length=0;
  assert.equal((await h.fetch('games/moonlit-sort/',{mode:'navigate'})).response.status,200);
  assert.equal(await(await h.fetch('potion.js')).response.text(),'old game');
  const bookmark=await h.fetch('moonlit-sort.html?from=bookmark',{mode:'navigate'});
  assert.equal(bookmark.response.headers.get('Location'),new URL('games/moonlit-sort/?from=bookmark',scope).href);
  assert.equal((await h.fetch('clock/index.html',{mode:'navigate'})).handled,false);assert.equal(h.calls.length,0);
  await h.activate();assert.equal(h.unregistered,1);assert.equal(h.claimed,0);assert.equal(navigated.length,Object.keys(routes).length+1);
  for(const url of navigated){assert.ok(url.startsWith(h.gameScope));assert.ok(url.endsWith('?from=old#resume'));}
  for(const client of clients.slice(-3))assert.ok(!client.navigated);
  assert.ok((await caches.keys()).includes(oldName),'Old game windows can finish using their old resources.');
  const child=createHarness({scope:h.gameScope,cacheStorage:caches});child.setOffline();await child.install();await child.activate();
  assert.equal(child.calls.length,0);assert.equal((await child.message('ARCADE_OFFLINE_GET_STATUS')).ready,true);
  assert.ok((await caches.keys()).includes(oldName),'The child waits for explicit registration retirement before cleanup.');
});

test('legacy caches are removed only after readiness and after the last old game window leaves',async()=>{
  const clients=[{url:'https://example.test/site/moonlit-sort.html'}],h=createHarness({scope:'https://example.test/site/games/',clients});
  const oldName='little-arcade-offline:%2Fsite%2F:v1-old',foreignName='little-arcade-offline:%2F:v1-other';
  await h.cacheStorage.open(oldName);await h.cacheStorage.open(foreignName);await h.cacheStorage.open('another-app');
  assert.equal((await h.message('ARCADE_OFFLINE_CLEAN_LEGACY')).blocked,true);
  await h.install();assert.equal((await h.message('ARCADE_OFFLINE_CLEAN_LEGACY')).blocked,true);assert.ok((await h.cacheStorage.keys()).includes(oldName));
  clients[0].url='https://example.test/site/moonlit-sort';assert.equal((await h.message('ARCADE_OFFLINE_CLEAN_LEGACY')).blocked,true);
  clients[0].url='https://example.test/site/games/moonlit-sort/';
  const result=await h.message('ARCADE_OFFLINE_CLEAN_LEGACY');assert.equal(result.blocked,false);assert.equal(result.removed,1);
  assert.deepEqual(new Set(await h.cacheStorage.keys()),new Set([h.cacheName,foreignName,'another-app']));
});

class MessageChannel{
  constructor(){
    this.port1={onmessage:null,close(){}};this.port2={postMessage:value=>queueMicrotask(()=>this.port1.onmessage?.({data:value}))};
  }
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function clientHarness(oldKind,prepared){
  const h=createHarness({scope:'https://example.test/site/games/'});if(prepared)await h.install();
  const events=[],callbacks={},panel={dataset:{},querySelector:()=>({hidden:false,disabled:false,textContent:'',addEventListener(){}})};
  const worker={scriptURL:h.url('games-sw.js'),state:'activated',addEventListener(){},postMessage(data,ports){events.push(data.type);h.message(data.type).then(result=>ports[0].postMessage(result));}};
  const registration={scope:h.scope,active:worker,addEventListener(){},update:async()=>{}};
  const old=oldKind==='absent'?undefined:{scope:'https://example.test/site/',active:{scriptURL:`https://example.test/site/${oldKind==='owned'?'games-sw.js':'other-sw.js'}`},async unregister(){events.push('unregister');assert.equal((await h.message('ARCADE_OFFLINE_GET_STATUS')).ready,true);return true;}};
  const navigator={onLine:false,serviceWorker:{controller:worker,addEventListener(){},async register(url,options){assert.equal(url,h.url('games-sw.js'));assert.equal(options.scope,h.scope);return registration;},async getRegistration(url){assert.equal(url,'https://example.test/site/');return old;}}};
  const document={currentScript:{src:h.url('shared/offline-client.js')},baseURI:h.url('moonlit-sort/'),getElementById:()=>panel,addEventListener(type,fn){callbacks[type]=fn;}};
  vm.runInNewContext(fs.readFileSync(path.join(gameRoot,'shared/offline-client.js'),'utf8'),{document,navigator,window:{isSecureContext:true,addEventListener(){}},URL,MessageChannel,setTimeout,clearTimeout});
  for(let n=0;n<30;n++)await tick();
  return {h,events,panel,callbacks};
}

test('the offline client retires only the owned root registration after the new cache is ready',async()=>{
  for(const kind of ['owned','foreign','absent']){
    const {events,panel}=await clientHarness(kind,true);assert.equal(panel.dataset.state,'offline');
    assert.equal(events.includes('unregister'),kind==='owned');assert.equal(events.includes('ARCADE_OFFLINE_CLEAN_LEGACY'),kind!=='foreign');
    if(kind==='owned')assert.ok(events.indexOf('unregister')>events.indexOf('ARCADE_OFFLINE_GET_STATUS'));
  }
  const {events}=await clientHarness('owned',false);assert.ok(!events.includes('unregister'));assert.ok(!events.includes('ARCADE_OFFLINE_CLEAN_LEGACY'));
});
