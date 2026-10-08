const CACHE='b4-v40';
const FILES=['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./assets/logo.svg','./assets/logo.svg'];

self.addEventListener('install',function(event){
  event.waitUntil(
    caches.open(CACHE)
      .then(function(cache){return cache.addAll(FILES);})
      .then(function(){return self.skipWaiting();})
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener('push',function(event){
  var data={};
  try{
    if(event.data){
      data=event.data.json()||{};
    }
  }catch(error){
    data={title:'B4 Class',body:event.data?event.data.text():'New notification',url:'/'};
  }
  var title=data.title||'B4 Class';
  var options={
    body:data.body||'',
    icon:'/assets/logo.svg',
    badge:'/assets/logo.svg',
    tag:'b4-'+(data.type||'notification')+'-'+Date.now(),
    data:{url:data.url||'/'},
    renotify:true
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',function(event){
  event.notification.close();
  var target=(event.notification.data&&event.notification.data.url)||'/';
  event.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(function(list){
      var existing=list.find(function(client){return client.url.indexOf(self.location.origin)===0;});
      if(existing){
        return existing.navigate(new URL(target,self.location.origin).href).then(function(){return existing.focus();});
      }
      return clients.openWindow(new URL(target,self.location.origin).href);
    })
  );
});

self.addEventListener('fetch',function(event){
  if(event.request.method!=='GET') return;
  event.respondWith(
    fetch(event.request).then(function(response){
      if(response.ok){
        var copy=response.clone();
        caches.open(CACHE).then(function(cache){return cache.put(event.request,copy);}).catch(function(){});
      }
      return response;
    }).catch(function(){
      return caches.match(event.request).then(function(response){
        return response||caches.match('./index.html');
      });
    })
  );
});