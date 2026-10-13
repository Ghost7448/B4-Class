/* Keep the timetable as an in-page horizontal landscape card, never fullscreen. */
(function(){
  function update(){
    var wrap=document.querySelector('.b4-schedule-wrap');
    document.body.classList.toggle('b4-schedule-open',!!wrap);
    if(wrap)wrap.classList.toggle('mobile-landscape-view',window.matchMedia('(max-width:700px)').matches);
  }
  var queued=false;
  function queue(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;update()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue);else queue();
  window.addEventListener('resize',queue,{passive:true});
  window.addEventListener('orientationchange',queue,{passive:true});
  new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});
})();
