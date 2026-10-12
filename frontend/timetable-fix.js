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
})();