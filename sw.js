importScripts('./precache-manifest.js');
const PREFIX='record::';
const CACHE='record::shell::0.3.0';
const KEEP=new Set([CACHE]);
const SHELL=(self.RECORD_PRECACHE||[]).map(x=>x.url);
self.addEventListener('install',e=>{e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(SHELL);})())});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&!KEEP.has(key))await caches.delete(key);await self.clients.claim();})())});
async function runtimeConfig(request){
  const c=await caches.open(CACHE);
  try{const net=await fetch(new Request(request,{cache:'no-store'}));if(net.ok)await c.put(request,net.clone());return net;}catch(error){const cached=await c.match(request);if(!cached)throw error;const body=await cached.blob(),headers=new Headers(cached.headers);headers.set('x-record-runtime-cache','stale-fallback');headers.set('cache-control','no-store');return new Response(body,{status:cached.status,statusText:cached.statusText,headers});}
}
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;const url=new URL(e.request.url),scope=new URL(self.registration.scope);if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  if(url.pathname.endsWith('/config/runtime.json')){e.respondWith(runtimeConfig(e.request));return;}
  e.respondWith((async()=>{const c=await caches.open(CACHE),cached=await c.match(e.request,{ignoreSearch:false});if(cached)return cached;try{const response=await fetch(e.request);if(response.ok&&['script','style','image','manifest','document'].includes(e.request.destination))await c.put(e.request,response.clone());return response;}catch(error){if(e.request.mode==='navigate'){const fallback=await c.match('./index.html');if(fallback)return fallback;}throw error;}})());
});
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
