'use strict';
importScripts('offline-assets.js','legacy-routes.js');

const manifest=self.ARCADE_OFFLINE_MANIFEST;
const scope=new URL(self.registration.scope);
const prefix=`little-arcade-offline:${encodeURIComponent(scope.pathname)}:`;
const cacheName=prefix+manifest.version;
const markerURL=new URL('__arcade_offline_ready__',scope).href;
const assets=new Map(manifest.assets.map(asset=>[new URL(asset.path,scope).href,asset]));
const aliases=new Map(manifest.assets.filter(asset=>asset.path.endsWith('.html')).map(asset=>[new URL(asset.path.slice(0,-5),scope).href,new URL(asset.path,scope).href]));
const directories=new Map();
for(const asset of manifest.assets.filter(asset=>asset.path==='index.html'||asset.path.endsWith('/index.html'))){const file=new URL(asset.path,scope).href,directory=new URL('./',file).href;aliases.set(directory,file);directories.set(directory.slice(0,-1),directory);}
let warming=null;

function canonicalURL(value){
  const url=new URL(value);
  if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return null;
  url.search='';url.hash='';
  return assets.has(url.href)?url.href:aliases.get(url.href)||null;
}
async function verifiedResponse(url,asset){
  const response=await fetch(new Request(url,{cache:'reload',credentials:'same-origin',redirect:'error'}));
  if(!response.ok)throw new Error(`Offline asset unavailable: ${asset.path}`);
  const bytes=await response.clone().arrayBuffer();
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  if(hash!==asset.sha256)throw new Error(`Offline asset version mismatch: ${asset.path}`);
  return response;
}
function populate(){
  if(warming)return warming;
  warming=(async()=>{
    // Verify the entire release before writing anything, so a partial deployment cannot replace it.
    const loaded=await Promise.all([...assets].map(async([url,asset])=>[url,await verifiedResponse(url,asset)]));
    const cache=await caches.open(cacheName);
    await Promise.all(loaded.map(([url,response])=>cache.put(url,response)));
    await cache.put(markerURL,new Response(JSON.stringify({version:manifest.version}),{headers:{'Content-Type':'application/json'}}));
  })().finally(()=>{warming=null;});
  return warming;
}
async function status(){
  const cache=await caches.open(cacheName);
  const marker=await cache.match(markerURL);
  let ready=false;
  if(marker){
    try{const value=await marker.json();if(value.version===manifest.version)ready=(await Promise.all([...assets.keys()].map(url=>cache.match(url)))).every(Boolean);}catch{}
  }
  return {type:'ARCADE_OFFLINE_STATUS',ready,version:manifest.version,gameCount:manifest.gameCount};
}
async function broadcast(message){
  const clients=await self.clients.matchAll({type:'window'});
  clients.forEach(client=>client.postMessage(message));
}
self.addEventListener('install',event=>{
  // Updates deliberately wait for the old game windows to close. Never interrupt a running game.
  // The root migration can be warming the same verified cache concurrently; keep partial data for a retry.
  event.waitUntil((async()=>{if(!(await status()).ready)await populate();})());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith(prefix)&&name!==cacheName).map(name=>caches.delete(name).catch(()=>false)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  const type=event.data?.type;
  if(type!=='ARCADE_OFFLINE_GET_STATUS'&&type!=='ARCADE_OFFLINE_PREPARE'&&type!=='ARCADE_OFFLINE_CLEAN_LEGACY')return;
  event.waitUntil((async()=>{
    let result;
    try{
      if(type==='ARCADE_OFFLINE_CLEAN_LEGACY')result=await cleanLegacyCaches();
      else{if(type==='ARCADE_OFFLINE_PREPARE')await populate();result=await status();}
    }catch{result={type:'ARCADE_OFFLINE_STATUS',ready:false,error:true,version:manifest.version,gameCount:manifest.gameCount};}
    if(event.ports?.[0])event.ports[0].postMessage(result);
    else event.source?.postMessage(result);
    if(type==='ARCADE_OFFLINE_PREPARE')await broadcast(result);
  })());
});
function unavailablePage(){
  const href=scope.href;
  return new Response(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오프라인 준비가 필요해요</title><body style="margin:0;padding:40px 24px;background:#142230;color:#f2eee5;font:16px/1.9 system-ui,sans-serif"><main style="max-width:460px;margin:10vh auto"><h1 style="font-size:26px">이 게임은 아직 저장되지 않았어요.</h1><p>인터넷이 연결됐을 때 게임 보관함을 열고 ‘오프라인 준비 완료’를 확인해 주세요.</p><a href="${href}" style="color:#edc98d">게임 보관함 열기</a></main></body></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||event.request.headers.has('range'))return;
  const requested=new URL(event.request.url),directory=directories.get(requested.origin+requested.pathname);
  if(directory&&event.request.mode==='navigate'){const target=new URL(directory);target.search=requested.search;event.respondWith(Promise.resolve(Response.redirect(target.href,302)));return;}
  const url=canonicalURL(event.request.url);
  if(!url)return; // Other site tools, API calls and external requests keep their normal behavior.
  event.respondWith((async()=>{
    let cache=null,cached=null;
    try{cache=await caches.open(cacheName);cached=await cache.match(url);}catch{}
    if(cached)return cached;
    try{
      const response=await verifiedResponse(url,assets.get(url));
      if(cache)await cache.put(url,response.clone()).catch(()=>{});
      return response;
    }catch{return event.request.mode==='navigate'?unavailablePage():Response.error();}
  })());
});

async function cleanLegacyCaches(){
  if(!(await status()).ready)return {type:'ARCADE_OFFLINE_LEGACY_CLEANED',removed:0,blocked:true};
  const parent=new URL('../',scope),clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const legacyOpen=clients.some(client=>{
    if(!client.url)return true;
    try{const url=new URL(client.url);if(url.origin!==parent.origin||!url.pathname.startsWith(parent.pathname))return false;const relative=url.pathname.slice(parent.pathname.length);return Object.hasOwn(self.ARCADE_LEGACY_ROUTES,relative)||Object.hasOwn(self.ARCADE_LEGACY_ROUTES,relative+'.html');}catch{return true;}
  });
  if(legacyOpen)return {type:'ARCADE_OFFLINE_LEGACY_CLEANED',removed:0,blocked:true};
  const oldPrefix=`little-arcade-offline:${encodeURIComponent(parent.pathname)}:`;
  const old=(await caches.keys()).filter(name=>name.startsWith(oldPrefix));
  await Promise.all(old.map(name=>caches.delete(name)));
  return {type:'ARCADE_OFFLINE_LEGACY_CLEANED',removed:old.length,blocked:false};
}
