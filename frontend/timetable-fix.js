(function(){
  function updateScheduleState(){
    var wrap=document.querySelector('.b4-schedule-wrap');
    var isSchedule=!!wrap;
    document.body.classList.toggle('b4-schedule-open',isSchedule);
    if(!wrap)return;
    var mobile=window.matchMedia('(max-width: 700px)').matches;
    var portrait=window.matchMedia('(orientation: portrait)').matches;
    wrap.classList.toggle('mobile-landscape-view',mobile&&portrait);
    var menu=document.getElementById('mobile');
    if(menu){
      menu.setAttribute('aria-label','Open navigation menu');
      menu.setAttribute('title','Menu');
    }
  }
  var queued=false;
  function scheduleUpdate(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(function(){
      queued=false;
      updateScheduleState();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleUpdate);
  else scheduleUpdate();
  window.addEventListener('resize',scheduleUpdate,{passive:true});
  window.addEventListener('orientationchange',scheduleUpdate,{passive:true});
  new MutationObserver(scheduleUpdate).observe(document.body,{childList:true,subtree:true});
})();
