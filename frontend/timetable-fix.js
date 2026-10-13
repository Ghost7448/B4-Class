/* Keep the schedule in normal page flow. No forced landscape rotation or fullscreen mode. */
(function(){
  function restore(){
    document.body.classList.remove('b4-schedule-open');
    document.querySelectorAll('.b4-schedule-wrap.mobile-landscape-view').forEach(el=>el.classList.remove('mobile-landscape-view'));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restore);
  else restore();
  new MutationObserver(restore).observe(document.body,{childList:true,subtree:true});
})();
