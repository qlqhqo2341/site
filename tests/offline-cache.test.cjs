const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createHarness,MemoryCacheStorage,release,root,sha256}=require('./helpers/offline-worker.cjs');

test('offline release covers every game, its dependencies and the potion hint Worker',()=>{
  const expected=require('../scripts/build-offline-cache.cjs').source();
  assert.equal(fs.readFileSync(path.join(root,'offline-assets.js'),'utf8'),expected,'Run node scripts/build-offline-cache.cjs after changing game files.');
  assert.equal(release.gameCount,8);assert.equal(new Set(release.assets.map(asset=>asset.path)).size,release.assets.length);
  for(const name of ['games.html','moonlit-sort.html','night-pieces.html','train-2048.html','lights-out.html','water-sort.html','number-trail.html','memory-garden.html','star-path.html','potion-solver.js','potion-engine.js','offline-client.js','offline.css'])assert.ok(release.assets.some(asset=>asset.path===name),name);
  for(const asset of release.assets){assert.equal(asset.sha256,sha256(fs.readFileSync(path.join(root,asset.path))));if(asset.path.endsWith('.html')){const html=fs.readFileSync(path.join(root,asset.path),'utf8');assert.equal((html.match(/src="offline-client.js"/g)||[]).length,1);assert.ok(html.includes('href="offline.css"'));}}
});

test('first install verifies all files and reports ready only after full storage',async()=>{
  const h=createHarness();assert.equal((await h.message('ARCADE_OFFLINE_GET_STATUS')).ready,false);
  await h.install();assert.equal(h.calls.length,release.assets.length);assert.equal(h.skipped,0);
  await h.activate();assert.equal(h.claimed,1);
  const status=await h.message('ARCADE_OFFLINE_GET_STATUS');assert.equal(status.ready,true);assert.equal(status.gameCount,8);assert.equal(status.version,release.version);
});

for(const scope of ['https://example.test/','https://example.test/site/'])test(`every game and asset opens with no network at ${scope}`,async()=>{
  const h=createHarness({scope});await h.install();await h.activate();h.setOffline();h.calls.length=0;
  for(const asset of release.assets){
    const result=await h.fetch(asset.path,{mode:asset.path.endsWith('.html')?'navigate':'same-origin'});
    assert.ok(result.handled,asset.path);assert.equal(result.response.status,200);assert.equal(sha256(Buffer.from(await result.response.arrayBuffer())),asset.sha256);
  }
  assert.equal(h.calls.length,0,'An offline cache hit must not wait for a network timeout.');
});

test('query strings and extensionless game links use the same offline copy',async()=>{
  const h=createHarness({scope:'https://example.test/site/'});await h.install();h.setOffline();h.calls.length=0;
  for(const name of ['games','moonlit-sort','night-pieces','train-2048']){const result=await h.fetch(name+'?from=train',{mode:'navigate'});assert.equal(result.response.status,200);assert.equal(await result.response.text(),fs.readFileSync(path.join(root,name+'.html'),'utf8'));}
  const script=await h.fetch('potion-solver.js?v=123');assert.equal(script.response.status,200);assert.equal(h.calls.length,0);
});

test('other tools, APIs, origins, mutations and range requests pass through untouched',async()=>{
  const h=createHarness({scope:'https://example.test/site/'});
  for(const [url,options]of [['clock/index.html',{}],['https://example.test/games.html',{}],['https://outside.test/games.html',{}],['api/data',{}],['potion.js',{method:'POST'}],['potion.js',{headers:{range:'bytes=0-9'}}],['games-sw.js',{}],['offline-assets.js',{}]])assert.equal((await h.fetch(url,options)).handled,false,url);
  assert.equal(h.calls.length,0);
});

test('a missing asset or mismatched release never replaces the working offline version',async()=>{
  const caches=new MemoryCacheStorage(),old=createHarness({cacheStorage:caches});await old.install();await old.activate();
  for(const missing of [true,false]){
    const next=createHarness({cacheStorage:caches,manifest:{...release,version:'v1-broken-'+missing}});
    if(missing)next.network.delete(next.url('potion.js'));else next.network.set(next.url('potion.js'),Buffer.from('wrong release'));
    await assert.rejects(next.install());assert.ok(!(await caches.keys()).includes(next.cacheName));assert.ok((await caches.keys()).includes(old.cacheName));
  }
  old.setOffline();assert.equal((await old.fetch('moonlit-sort.html',{mode:'navigate'})).response.status,200);assert.equal((await old.message('ARCADE_OFFLINE_GET_STATUS')).ready,true);
});

test('failed reinstall with the same version preserves an existing working cache',async()=>{
  const caches=new MemoryCacheStorage(),old=createHarness({cacheStorage:caches});await old.install();
  const same=createHarness({cacheStorage:caches});same.network.delete(same.url('arcade-play.js'));await assert.rejects(same.install());
  old.setOffline();assert.equal((await old.message('ARCADE_OFFLINE_GET_STATUS')).ready,true);assert.equal((await old.fetch('arcade-play.js')).response.status,200);
});

test('new activation cleans only its own old release; storage and other scopes stay intact',async()=>{
  const caches=new MemoryCacheStorage(),old=createHarness({cacheStorage:caches});await old.install();
  const unrelated=await caches.open('some-other-app');await unrelated.put('https://example.test/keep',new Response('saved'));
  const nested=createHarness({scope:'https://example.test/site/',cacheStorage:caches});await nested.install();
  const next=createHarness({cacheStorage:caches,manifest:{...release,version:'v1-next'}});await next.install();
  assert.ok((await caches.keys()).includes(old.cacheName));assert.equal(next.skipped,0);
  await next.activate();assert.ok(!(await caches.keys()).includes(old.cacheName));assert.ok((await caches.keys()).includes(next.cacheName));assert.ok((await caches.keys()).includes(nested.cacheName));assert.ok((await caches.keys()).includes('some-other-app'));
  assert.equal(await(await unrelated.match('https://example.test/keep')).text(),'saved');
});

test('purged storage is detected, offline misses stay uncached, and online preparation repairs it',async()=>{
  const h=createHarness();await h.install();const cache=await h.cacheStorage.open(h.cacheName);
  await cache.delete(h.url('moonlit-sort.html'));await cache.delete(h.url('potion-solver.js'));
  assert.equal((await h.message('ARCADE_OFFLINE_GET_STATUS')).ready,false);h.setOffline();
  const page=(await h.fetch('moonlit-sort.html',{mode:'navigate'})).response;assert.equal(page.status,503);assert.match(await page.text(),/게임 보관함 열기/);assert.equal(await cache.match(h.url('moonlit-sort.html')),undefined);
  assert.equal((await h.fetch('potion-solver.js')).response.type,'error');
  h.setOffline(false);assert.equal((await h.message('ARCADE_OFFLINE_PREPARE')).ready,true);h.setOffline();h.calls.length=0;
  assert.equal((await h.fetch('moonlit-sort.html',{mode:'navigate'})).response.status,200);assert.equal((await h.fetch('potion-solver.js')).response.status,200);assert.equal(h.calls.length,0);
});

test('cached misses can use verified online responses even if storage becomes unavailable',async()=>{
  const h=createHarness();h.cacheStorage.blocked=true;const result=await h.fetch('games.html',{mode:'navigate'});assert.equal(result.response.status,200);assert.equal(await result.response.text(),fs.readFileSync(path.join(root,'games.html'),'utf8'));
  const writable=createHarness();writable.cacheStorage.writeBlocked=true;assert.equal((await writable.fetch('potion.js')).response.status,200);
});

test('a missing resource is repaired only with a matching file, never a different deployed version',async()=>{
  const h=createHarness();await h.install();const cache=await h.cacheStorage.open(h.cacheName);await cache.delete(h.url('potion.js'));
  h.network.set(h.url('potion.js'),Buffer.from('new incompatible script'));assert.equal((await h.fetch('potion.js')).response.type,'error');assert.equal(await cache.match(h.url('potion.js')),undefined);
  h.network.set(h.url('potion.js'),fs.readFileSync(path.join(root,'potion.js')));assert.equal((await h.fetch('potion.js')).response.status,200);h.setOffline();h.calls.length=0;assert.equal((await h.fetch('potion.js')).response.status,200);assert.equal(h.calls.length,0);
});

test('simultaneous preparation requests share one download and both receive a complete result',async()=>{
  const h=createHarness();await h.install();const cache=await h.cacheStorage.open(h.cacheName);await cache.delete(h.url('potion-solver.js'));h.calls.length=0;
  const results=await Promise.all([h.message('ARCADE_OFFLINE_PREPARE'),h.message('ARCADE_OFFLINE_PREPARE')]);
  assert.ok(results.every(result=>result.ready));assert.equal(h.calls.length,release.assets.length);
});

test('an offline worker restart reuses the persisted release without a new installation',async()=>{
  const caches=new MemoryCacheStorage(),first=createHarness({cacheStorage:caches});await first.install();await first.activate();
  const restarted=createHarness({cacheStorage:caches});restarted.setOffline();
  assert.equal((await restarted.message('ARCADE_OFFLINE_GET_STATUS')).ready,true);
  assert.equal((await restarted.fetch('moonlit-sort.html',{mode:'navigate'})).response.status,200);assert.equal((await restarted.fetch('potion-solver.js')).response.status,200);assert.equal(restarted.calls.length,0);
});
