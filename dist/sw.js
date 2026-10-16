const BASE=new URL('./',self.location.href);
const PREFIX='flowtrack:'+BASE.pathname+':';
const CACHE=PREFIX+'v4-20261016-recovery';
const SHELL=['./','index.html','styles-v4.css','theme.js','app-v4.mjs','core.mjs','vault-v4.mjs','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'].map(p=>new URL(p,BASE).href);
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==BASE.origin)return;
  const url=new URL(e.request.url);url.search='';url.hash='';
  if(e.request.mode==='navigate'&&url.pathname===BASE.pathname){e.respondWith(fetch(e.request).catch(()=>caches.match(new URL('index.html',BASE).href)));return;}
  if(SHELL.includes(url.href))e.respondWith(caches.match(url.href).then(hit=>hit||fetch(e.request)));
});
