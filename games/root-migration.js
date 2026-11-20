'use strict';
// Loaded only by the old root worker URL; this worker retires its own broad registration.
const legacyScope=new URL(self.registration.scope),gameScope=new URL('games/',legacyScope);
importScripts(new URL('offline-assets.js',gameScope).href,new URL('legacy-routes.js',gameScope).href);
const release=self.ARCADE_OFFLINE_MANIFEST;
const targetCache=`little-arcade-offline:${encodeURIComponent(gameScope.pathname)}:${release.version}`;
const oldPrefix=`little-arcade-offline:${encodeURIComponent(legacyScope.pathname)}:`;
const newAssets=new Map(release.assets.map(asset=>[new URL(asset.path,gameScope).href,asset]));
const oldAssets=new Set(release.assets.filter(asset=>!asset.path.endsWith('.html')).map(asset=>asset.path.split('/').at(-1)));
const newDirectories=new Map();
for(const asset of release.assets.filter(asset=>asset.path==='index.html'||asset.path.endsWith('/index.html'))){const file=new URL(asset.path,gameScope).href;newDirectories.set(new URL('./',file).href,file);}
function legacyTarget(value){
  const url=new URL(value);if(url.origin!==legacyScope.origin||!url.pathname.startsWith(legacyScope.pathname))return null;
  const relative=url.pathname.slice(legacyScope.pathname.length),key=Object.hasOwn(self.ARCADE_LEGACY_ROUTES,relative)?relative:relative+'.html';
  if(!Object.hasOwn(self.ARCADE_LEGACY_ROUTES,key))return null;
  const target=new URL(self.ARCADE_LEGACY_ROUTES[key],gameScope);target.search=url.search;target.hash=url.hash;return target;
}
async function download(url,asset){
  const response=await fetch(new Request(url,{cache:'reload',credentials:'same-origin',redirect:'error'}));
  if(!response.ok)throw Error('New game release is not available');
  const digest=await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer());
  const hash=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
  if(hash!==asset.sha256)throw Error('New game release is incomplete');return response;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const files=await Promise.all([...newAssets].map(async([url,asset])=>[url,await download(url,asset)]));
  const cache=await caches.open(targetCache);await Promise.all(files.map(([url,response])=>cache.put(url,response)));
  await cache.put(new URL('__arcade_offline_ready__',gameScope).href,new Response(JSON.stringify({version:release.version}),{headers:{'Content-Type':'application/json'}}));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  // Unregister first: subsequent navigations must not wait for this activating worker's fetch handler.
  await self.registration.unregister();
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  await Promise.all(clients.map(async client=>{const target=client.url&&legacyTarget(client.url);if(target&&client.navigate)try{await client.navigate(target.href);}catch{}}));
  // Old caches remain until the /games/ worker is ready and no old game windows are left.
})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const target=event.request.mode==='navigate'&&legacyTarget(event.request.url);
  if(target){event.respondWith(Promise.resolve(Response.redirect(target.href,302)));return;}
  const requested=new URL(event.request.url);requested.search='';requested.hash='';
  const nested=newDirectories.get(requested.href)||requested.href;
  if(newAssets.has(nested)){
    event.respondWith((async()=>{const cache=await caches.open(targetCache);return await cache.match(nested)||download(nested,newAssets.get(nested));})());return;
  }
  if(requested.origin!==legacyScope.origin||!requested.pathname.startsWith(legacyScope.pathname))return;
  const relative=requested.pathname.slice(legacyScope.pathname.length);if(!oldAssets.has(relative))return;
  event.respondWith((async()=>{
    for(const name of (await caches.keys()).filter(name=>name.startsWith(oldPrefix))){const cached=await(await caches.open(name)).match(requested.href);if(cached)return cached;}
    return fetch(event.request);
  })());
});
