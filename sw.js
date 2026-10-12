// عامل الخدمة: يحفظ ملفات المختبر على الجهاز ويفتحه منها فوراً، ويحدّثها في الخلفية عند وجود إنترنت
const CACHE='digester-lab-v2-202610110757';
const CORE=['./','./index.html','./manifest.webmanifest'];
const EXTRA=['./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./icons/apple-touch-icon.png'];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    await c.addAll(CORE);                                   // الملفات الأساسية: يجب أن تُحفظ
    await Promise.allSettled(EXTRA.map(u=>c.add(u)));        // الأيقونات: لا تُفشل الحفظ إن نقصت
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const ks=await caches.keys();
    await Promise.all(ks.filter(k=>k.startsWith('digester-lab-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
    const cs=await self.clients.matchAll({type:'window'});
    cs.forEach(cl=>cl.postMessage({type:'ready'}));
  })());
});

// تحديث الصفحة المحفوظة من الشبكة دون أن ينتظرها المستخدم
async function refreshPage(){
  try{
    const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(),8000);
    const r=await fetch('./index.html',{cache:'no-cache',signal:ctl.signal}); clearTimeout(t);
    if(!r.ok) return;
    const c=await caches.open(CACHE); const old=await c.match('./index.html');
    const fresh=r.clone(); const txt=await r.text();
    const oldTxt=old?await old.text():'';
    await c.put('./index.html',fresh); await c.put('./',new Response(txt,{headers:{'Content-Type':'text/html; charset=utf-8'}}));
    if(oldTxt && oldTxt!==txt){
      const cs=await self.clients.matchAll({type:'window'});
      cs.forEach(cl=>cl.postMessage({type:'updated'}));
    }
  }catch(_){}
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url); if(url.origin!==location.origin) return;
  if(req.mode==='navigate'){
    // المحفوظ أولاً: يفتح فوراً حتى دون إنترنت أو مع إنترنت ضعيف
    e.respondWith((async()=>{
      const c=await caches.open(CACHE);
      const hit=await c.match('./index.html')||await c.match('./');
      if(hit){ e.waitUntil(refreshPage()); return hit; }
      try{ return await fetch(req); }catch(_){ return new Response('<meta charset="utf-8"><p dir="rtl" style="font:16px Tahoma;padding:20px">افتح المختبر مرة واحدة وأنت متصل بالإنترنت ليُحفظ على جهازك.</p>',{headers:{'Content-Type':'text/html; charset=utf-8'}}); }
    })());
    return;
  }
  e.respondWith((async()=>{
    const hit=await caches.match(req,{ignoreSearch:true});
    if(hit) return hit;
    try{
      const r=await fetch(req);
      if(r.ok){ const c=await caches.open(CACHE); c.put(req,r.clone()); }
      return r;
    }catch(_){ return Response.error(); }
  })());
});
