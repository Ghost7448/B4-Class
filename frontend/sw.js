const CACHE='b4-v26';const FILES=['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./assets/logo.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('push',e=>{
  let data={};try{data=e.data?.json()||{}}catch{data={title:'B4 Class',body:e.data?.text()||'New notification',url:'/'}};
  const title=data.title||'B4 Class';
  e.waitUntil(self.registration.showNotification(title,{body:data.body||'',icon:'/assets/logo.svg',badge:'/assets/logo.svg',tag:'b4-'+(data.type||'notification')+'-'+Date.now(),data:{url:data.url||'/'},renotify:true}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const target=e.notification.data?.url||'/';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    const existing=list.find(client=>client.url.startsWith(self.location.origin));
    if(existing){existing.navigate(new URL(target,self.location.origin).href);return existing.focus();}
    return clients.openWindow(new URL(target,self.location.origin).href);
  }));
});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))})