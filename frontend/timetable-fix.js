(function(){
  function mergeBreakColumns(){
    document.querySelectorAll('.b4-schedule tbody').forEach(function(tbody){
      var rows=Array.from(tbody.rows);
      if(!rows.length)return;
      [1,2].forEach(function(n){
        var selector='td[data-schedule-break="'+n+'"]';
        var first=rows.find(function(row){return row.querySelector(selector);})?.querySelector(selector);
        if(!first)return;
        if(first.dataset.breakMerged==='1')return;
        first.classList.add('break-cell-merged');
        first.rowSpan=rows.length;
        first.dataset.breakMerged='1';
        for(var i=0;i<rows.length;i++){
          var cell=rows[i].querySelector(selector);
          if(cell&&cell!==first)cell.remove();
        }
        // Keep a single label in each merged break cell.
        var label=n===1?'Break 1':'Break 2';
        first.textContent=label;
        first.setAttribute('aria-label',label);
      });
    });
  }
  function updateScheduleState(){
    var wrap=document.querySelector('.b4-schedule-wrap');
    document.body.classList.toggle('b4-schedule-open',!!wrap);
    if(!wrap)return;
    var mobile=window.matchMedia('(max-width: 700px)').matches;
    var portrait=window.matchMedia('(orientation: portrait)').matches;
    wrap.classList.toggle('mobile-landscape-view',mobile&&portrait);
    var menu=document.getElementById('mobile');
    if(menu&&mobile&&portrait){
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
      mergeBreakColumns();
      updateScheduleState();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleUpdate);
  else scheduleUpdate();
  window.addEventListener('resize',scheduleUpdate,{passive:true});
  window.addEventListener('orientationchange',scheduleUpdate,{passive:true});
  new MutationObserver(scheduleUpdate).observe(document.body,{childList:true,subtree:true});
})();