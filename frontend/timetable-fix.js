(function(){
  function mergeBreakColumns(){
    document.querySelectorAll('.b4-schedule tbody').forEach(function(tbody){
      var rows=Array.from(tbody.rows);
      if(!rows.length)return;
      [1,2].forEach(function(n){
        var selector='td[data-schedule-break="'+n+'"]';
        var first=rows[0].querySelector(selector);
        if(!first)return;
        first.classList.add('break-cell-merged');
        first.rowSpan=rows.length;
        for(var i=1;i<rows.length;i++){
          var cell=rows[i].querySelector(selector);
          if(cell)cell.remove();
        }
      });
    });
  }
  var queued=false;
  function scheduleMerge(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(function(){queued=false;mergeBreakColumns();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleMerge);
  else scheduleMerge();
  new MutationObserver(scheduleMerge).observe(document.body,{childList:true,subtree:true});

  function applyMobileLandscapeView(){
    var wrap=document.querySelector('.b4-schedule-wrap');
    if(!wrap)return;
    var mobile=window.matchMedia('(max-width: 700px)').matches;
    var portrait=window.matchMedia('(orientation: portrait)').matches;
    wrap.classList.toggle('mobile-landscape-view', mobile && portrait);
  }
  window.addEventListener('resize',applyMobileLandscapeView,{passive:true});
  window.addEventListener('orientationchange',applyMobileLandscapeView,{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyMobileLandscapeView);
  else applyMobileLandscapeView();
  new MutationObserver(applyMobileLandscapeView).observe(document.body,{childList:true,subtree:true});
})();
