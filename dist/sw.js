const BASE=new URL('./',self.location.href);
const PREFIX='flowtrack:'+BASE.pathname+':';
const CACHE=PREFIX+'v15-20261017-reliable-start';
const INDEX=new URL('index.html',BASE).href;
const OPEN=new URL('open.html',BASE).href;
const SHELL=['index.html','styles-v11.css','app-v14.mjs','device-v1.mjs','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'].map(p=>new URL(p,BASE).href);
// Install one complete version before replacing the working offline app.
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(async error=>{await caches.delete(CACHE);throw error;}));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==BASE.origin)return;
  const url=new URL(e.request.url);url.search='';url.hash='';
  const navigation=e.request.mode==='navigate'&&(url.pathname===BASE.pathname||url.href===INDEX||url.href===OPEN);
  if(!navigation&&!SHELL.includes(url.href))return;
  // Open this worker's saved HTML and assets immediately, even if a connection
  // stalls. Service-worker updates download a complete replacement in the
  // background, then the existing Update button activates that version.
  e.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(navigation?INDEX:url.href))||fetch(e.request)));
});


