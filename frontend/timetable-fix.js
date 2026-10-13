/* Keep the Schedule view in the normal page layout. No fullscreen rotation. */
(function(){
  function resetScheduleLayout(){
    document.body.classList.remove('b4-schedule-open');
    document.querySelectorAll('.b4-schedule-wrap.mobile-landscape-view').forEach(function(w){w.classList.remove('mobile-landscape-view')});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',resetScheduleLayout);
  else resetScheduleLayout();
  window.addEventListener('resize',resetScheduleLayout,{passive:true});
  window.addEventListener('orientationchange',resetScheduleLayout,{passive:true});
  new MutationObserver(resetScheduleLayout).observe(document.body,{childList:true,subtree:true});
})();
