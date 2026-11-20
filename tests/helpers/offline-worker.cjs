'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.join(__dirname,'../..'),gameRoot=path.join(root,'games');
const release=require('../../scripts/build-offline-cache.cjs').build();
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
class MemoryCacheStorage{
  constructor(){this.stores=new Map();this.blocked=false;this.writeBlocked=false;}
  async open(name){
    if(this.blocked)throw Error('Storage denied');
    if(!this.stores.has(name))this.stores.set(name,new Map());const values=this.stores.get(name),storage=this;
    return {
      async match(request){return values.get(typeof request==='string'?request:request.url)?.clone();},
      async put(request,response){if(storage.writeBlocked)throw Error('Quota exceeded');values.set(typeof request==='string'?request:request.url,response.clone());},
      async delete(request){return values.delete(typeof request==='string'?request:request.url);},
      async keys(){return [...values.keys()].map(url=>new Request(url));}
    };
  }
  async keys(){if(this.blocked)throw Error('Storage denied');return [...this.stores.keys()];}
  async delete(name){return this.stores.delete(name);}
}
function createHarness(options={}){
  const scope=options.scope||(options.legacy?'https://example.test/':'https://example.test/games/'),gameScope=options.legacy?new URL('games/',scope).href:scope;
  const manifest=options.manifest||release,cacheStorage=options.cacheStorage||new MemoryCacheStorage(),listeners=new Map(),calls=[],messages=[],network=new Map();
  for(const asset of manifest.assets)network.set(new URL(asset.path,gameScope).href,fs.readFileSync(path.join(gameRoot,asset.path)));
  let offline=false,claimed=0,skipped=0,unregistered=0;
  const clients=options.clients||[{url:new URL('index.html',gameScope).href,postMessage:value=>messages.push(value)}];
  const self={registration:{scope,async unregister(){unregistered++;return true;}},location:new URL('games-sw.js',scope),clients:{async claim(){claimed++;},async matchAll(){return clients;}},skipWaiting(){skipped++;return Promise.resolve();},addEventListener(type,handler){listeners.set(type,handler);}};
  const context=vm.createContext({self,caches:cacheStorage,crypto:crypto.webcrypto,Request,Response,Headers,URL,Uint8Array,console,fetch:async request=>{
    calls.push(request.url);if(offline)throw new TypeError('Network disconnected');
    const value=network.get(request.url);if(value===undefined)return new Response('missing',{status:404});if(value instanceof Error)throw value;
    const type=request.url.endsWith('.html')?'text/html':request.url.endsWith('.css')?'text/css':'text/javascript';
    return new Response(value,{headers:{'Content-Type':type}});
  },importScripts(...files){for(const file of files){
    const url=new URL(file,self.location).href;
    if(url===new URL('offline-assets.js',gameScope).href)self.ARCADE_OFFLINE_MANIFEST=JSON.parse(JSON.stringify(manifest));
    else if(['legacy-routes.js','root-migration.js'].some(name=>url===new URL(name,gameScope).href))vm.runInContext(fs.readFileSync(path.join(gameRoot,new URL(url).pathname.split('/').at(-1)),'utf8'),context);
    else throw Error('Unexpected service worker import: '+url);
  }}});
  vm.runInContext(fs.readFileSync(path.join(options.legacy?root:gameRoot,'games-sw.js'),'utf8'),context);
  async function lifecycle(type){let promise;listeners.get(type)({waitUntil(value){promise=value;}});await promise;}
  return {
    scope,gameScope,manifest,cacheStorage,calls,messages,network,clients,
    get claimed(){return claimed;},get skipped(){return skipped;},get unregistered(){return unregistered;},
    setOffline(value=true){offline=value;},
    url(file){return new URL(file,scope).href;},
    cacheName:`little-arcade-offline:${encodeURIComponent(new URL(gameScope).pathname)}:${manifest.version}`,
    install:()=>lifecycle('install'),activate:()=>lifecycle('activate'),
    async message(type){let promise,result;const handler=listeners.get('message');if(!handler)return;handler({data:{type},ports:[{postMessage(value){result=value;}}],waitUntil(value){promise=value;}});if(promise)await promise;return result;},
    async fetch(file,options={}){
      let response,handled=false;
      const request={url:new URL(file,scope).href,method:options.method||'GET',mode:options.mode||'same-origin',headers:new Headers(options.headers)};
      listeners.get('fetch')({request,respondWith(value){handled=true;response=value;}});
      return {handled,response:handled?await response:null};
    }
  };
}
module.exports={createHarness,MemoryCacheStorage,release,root,gameRoot,sha256};
