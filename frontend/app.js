const $=s=>document.querySelector(s),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const API=(window.B4_API_URL||'').replace(/\/$/,'');
const S={lang:localStorage.b4Lang||'en',theme:localStorage.b4Theme||'light',view:'dashboard',me:null,linked:[],students:[],teachers:[],subjects:[],schedule:[],assignments:[],resources:[],exams:[],announcements:[],messages:[],attendance:[],developers:[],badges:[],accounts:[],permissions:[],users:[],teacherMessages:[],notifications:[],notificationSettings:{chat_messages:1,class_chat_messages:1,class_chat_reply:1,teacher_chat_messages:1,teacher_chat_reply:1,exam_notifications:1,exam_results:1,announcement_notifications:1,assignment_notifications:1,resource_notifications:1,attendance_notifications:1,system_notifications:1,push_enabled:0},examReview:null,examRun:null,examResult:null,examAnswers:null,serverNowMs:0,serverClockOffsetMs:0,serverTimeZone:'Africa/Cairo',error:''};
const L={en:{dashboard:'Dashboard',students:'Students',teachers:'Teachers',subjects:'Subjects',schedule:'Schedule',assignments:'Assignments',resources:'Resources',exams:'Exam Center',announcements:'Announcements',chat:'Class Chat',teacherChat:'Teacher Chat',attendance:'Attendance',admin:'Admin Center',teacherCenter:'Teacher Center',settings:'Settings',developers:'Developers',login:'Login',logout:'Log out',activate:'Activation Key',ai:'B4 AI',search:'Search everything...',guest:'Guest',save:'Save',add:'Add',edit:'Edit',delete:'Delete',open:'Open resource',light:'Light mode',dark:'Dark mode',english:'English',arabic:'Arabic',administrator:'Administrator — all permissions',superAdmin:'Super Admin',classRole:'Class role',systemAccess:'System access'},ar:{dashboard:'الرئيسية',students:'الطلاب',teachers:'المدرسين',subjects:'المواد',schedule:'الجدول',assignments:'الواجبات',resources:'المصادر',exams:'الامتحانات',announcements:'الإعلانات',chat:'شات الفصل',teacherChat:'شات المدرسين',attendance:'الحضور',admin:'مركز الإدارة',teacherCenter:'مركز المدرس',settings:'الإعدادات',developers:'المطورون',login:'تسجيل الدخول',logout:'تسجيل الخروج',activate:'مفتاح التفعيل',ai:'مساعد B4',search:'ابحث...',guest:'زائر',save:'حفظ',add:'إضافة',edit:'تعديل',delete:'حذف',open:'فتح المصدر',light:'الوضع النهاري',dark:'الوضع الليلي',english:'الإنجليزية',arabic:'العربية',administrator:'Administrator — كل الصلاحيات',superAdmin:'Super Admin',classRole:'دور الحساب',systemAccess:'صلاحية النظام'}};
const t=k=>L[S.lang][k]||k;
const PERMS=[['MANAGE_CHAT','Manage Chat / Moderate messages'],['MANAGE_ACCOUNTS','Manage Accounts'],['MANAGE_PERMISSIONS','Manage Permissions'],['VIEW_LOGS','View Logs'],['VIEW_ADMIN_CENTER','View Admin Center'],['MANAGE_STUDENTS','Manage Students'],['MANAGE_TEACHERS','Manage Teachers'],['MANAGE_ROLES','Manage Roles'],['MANAGE_ADMINS','Manage Admins'],['MANAGE_KEYS','Manage Activation Keys'],['MANAGE_BADGES','Manage Badges'],['MANAGE_SUBJECTS','Manage Subjects'],['MANAGE_SCHEDULE','Manage Schedule'],['MANAGE_ASSIGNMENTS','Manage Assignments'],['MANAGE_RESOURCES','Manage Resources / PDFs'],['MANAGE_EXAMS','Manage Exams'],['MANAGE_ANNOUNCEMENTS','Manage Announcements'],['MANAGE_ATTENDANCE','Manage Attendance'],['MANAGE_TEACHER_CHAT','Teacher Chat'],['MANAGE_ANALYTICS','Attendance Analytics'],['MANAGE_SITE','Manage Site'],['USE_AI','Use AI'],['MANAGE_DEVELOPERS','Manage Developers'],['VIEW_CLASS','View Class'],['ADMINISTRATOR','Administrator — ALL permissions']];
const api=async(path,opt={})=>{const r=await fetch(API+path,{credentials:'include',...opt,headers:{'Content-Type':'application/json',...(opt.headers||{})}});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'Request failed');return d};
const toast=m=>{const e=document.createElement('div');e.className='toast';e.textContent=m;document.body.append(e);setTimeout(()=>e.remove(),2500)};
let deferredInstallPrompt=null;
let b4InstallState='unknown';
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferredInstallPrompt=e;
  b4InstallState='available';
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  b4InstallState='installed';
  localStorage.setItem('b4Installed','1');
  toast('B4 installed ✓');
});
function isB4Standalone(){
  return !!(
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.matchMedia?.('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone===true ||
    String(document.referrer||'').startsWith('android-app://')
  );
}
async function detectB4Installed(){
  if(isB4Standalone())return true;
  if(localStorage.getItem('b4Installed')==='1')return true;
  try{
    if(typeof navigator.getInstalledRelatedApps==='function'){
      const apps=await navigator.getInstalledRelatedApps();
      if(Array.isArray(apps)&&apps.some(x=>x?.platform==='webapp')){
        localStorage.setItem('b4Installed','1');
        return true;
      }
    }
  }catch{}
  return false;
}
function openInstallModal(state='ready'){
  const ar=S.lang==='ar';
  const installed=state==='installed';
  const unavailable=state==='unavailable';
  const title=installed?(ar?'B4 مثبت بالفعل':'B4 is already installed'):(ar?'تثبيت B4':'Install B4');
  const text=installed
    ?(ar?'التطبيق موجود بالفعل على جهازك ويمكنك فتحه من قائمة التطبيقات.':'B4 is already installed on this device and is ready to use.')
    :(unavailable
      ?(ar?'المتصفح لم يوفّر نافذة التثبيت الآن. جرّب فتح الموقع من Chrome وتأكد أن الموقع مؤهل للتثبيت.':'This browser has not made the install prompt available yet. Try opening B4 in Chrome and refresh the page.')
      :(ar?'ثبّت B4 كتطبيق مستقل للوصول السريع وتجربة أفضل.':'Install B4 as an app for faster access and a cleaner experience.'));
  const action=installed?(ar?'تم':'Done'):(unavailable?(ar?'حسنًا':'Got it'):(ar?'تثبيت الآن':'Install now'));
  modal(
    '<div class="install-modal">'+
      '<div class="install-modal-icon"><img src="/assets/logo.svg" alt="B4"></div>'+
      '<div class="install-modal-copy">'+
        '<div class="install-modal-kicker">B4 • TELECOMMUNICATION</div>'+
        '<h2>'+esc(title)+'</h2>'+
        '<p>'+esc(text)+'</p>'+
      '</div>'+
      (!installed&&!unavailable?'<div class="install-modal-points"><span>✓ '+(ar?'يعمل كتطبيق مستقل':'Runs like an app')+'</span><span>✓ '+(ar?'وصول أسرع':'Faster access')+'</span><span>✓ '+(ar?'واجهة أنظف':'Cleaner experience')+'</span></div>':'')+
      '<div class="install-modal-actions">'+
        '<button type="button" class="btn ghost install-modal-cancel">'+(installed||unavailable?(ar?'إغلاق':'Close'):(ar?'لاحقًا':'Later'))+'</button>'+
        '<button type="button" class="btn primary install-modal-confirm">'+esc(action)+'</button>'+
      '</div>'+
    '</div>'
  );
  $('#modal .install-modal-cancel')?.addEventListener('click',close);
  $('#modal .install-modal-confirm')?.addEventListener('click',async()=>{
    if(installed||unavailable)return close();
    close();
    await triggerB4Install();
  });
}
async function triggerB4Install(){
  if(!deferredInstallPrompt)return openInstallModal('unavailable');
  const prompt=deferredInstallPrompt;
  deferredInstallPrompt=null;
  try{
    await prompt.prompt();
    const result=await prompt.userChoice;
    if(result?.outcome==='accepted'){
      b4InstallState='installed';
      localStorage.setItem('b4Installed','1');
      toast('Installing B4…');
    }else{
      b4InstallState='available';
      deferredInstallPrompt=prompt;
    }
  }catch(e){
    b4InstallState='available';
    deferredInstallPrompt=prompt;
    toast('Could not open the install prompt');
  }
}
async function installB4(){
  if(await detectB4Installed()){
    b4InstallState='installed';
    return openInstallModal('installed');
  }
  if(!deferredInstallPrompt){
    b4InstallState='installed';
    return openInstallModal('installed');
  }
  openInstallModal('ready');
}
let activeConfirmCancel=null;
const close=()=>{
  if(activeConfirmCancel){
    const cancel=activeConfirmCancel;
    activeConfirmCancel=null;
    cancel();
    return
  }
  $('#back')?.classList.remove('show')
};
window.b4Close=close;
document.addEventListener('click',e=>{const back=$('#back');if(back?.classList.contains('show')&&e.target===back)close()});
const modal=h=>{$('#modal').innerHTML='<div class="modal">'+h+'</div>';$('#back').classList.add('show')};
function confirmAction(message,options={}){
  const title=options.title||'Confirm action';
  const confirmText=options.confirmText||'Confirm';
  const cancelText=options.cancelText||'Cancel';
  const danger=options.danger!==false;
  return new Promise(resolve=>{
    let settled=false;
    const finish=value=>{
      if(settled)return;
      settled=true;
      activeConfirmCancel=null;
      $('#back')?.classList.remove('show');
      resolve(value)
    };
    activeConfirmCancel=()=>finish(false);
    modal(
      '<div class="confirm-modal">'+
        '<div class="confirm-icon '+(danger?'danger':'')+'">'+(danger?'!':'✓')+'</div>'+
        '<div class="confirm-content">'+
          '<div class="confirm-kicker">B4 CLASS</div>'+
          '<h2>'+esc(title)+'</h2>'+
          '<p>'+esc(message)+'</p>'+
        '</div>'+
        '<div class="confirm-actions">'+
          '<button type="button" class="btn ghost confirm-cancel">'+esc(cancelText)+'</button>'+
          '<button type="button" class="btn '+(danger?'danger':'primary')+' confirm-ok">'+esc(confirmText)+'</button>'+
        '</div>'+
      '</div>'
    );
    $('#modal .confirm-cancel')?.addEventListener('click',()=>finish(false));
    $('#modal .confirm-ok')?.addEventListener('click',()=>finish(true));
  })
}
const can=p=>{if(!S.me)return false;if(Number(S.me.is_super_admin)===1)return true;return (S.me.permissions||[]).includes(p)};
const nav=[['dashboard','⌂'],['students','♙'],['teachers','♟'],['subjects','▣'],['schedule','◫'],['assignments','✓'],['resources','▤'],['exams','⌁'],['announcements','◈'],['chat','◌'],['attendance','◉']];
function go(v){
  if(!S.me&&!['students','teachers','subjects','schedule','developers'].includes(v)){loginModal();return}
  if(S.view==='exam-run'&&v!=='exam-run'&&!window.examExitAllowed)lockActiveExam('LEFT_EXAM');
  S.view=v;
  render();
  window.scrollTo({top:0,behavior:'smooth'});
  $('#side')?.classList.remove('open');
}
function buildNav(){if(!S.me)return nav.filter(x=>['students','teachers','subjects','schedule'].includes(x[0])).concat([['developers','⌘']]).map(x=>'<button data-v="'+x[0]+'" class="'+(S.view===x[0]?'active':'')+'">'+x[1]+' <span>'+t(x[0])+'</span></button>').join('');
let a=nav.map(x=>'<button data-v="'+x[0]+'" class="'+(S.view===x[0]?'active':'')+'">'+x[1]+' <span>'+t(x[0])+'</span></button>').join('');
if(S.me.role==='TEACHER'||can('MANAGE_ASSIGNMENTS'))a+='<button data-v="teacherCenter" class="'+(S.view==='teacherCenter'?'active':'')+'">◈ <span>'+t('teacherCenter')+'</span></button>';
if(can('MANAGE_TEACHER_CHAT')||S.me.role==='TEACHER'||Number(S.me.is_super_admin)===1)a+='<button data-v="teacherChat" class="'+(S.view==='teacherChat'?'active':'')+'">☷ <span>'+t('teacherChat')+'</span></button>';
if(can('VIEW_ADMIN_CENTER'))a+='<button data-v="admin" class="'+(S.view==='admin'?'active':'')+'">⚙ <span>'+t('admin')+'</span></button>';
a+='<button data-v="settings" class="'+(S.view==='settings'?'active':'')+'">⚙ <span>'+t('settings')+'</span></button>';a+='<button data-v="developers" class="'+(S.view==='developers'?'active':'')+'">⌘ <span>'+t('developers')+'</span></button>';return a}
function title(h,p,b=''){return '<div class="title"><div><div class="eyebrow">B4 • TELECOMMUNICATION</div><h1>'+h+'</h1><p>'+p+'</p></div><div class="actions">'+b+'</div></div>'}
function dashboard(){return title('Welcome to B4 👋',S.me?'<button class="btn primary" onclick="aiModal()">✦ '+t('ai')+'</button>':'<button class="btn primary" onclick="loginModal()">'+t('login')+'</button>')+
'<div class="hero"><div><span class="eyebrow">WE SCHOOL • B4</span><h1>B4 Telecommunication</h1><p></p><button class="btn" onclick="aiModal()">✦ Ask B4 AI</button></div></div>'+
'<div class="grid stats"><div class="card stat"><small>Students</small><b data-stat-count="'+S.students.length+'">0</b></div><div class="card stat"><small>Teachers</small><b data-stat-count="'+S.teachers.length+'">0</b></div><div class="card stat"><small>Subjects</small><b data-stat-count="'+S.subjects.length+'">0</b></div><div class="card stat"><small>Assignments</small><b data-stat-count="'+S.assignments.length+'">0</b></div></div>'+
'<div class="grid c2"><div class="card dashboard-announcements"><div class="head"><h3>'+t('announcements')+'</h3>'+ (S.me?'<button class="btn ghost" onclick="go(\'announcements\')">View</button>':'')+'</div>'+(!S.me?'<p class="muted">Log in as a B4 student or teacher to see class announcements.</p>':S.announcements.slice(0,5).map(a=>'<div class="item"><div class="grow"><b>'+esc(a.title)+'</b><p class="muted">'+esc(a.body||'')+'</p></div></div>').join('')||'<div class="empty">No announcements.</div>')+'</div>'+
'<div class="card"><div class="head"><h3>✦ '+t('ai')+'</h3><span class="badge">ONLINE</span></div><p class="muted"></p><button class="btn primary" onclick="aiModal()">Open AI</button></div></div>'}
function badgeHTML(badges,compact=false){
  const list=Array.isArray(badges)?badges:[];
  if(!list.length)return '';
  return '<span class="profile-badges" aria-label="Badges">'+list.map(b=>{
    const icon=b.icon_url?'<img src="'+esc(b.icon_url)+'" alt="">':'<span class="badge-fallback">✦</span>';
    return '<span class="profile-badge'+(compact?' compact':'')+'" title="'+esc(b.description||b.name||'Badge')+'">'+icon+'<span>'+esc(b.name||'Badge')+'</span></span>';
  }).join('')+'</span>';
}
function peopleCard(x,type){const code=type==='student'?(x.student_code||''):(x.teacher_code||'');return '<article class="card people-card"><div class="item person-item" style="padding:0;border:0"><img class="avatar" data-user-avatar="'+esc(x.user_id||'')+'" src="'+esc(x.avatar_url||'/assets/logo.svg')+'"><div class="grow"><div class="person-name-line"><b>'+esc(x.display_name||x.official_name||'')+'</b>'+badgeHTML(x.badges)+'</div><small class="muted identity-line">'+(code?'<span class="identity-code">'+esc(code)+'</span>':'<span class="identity-code empty-code">—</span>')+'</small></div><span class="badge">'+type+'</span></div>'+(can(type==='student'?'MANAGE_STUDENTS':'MANAGE_TEACHERS')?'<div class="actions-row"><button class="btn ghost" onclick="'+(type==='student'?'studentEdit('+x.id+')':'teacherEdit('+x.id+')')+'">Edit</button><button class="btn danger" onclick="'+(type==='student'?'studentDelete('+x.id+')':'teacherDelete('+x.id+')')+'">Delete</button></div>':'')+'</article>'}
function studentsV(){return title(t('students'),'B4 student',can('MANAGE_STUDENTS')?'<button class="btn primary" onclick="studentEdit()">＋ '+t('add')+'</button>':'')+'<div class="grid c3">'+S.students.map(x=>peopleCard(x,'student')).join('')+'</div>'}
function teachersV(){return title(t('teachers'),'B4 teacher',can('MANAGE_TEACHERS')?'<button class="btn primary" onclick="teacherEdit()">＋ '+t('add')+'</button>':'')+'<div class="grid c3">'+S.teachers.map(x=>peopleCard(x,'teacher')).join('')+'</div>'}
function subjectsV(){return title(t('subjects'),'Subjects and resources.',can('MANAGE_SUBJECTS')?'<button class="btn primary" onclick="subjectEdit()">＋ '+t('add')+'</button>':'')+'<div class="grid c3">'+S.subjects.map(s=>'<article class="card"><div class="head"><h3>'+esc(s.name)+'</h3></div><p class="muted">'+esc(s.teacher_name||'')+'</p><button class="btn primary" onclick="openSubject('+s.id+')">'+t('open')+' →</button>'+(can('MANAGE_SUBJECTS')?'<div class="actions-row"><button class="btn ghost" onclick="subjectEdit('+s.id+')">Edit</button><button class="btn danger" onclick="subjectDelete('+s.id+')">Delete</button></div>':'')+'</article>').join('')||'<div class="card empty">No subjects.</div>'+'</div>'}
function openSubject(id){const s=S.subjects.find(x=>Number(x.id)===Number(id));if(!s)return;S.subjectId=Number(id);S.view='subject';render();window.scrollTo({top:0,behavior:'smooth'})}
function subjectV(){const s=S.subjects.find(x=>Number(x.id)===Number(S.subjectId));if(!s){S.view='subjects';return subjectsV()}const resources=S.resources.filter(r=>Number(r.subject_id)===Number(s.id));const assignments=S.assignments.filter(a=>Number(a.subject_id)===Number(s.id));const exams=S.exams.filter(e=>Number(e.subject_id)===Number(s.id));const ar=S.lang==='ar';const labels={materials:ar?'موارد المادة':'Subject materials',resources:ar?'المصادر':'Resources',assignments:ar?'الواجبات':'Assignments',exams:ar?'الامتحانات':'Exams',noResources:ar?'لا توجد مصادر مرتبطة بهذه المادة حتى الآن':'No resources for this subject yet.',noAssignments:ar?'لا توجد واجبات مرتبطة بهذه المادة حتى الآن':'No assignments for this subject yet.',noExams:ar?'لا توجد امتحانات مرتبطة بهذه المادة حتى الآن':'No exams for this subject yet.',noFile:ar?'لا يوجد ملف':'No file',back:ar?'← المواد':'← Subjects',open:ar?'فتح →':'Open →'};return title(esc(s.name),esc(s.teacher_name||labels.materials),'<button class="btn ghost" onclick="go(\'subjects\')">'+labels.back+'</button>')+'<div class="grid c2"><div class="card"><div class="head"><h3>'+labels.resources+'</h3><span class="badge">'+resources.length+'</span></div>'+(resources.length?resources.map(r=>'<div class="item"><div class="grow"><b>'+esc(r.title)+'</b><p class="muted">'+esc(r.description||'')+'</p></div>'+(r.url||r.file_url?'<a class="btn primary" href="'+esc(r.url||r.file_url)+'" target="_blank" rel="noopener">'+labels.open+'</a>':'<span class="muted">'+labels.noFile+'</span>')+'</div>').join(''): '<div class="empty">'+labels.noResources+'</div>')+'</div><div class="card"><div class="head"><h3>'+labels.assignments+'</h3><span class="badge">'+assignments.length+'</span></div>'+(assignments.length?assignments.map(a=>'<div class="item"><div class="grow"><b>'+esc(a.title)+'</b><p class="muted">'+esc(a.description||'')+'</p></div><button class="btn ghost" onclick="openAssignment('+a.id+')">'+labels.open+'</button></div>').join(''):'<div class="empty">'+labels.noAssignments+'</div>')+'</div></div>'+(exams.length?'<div class="card subject-section"><div class="head"><h3>'+labels.exams+'</h3><span class="badge">'+exams.length+'</span></div>'+exams.map(e=>'<div class="item"><div class="grow"><b>'+esc(e.title)+'</b><p class="muted">'+esc(e.description||'')+'</p></div><button class="btn ghost" onclick="startExam('+e.id+')">'+labels.open+'</button></div>').join('')+'</div>':'')}
function scheduleV(){return title(t('schedule'),'B4 schedule.',can('MANAGE_SCHEDULE')?'<button class="btn primary" onclick="scheduleEdit()">Edit schedule</button>':'')+'<div class="card tablewrap"><table class="table"><thead><tr><th>DAY</th><th>P1</th><th>P2</th><th>P3</th><th>P4</th></tr></thead><tbody>'+S.schedule.map(r=>'<tr><td><b>'+esc(r.day_name)+'</b></td><td>'+esc(r.p1||'—')+'</td><td>'+esc(r.p2||'—')+'</td><td>'+esc(r.p3||'—')+'</td><td>'+esc(r.p4||'—')+'</td></tr>').join('')+'</tbody></table></div>'}
function assignmentTime(a){const due=Number(a?.assignment_due_ms),start=Number(a?.assignment_start_ms);if(!Number.isFinite(due)||due<=0)return {label:'No deadline',tone:'green',pct:100};const now=siteNowMs(),left=due-now;if(left<=0)return {label:'Deadline passed',tone:'red',pct:0};if(!Number.isFinite(start)||start>=due)return {label:'Time left '+Math.ceil(left/1000)+'s',tone:'green',pct:100};const total=due-start;const pct=Math.min(100,Math.max(0,(left/total)*100));const minutes=left/60000;const tone=minutes<=10?'red':minutes<=30?'yellow':'green';const d=Math.floor(left/86400000),h=Math.floor(left%86400000/3600000),m=Math.floor(left%3600000/60000),ss=Math.floor(left%60000/1000);return {label:d>0?d+'d '+h+'h '+m+'m':h>0?h+'h '+m+'m '+String(ss).padStart(2,'0')+'s':m>0?m+'m '+String(ss).padStart(2,'0')+'s':String(ss)+'s',tone,pct}}
function examTime(e){
  const end=Number(e?.end_ms),start=Number(e?.exam_start_ms);
  const now=siteNowMs();
  const fmt=ms=>{const total=Math.max(0,Math.floor(ms/1000)),d=Math.floor(total/86400),h=Math.floor(total%86400/3600),m=Math.floor(total%3600/60),s=total%60;return d>0?d+'d '+h+'h '+m+'m':h>0?h+'h '+m+'m '+String(s).padStart(2,'0')+'s':m>0?m+'m '+String(s).padStart(2,'0')+'s':s+'s'};
  if(Number.isFinite(end)){const left=end-now;if(left<=0)return {label:'Exam closed',tone:'red',pct:0};if(!Number.isFinite(start)||start>=end)return {label:'Time left '+fmt(left),tone:'green',pct:100};const total=end-start;const pct=Math.min(100,Math.max(0,(left/total)*100));const tone=left<=10*60000?'red':left<=30*60000?'yellow':'green';return {label:'Time left '+fmt(left),tone,pct}}
  return {label:'No deadline',tone:'green',pct:100};
}
function updateExamCountdowns(){document.querySelectorAll('[data-exam-id]').forEach(el=>{const e=S.exams.find(x=>Number(x.id)===Number(el.dataset.examId));if(!e)return;const tm=examTime(e);el.textContent=tm.label;el.className='countdown '+tm.tone;const bar=document.querySelector('[data-exam-bar="'+e.id+'"]');if(bar){bar.className=tm.tone;bar.style.width=tm.pct+'%'}const open=el.closest('.card')?.querySelector('[data-exam-open]');if(open){const closed=tm.label==='Exam closed';open.disabled=closed;open.classList.toggle('disabled',closed);open.title=tm.label}}
)}
function assignmentCard(a){const tm=assignmentTime(a);const studentExpired=!!(S.me&&S.me.role==='STUDENT'&&tm.label==='Deadline passed');return '<article class="card assignment-card" data-live-id="'+esc(a.id)+'"><div class="head"><div><span class="badge">'+esc(a.status||'OPEN')+'</span><h3>'+esc(a.title)+'</h3></div><span class="assignment-subject">'+esc(a.subject_name||'')+'</span></div><p>'+esc(a.description||'')+'</p><div class="assignment-countdown"><span>Time left</span><b class="countdown '+tm.tone+'" data-assignment-id="'+a.id+'">'+tm.label+'</b></div><div class="assignment-bar"><span class="'+tm.tone+'" data-assignment-bar="'+a.id+'" style="width:'+tm.pct+'%"></span></div><div class="assignment-file">'+(a.attachment_id?'<span>📎 '+esc(a.attachment_name||'Assignment file')+'</span>':'<span class="muted">No file attached</span>')+'<button type="button" data-assignment-open="'+a.id+'" class="btn primary'+(studentExpired?' disabled':'')+'" '+(studentExpired?'disabled ':'')+'onclick="openAssignment('+a.id+')">'+(studentExpired?'Deadline passed':'Open Assignment →')+'</button></div>'+(can('MANAGE_ASSIGNMENTS')?'<div class="actions-row"><button class="btn ghost" onclick="assignmentEdit('+a.id+')">Edit</button><button class="btn ghost" onclick="assignmentSubmissions('+a.id+')">Submissions</button><button class="btn danger" onclick="delAPI(\'/api/admin/assignments/'+a.id+'\',\'Assignment deleted\')">Delete</button></div>':'')+'</article>'}
function tasksV(){return title(t('assignments'),' ',can('MANAGE_ASSIGNMENTS')?'<button class="btn primary" onclick="assignmentEdit()">＋ '+t('add')+'</button>':'')+'<div class="grid c2">'+S.assignments.map(assignmentCard).join('')+'</div>'}
function updateAssignmentCountdowns(){if(S.view!=='assignments')return;document.querySelectorAll('[data-assignment-id]').forEach(el=>{const a=S.assignments.find(x=>Number(x.id)===Number(el.dataset.assignmentId));if(!a)return;const tm=assignmentTime(a);el.textContent=tm.label;el.className='countdown '+tm.tone;const bar=document.querySelector('[data-assignment-bar="'+a.id+'"]');if(bar){bar.className=tm.tone;bar.style.width=tm.pct+'%'}const open=document.querySelector('[data-assignment-open="'+a.id+'"]');if(open&&S.me?.role==='STUDENT'){const expired=tm.label==='Deadline passed';open.disabled=expired;open.classList.toggle('disabled',expired);open.textContent=expired?'Deadline passed':'Open Assignment →'}})}
function siteNowMs(){const o=Number(S.serverClockOffsetMs);return Date.now()+(Number.isFinite(o)?o:0)}
function updateLiveClock(){
  const now=new Date(siteNowMs());
  const el=$('#miniTime');
  if(el){el.textContent=now.toLocaleTimeString('en-EG',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});el.title='Egypt time • Africa/Cairo'}
  updateAssignmentCountdowns();
  updateExamCountdowns();
}
async function syncSiteClock(){
  try{
    const before=Date.now();
    const d=await api('/api/time');
    const after=Date.now();
    const server=Number(d.epoch_ms);
    if(!Number.isFinite(server))return;
    S.serverClockOffsetMs=server-((before+after)/2);
    S.serverNowMs=server;
    S.serverTimeZone=d.time_zone||'Africa/Cairo';
    updateLiveClock();
  }catch{}
}
function startAssignmentCountdown(){
  if(window.assignmentCountdownTimer)return;
  updateLiveClock();
  syncSiteClock();
  window.assignmentCountdownTimer=setInterval(updateLiveClock,1000);
  clearInterval(window.siteClockSyncTimer);
  window.siteClockSyncTimer=setInterval(syncSiteClock,60000);
}
function liveDataSignature(){
  return JSON.stringify({
    students:S.students.map(x=>[x.id,x.display_name,x.avatar_url]),
    teachers:S.teachers.map(x=>[x.id,x.display_name,x.avatar_url]),
    subjects:S.subjects.map(x=>[x.id,x.name,x.progress,x.teacher_name]),
    schedule:S.schedule,
    assignments:S.assignments.map(x=>[x.id,x.title,x.status,x.description,x.due_at,x.attachment_id,x.submission_id,x.submission_file_id,x.submission_name,x.score]),
    resources:S.resources.map(x=>[x.id,x.title,x.description,x.url,x.file_url,x.filename]),
    exams:S.exams.map(x=>[x.id,x.title,x.status,x.starts_at,x.ends_at,x.duration_minutes]),
    announcements:S.announcements.map(x=>[x.id,x.title,x.body,x.category]),
    notifications:S.notifications.map(x=>[x.id,x.title,x.body,x.read_at]),
    developers:S.developers.map(x=>[x.id,x.name,x.title,x.title2,x.avatar_url])
  })
}
let examExitGuardInstalled=false;
window.examExitAllowed=false;
function lockActiveExam(reason='LEFT_EXAM'){
  const id=Number(S.examRun?.id||0);
  if(!id||window.examExitAllowed||S.view!=='exam-run')return;
  window.examExitAllowed=true;
  if(S.examRun)S.examRun.locked=true;
  const local=S.exams.find(x=>Number(x.id)===id);
  if(local)local.attempt_status='LOCKED';
  try{
    const blob=new Blob([JSON.stringify({reason})],{type:'application/json'});
    if(navigator.sendBeacon)navigator.sendBeacon('/api/exams/'+id+'/lock',blob);
    else fetch('/api/exams/'+id+'/lock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason}),credentials:'include',keepalive:true});
  }catch{}
}
function installExamExitGuard(){
  if(examExitGuardInstalled)return;
  examExitGuardInstalled=true;
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'&&S.view==='exam-run'&&!window.examExitAllowed){
      lockActiveExam('LEFT_EXAM');
      return;
    }
    if(document.visibilityState==='visible'&&S.view==='exam-run'&&S.examRun?.locked){
      S.view='exam-locked';
      render();
      window.scrollTo({top:0,behavior:'smooth'});
    }
  });
  window.addEventListener('pagehide',()=>{
    if(S.view==='exam-run'&&!window.examExitAllowed)lockActiveExam('LEFT_EXAM');
  });
}
installExamExitGuard();

let liveSyncBusy=false;
async function syncLiveData(){
  if(liveSyncBusy||!S.me)return;
  liveSyncBusy=true;
  try{
    const before=liveDataSignature();
    const beforeMe=JSON.stringify({
      id:S.me?.id,
      role:S.me?.role,
      is_super_admin:Number(S.me?.is_super_admin||0),
      status:S.me?.status,
      permissions:[...(S.me?.permissions||[])].slice().sort()
    });
    let meChanged=false;
    try{
      const meRes=await api('/api/auth/me',{cache:'no-store'});
      const nextMe=meRes.user;
      const afterMe=JSON.stringify({
        id:nextMe?.id,
        role:nextMe?.role,
        is_super_admin:Number(nextMe?.is_super_admin||0),
        status:nextMe?.status,
        permissions:[...(nextMe?.permissions||[])].slice().sort()
      });
      meChanged=beforeMe!==afterMe;
      S.me=nextMe;
    }catch(e){
      if(/Session expired|Not logged in|Login required/i.test(String(e?.message||''))){
        S.me=null;
        try{window.globalRealtimeStream?.close()}catch{}
        window.globalRealtimeStream=null;
        render();
        return;
      }
    }
    await loadData();
    const changed=before!==liveDataSignature();
    if(!changed&&!meChanged)return;
    if($('#back')?.classList.contains('show'))return;
    if(S.view==='chat'||S.view==='teacherChat')return;
    if(S.view==='exam-run'||S.view==='exam-result'||S.view==='exam-answers'||S.view==='exam-review')return;
    if(!changed)return;
    if($('#back')?.classList.contains('show'))return;
    if(S.view==='chat'||S.view==='teacherChat')return;
    if(S.view==='exam-run'||S.view==='exam-result'||S.view==='exam-answers'||S.view==='exam-review')return;
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName||''))return;
    if(S.view==='assignments'){
      patchLiveCards('#content > .grid.c2',S.assignments,assignmentCard);
      updateAssignmentCountdowns();
      return;
    }
    if(S.view==='exams'){
      patchLiveCards('#content > .grid.c2',S.exams,e=>{
        const tm=examTime(e);
        return '<article class="card" data-live-id="'+esc(e.id)+'"><div class="head"><span class="badge">'+esc(e.status)+'</span><span class="muted">'+esc(e.subject_name||'')+'</span></div><h3>'+esc(e.title)+'</h3><p class="muted">'+esc(e.description||'')+'</p><div class="meter"><span>Exam time</span><b class="countdown '+tm.tone+'" data-exam-id="'+e.id+'">'+tm.label+'</b></div><div class="assignment-bar exam-time-bar"><span class="'+tm.tone+'" data-exam-bar="'+e.id+'" style="width:'+tm.pct+'%"></span></div><div class="actions-row"><button class="btn primary" data-exam-open '+(tm.label==='Exam closed'?'disabled':'')+' onclick="startExam('+e.id+')">Open</button>'+(can('MANAGE_EXAMS')?'<button class="btn ghost" onclick="examEdit('+e.id+')">Edit</button><button class="btn danger" onclick="delAPI(\'/api/admin/exams/'+e.id+'\',\'Exam deleted\')">Delete</button><button class="btn ghost" onclick="submissions('+e.id+')">Submissions</button>':'')+'</div></article>';
      });
      updateExamCountdowns();
      return;
    }
    if(S.view==='announcements'){
      patchLiveCards('#content > .grid',S.announcements,a=>'<article class="card" data-live-id="'+esc(a.id)+'"><div class="head"><span class="badge">'+esc(a.category||'General')+'</span><small>'+esc(announcementTime(a.created_at))+'</small></div><h3>'+esc(a.title)+'</h3><p>'+esc(a.body||'')+'</p>'+(can('MANAGE_ANNOUNCEMENTS')?'<div class="actions-row"><button class="btn ghost" onclick="announcementEdit('+a.id+')">Edit</button><button class="btn danger" onclick="delAPI(\'/api/admin/announcements/'+a.id+'\',\'Announcement deleted\')">Delete</button></div>':'')+'</article>');
      return;
    }
    const scrollY=window.scrollY;
    document.documentElement.classList.add('live-update');
    render();
    requestAnimationFrame(()=>{window.scrollTo({top:scrollY,left:0,behavior:'instant'});document.documentElement.classList.remove('live-update')});
  }catch{}
  finally{liveSyncBusy=false}
}
function ensureGlobalRealtime(){
  if(!S.me)return;
  if(window.globalRealtimeStream&&window.globalRealtimeStream.readyState!==2)return;
  try{
    window.globalRealtimeStream=new EventSource(API+'/api/live/stream',{withCredentials:true});
    window.globalRealtimeStream.addEventListener('open',()=>{
      window.globalRealtimeOnline=true;
      clearInterval(window.liveFallbackTimer);
    });
    window.globalRealtimeStream.addEventListener('data-changed',()=>syncLiveData());
    window.globalRealtimeStream.addEventListener('notification',(event)=>{
      try{
        const n=JSON.parse(event.data||'{}');
        if(!n?.id)return;
        if((S.notifications||[]).some(x=>Number(x.id)===Number(n.id)))return;
        S.notifications=[n,...(S.notifications||[])].slice(0,30);
        updateNotificationBadge();
        const title=String(n.title||'New notification');
        const body=String(n.body||'');
        toast(body?title+' — '+body:title);
        if($('#back')?.classList.contains('show')&&document.querySelector('.notification-modal'))openNotifications();
      }catch{}
    });
    window.globalRealtimeStream.addEventListener('site-status',(event)=>{
      try{
        const data=JSON.parse(event.data||'{}');
        if(data.locked && Number(S.me?.is_super_admin)!==1){
          document.documentElement.classList.add('site-lock-transition');
          setTimeout(()=>window.location.reload(),180);
        }
      }catch{}
    });
    window.globalRealtimeStream.addEventListener('ready',()=>{window.globalRealtimeOnline=true});
    window.globalRealtimeStream.onerror=()=>{
      window.globalRealtimeOnline=false;
      clearInterval(window.liveFallbackTimer);
      window.liveFallbackTimer=setInterval(()=>{if(!window.globalRealtimeOnline)syncLiveData()},15000);
    };
  }catch{
    window.globalRealtimeOnline=false;
    clearInterval(window.liveFallbackTimer);
    window.liveFallbackTimer=setInterval(syncLiveData,15000);
  }
}
function liveDataLoop(){
  clearInterval(window.liveDataTimer);
  clearInterval(window.liveFallbackTimer);
  ensureGlobalRealtime();
}

function filePicked(input){const name=input?.files?.[0]?.name||'No file selected';const out=input?.parentElement?.querySelector('.file-name');if(out)out.textContent=name}
function filePicker(id,label='Choose file',accept=''){return '<label class="file-picker" for="'+esc(id)+'"><input id="'+esc(id)+'" type="file" '+(accept?'accept="'+esc(accept)+'" ':'')+'onchange="filePicked(this)"><span class="file-picker-icon">↥</span><span class="file-picker-copy"><b>'+esc(label)+'</b><small class="file-name">No file selected</small></span></label>'}
function openAssignment(id){const x=S.assignments.find(a=>Number(a.id)===Number(id));if(!x)return;const tm=assignmentTime(x);if(S.me?.role==='STUDENT'&&tm.label==='Deadline passed'){toast('The assignment deadline has passed');return}const upload=(S.me&&S.me.role==='STUDENT'&&x.status==='OPEN'&&tm.label!=='Deadline passed')?'<form class="assignment-submit" onsubmit="submitAssignment(event,'+x.id+')"><label class="field-label">Submit your work</label>'+filePicker('submissionFile','Choose your work')+'<small class="muted">Upload any file up to 25 MB. You can replace your submission before the deadline.</small><button class="btn primary">Upload & Submit</button></form>':'';const own=x.submission_id?'<div class="notice submission-own"><div><b>Your submission</b><small>'+esc(x.submission_name||'file')+'</small></div><div class="submission-own-actions"><a class="btn ghost" href="'+esc(API+'/api/assignments/submissions/files/'+(x.submission_file_id||x.submission_id))+'" target="_blank" rel="noopener">Open</a><button class="btn danger" type="button" onclick="deleteMySubmission('+x.id+')">Delete</button></div></div>':'';modal('<div class="modalhead"><div><span class="eyebrow">ASSIGNMENT</span><h2>'+esc(x.title)+'</h2></div><button class="close" onclick="b4Close()">×</button></div><div class="assignment-open"><p class="muted">'+esc(x.subject_name||'')+'</p><p>'+esc(x.description||'')+'</p><div class="assignment-countdown large"><span>Time left</span><b class="countdown '+tm.tone+'">'+tm.label+'</b></div><div class="assignment-bar"><span class="'+tm.tone+'" style="width:'+tm.pct+'%"></span></div>'+(x.attachment_id?'<a class="btn primary assignment-open-file" href="'+esc(API+'/api/assignments/files/'+x.attachment_id)+'" target="_blank" rel="noopener">📎 Open assignment file</a>':'<div class="notice">No assignment file attached.</div>')+own+upload+'</div>')}
function assignmentEdit(id){const x=S.assignments.find(a=>Number(a.id)===Number(id))||{};modal('<div class="modalhead"><h2>Assignment</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="saveAssignment(event,'+(id||'null')+')"><label>Title<input id="at" value="'+esc(x.title||'')+'" placeholder="Title" required></label><label class="field-label">Assignment file</label>'+filePicker('af','Choose assignment file')+'<small class="muted">Upload any file up to 25 MB.</small>'+(x.attachment_name?'<div class="notice current-assignment-file">Current file: <b>'+esc(x.attachment_name)+'</b><button class="btn danger" type="button" onclick="deleteAssignmentFile('+x.id+')">Remove file</button></div>':'')+'<label>Subject<select id="as">'+S.subjects.map(s=>'<option value="'+s.id+'" '+(Number(s.id)===Number(x.subject_id)?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select></label><label>Description<textarea id="ad">'+esc(x.description||'')+'</textarea></label><label>Deadline<input id="due" type="datetime-local" value="'+(x.due_at?String(x.due_at).replace(' ','T').slice(0,16):'')+'"></label><button class="btn primary">Save</button></form>')}
async function saveAssignment(e,id){e.preventDefault();const b={title:$('#at').value,subjectId:Number($('#as').value)||null,description:$('#ad').value,dueAt:$('#due').value||null};try{let assignmentId=id;if(id){await api('/api/admin/assignments/'+id,{method:'PATCH',body:JSON.stringify(b)})}else{const d=await api('/api/admin/assignments',{method:'POST',body:JSON.stringify(b)});assignmentId=d.id}const file=$('#af')?.files?.[0];if(file){const fd=new FormData();fd.append('file',file);const r=await fetch(API+'/api/admin/assignments/'+assignmentId+'/file',{method:'POST',credentials:'include',body:fd});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'Assignment file upload failed')}close();await loadData();render();toast('Assignment saved ✓')}catch(x){toast(x.message)}}
async function assignmentSubmissions(id){try{const url=id?'/api/admin/assignment-submissions?assignmentId='+encodeURIComponent(id):'/api/admin/assignment-submissions';const d=await api(url);const rows=d.submissions||[];modal('<div class="modalhead"><div><span class="eyebrow">TEACHER CENTER</span><h2>Assignment submissions</h2></div><button class="close" onclick="b4Close()">×</button></div><div class="submission-list">'+(rows.length?rows.map(x=>'<article class="submission-card"><div class="submission-person"><div class="submission-avatar">♙</div><div><b>'+esc(x.display_name||'Student')+'</b><small>'+esc(x.student_code||'Student')+'</small></div></div><div class="submission-main"><span class="badge">'+esc(x.assignment_title||'Assignment')+'</span><b>'+esc(x.filename||'No file')+'</b><small class="muted">'+esc(x.submitted_at||'')+'</small></div><div class="submission-actions">'+(x.file_id?'<a class="btn primary" href="'+esc(API+'/api/admin/assignment-submissions/files/'+x.file_id)+'" target="_blank" rel="noopener">Open file ↗</a>':'<span class="muted">No file</span>')+'</div></article>').join(''):'<div class="empty">No student submissions yet.</div>')+'</div>')}catch(e){toast(e.message)}}
async function deleteMySubmission(id){if(!await confirmAction('Delete your uploaded submission?'))return;try{await api('/api/assignments/'+id+'/submission',{method:'DELETE'});await loadData();render();openAssignment(id);toast('Submission deleted ✓')}catch(e){toast(e.message)}}
async function deleteAssignmentFile(id){if(!await confirmAction('Remove this assignment file?'))return;try{await api('/api/admin/assignments/'+id+'/file',{method:'DELETE'});await loadData();render();assignmentEdit(id);toast('Assignment file removed ✓')}catch(e){toast(e.message)}}
async function submitAssignment(e,id){e.preventDefault();const file=$('#submissionFile')?.files?.[0];if(!file)return;const fd=new FormData();fd.append('file',file);try{const r=await fetch(API+'/api/assignments/'+id+'/submission',{method:'POST',credentials:'include',body:fd});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'Submission upload failed');await loadData();render();openAssignment(id);toast('Assignment submitted ✓')}catch(x){toast(x.message)}}
function resourcesV(){return title(t('resources'),'Lessons, links and PDFs.',can('MANAGE_RESOURCES')?'<button class="btn primary" onclick="resourceEdit()">＋ '+t('add')+'</button>':'')+'<div class="grid c3">'+S.resources.map(r=>'<article class="card"><span class="badge">'+esc(r.resource_type||'RESOURCE')+'</span><h3>'+esc(r.title)+'</h3><p class="muted">'+esc(r.description||'')+'</p>'+(r.subject_id?'<button class="btn primary" onclick="openSubject('+Number(r.subject_id)+')">Open subject →</button>':(r.url||r.file_url?'<a class="btn primary" href="'+esc(r.url||r.file_url)+'" target="_blank" rel="noopener">'+t('open')+' →</a>':''))+(can('MANAGE_RESOURCES')?'<div class="actions-row"><button class="btn ghost" onclick="resourceEdit('+r.id+')">Edit</button><button class="btn danger" onclick="delAPI(\'/api/admin/resources/'+r.id+'\',\'Resource deleted\')">Delete</button></div>':'')+'</article>').join('')||'<div class="card empty">No resources.</div>'+'</div>'}
function examsV(){
  const canSubmit=can('MANAGE_EXAMS')&&(S.me?.role==='TEACHER'||Number(S.me?.is_super_admin)===1);
  return title(t('exams'),'Exams, submissions and results.',can('MANAGE_EXAMS')?'<button class="btn primary" onclick="examEdit()">＋ '+t('add')+'</button>':'')+
  '<div class="grid c2 exam-cards">'+S.exams.map(e=>{
    const tm=examTime(e),submitted=e.attempt_status==='SUBMITTED',started=e.attempt_status==='STARTED',locked=e.attempt_status==='LOCKED';
    const action=submitted?'<button class="btn primary" onclick="loadStudentExamAnswers('+e.id+')">View Answers</button>':locked?'<button class="btn danger" disabled>🔒 Exam Locked</button>':started?'<button class="btn primary" onclick="startExam('+e.id+')">Continue Exam</button>':'<button class="btn primary" data-exam-open '+(tm.label==='Exam closed'?'disabled':'')+' onclick="startExam('+e.id+')">Open</button>';
    return '<article class="card exam-card" data-live-id="'+esc(e.id)+'"><div class="head"><span class="badge">'+esc(e.status)+'</span><span class="muted">'+esc(e.subject_name||'')+'</span></div><h3>'+esc(e.title)+'</h3><p class="muted">'+esc(e.description||'')+'</p><div class="meter"><span>Exam time</span><b class="countdown '+tm.tone+'">'+tm.label+'</b></div><div class="assignment-bar exam-time-bar"><span class="'+tm.tone+'" style="width:'+tm.pct+'%"></span></div><div class="actions-row">'+action+(can('MANAGE_EXAMS')?'<button class="btn ghost" onclick="examEdit('+e.id+')">Edit</button><button class="btn danger" onclick="delAPI(\'/api/admin/exams/'+e.id+'\',\'Exam deleted\')">Delete</button>':'')+(canSubmit?'<button class="btn ghost" onclick="submissions('+e.id+')">Submissions</button>':'')+'</div></article>';
  }).join('')||'<div class="card empty">No exams.</div>'+'</div>';
}
function announcementTime(value){
  const d=new Date(value);
  if(!Number.isFinite(d.getTime()))return String(value||'');
  const locale=S.lang==='ar'?'ar-EG':'en-EG';
  return d.toLocaleString(locale,{timeZone:'Africa/Cairo',day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit',hour12:S.lang!=='ar'});
}
function announcementsV(){return title(t('announcements'),'class announcements.',can('MANAGE_ANNOUNCEMENTS')?'<button class="btn primary" onclick="announcementEdit()">＋ '+t('add')+'</button>':'')+'<div class="grid">'+S.announcements.map(a=>'<article class="card" data-live-id="'+esc(a.id)+'"><div class="head"><span class="badge">'+esc(a.category||'General')+'</span><small>'+esc(announcementTime(a.created_at))+'</small></div><h3>'+esc(a.title)+'</h3><p>'+esc(a.body||'')+'</p>'+(can('MANAGE_ANNOUNCEMENTS')?'<div class="actions-row"><button class="btn ghost" onclick="announcementEdit('+a.id+')">Edit</button><button class="btn danger" onclick="delAPI(\'/api/admin/announcements/'+a.id+'\',\'Announcement deleted\')">Delete</button></div>':'')+'</article>').join('')+'</div>'}
function chatTime(value){
  const d=new Date(value);
  if(!Number.isFinite(d.getTime()))return String(value||'');
  return d.toLocaleTimeString('en-US',{timeZone:'Africa/Cairo',hour:'numeric',minute:'2-digit',hour12:true});
}
function chatV(){
  return title(t('chat'),'')+'<div class="card chat"><div class="messages" id="messages">'+S.messages.map(messageHTML).join('')+'</div><div id="typing" class="typing-indicator"></div><button type="button" id="chatJumpBottom" class="chat-jump-bottom" onclick="jumpChatBottom(\'messages\')" aria-label="Scroll to latest messages" title="Scroll to latest messages">↓</button><form class="chatform" onsubmit="sendChat(event)"><input id="chatInput" oninput="typing(!!this.value.trim())" placeholder="Write a message..."><button class="btn primary">➤</button></form></div>'
}
function jumpChatBottom(id){
  const box=document.getElementById(id);
  if(!box)return;
  box.scrollTo({top:box.scrollHeight,behavior:'smooth'});
  requestAnimationFrame(()=>rememberChatPosition(id));
}
function chatSeenKey(id){return 'b4ChatSeen:'+id}
function rememberChatPosition(boxId){
  const box=document.getElementById(boxId);
  if(!box)return;
  const msgs=[...box.querySelectorAll('[data-message-id]')];
  if(!msgs.length)return;
  const boxRect=box.getBoundingClientRect();
  let last=null;
  for(const msg of msgs){
    const r=msg.getBoundingClientRect();
    if(r.top<boxRect.bottom-6)last=msg;
  }
  if(last){
    localStorage.setItem(chatSeenKey(boxId),String(last.dataset.messageId));
  }
}
function restoreChatPosition(boxId){
  const box=document.getElementById(boxId);
  if(!box)return;
  const saved=Number(localStorage.getItem(chatSeenKey(boxId)||'')||0);
  const nodes=[...box.querySelectorAll('[data-message-id]')];
  const latest=nodes.reduce((max,node)=>Math.max(max,Number(node.dataset.messageId)||0),0);
  if(!saved||!latest||saved>=latest){
    box.scrollTop=box.scrollHeight;
    return;
  }
  const target=box.querySelector('[data-message-id="'+CSS.escape(String(saved))+'"]');
  if(target){
    const boxRect=box.getBoundingClientRect(),r=target.getBoundingClientRect();
    const delta=r.top-boxRect.top-Math.min(70,box.clientHeight*.18);
    box.scrollTop=Math.max(0,box.scrollTop+delta);
  }else{
    box.scrollTop=box.scrollHeight;
  }
}
function markChatSeen(boxId){
  const box=document.getElementById(boxId);
  if(!box)return;
  const distance=box.scrollHeight-box.scrollTop-box.clientHeight;
  if(distance>80)return;
  const nodes=[...box.querySelectorAll('[data-message-id]')];
  if(!nodes.length)return;
  const latest=nodes[nodes.length-1];
  localStorage.setItem(chatSeenKey(boxId),String(latest.dataset.messageId));
}
function setupChatPosition(boxId){
  const box=document.getElementById(boxId);
  if(!box)return;
  restoreChatPosition(boxId);
  box.addEventListener('scroll',()=>{
    if(box.scrollHeight-box.scrollTop-box.clientHeight<80)markChatSeen(boxId);
  },{passive:true});
}
function setupChatJumpButton(boxId,buttonId){
  const box=document.getElementById(boxId),button=document.getElementById(buttonId);
  if(!box||!button)return;
  const update=()=>{
    const distance=box.scrollHeight-box.scrollTop-box.clientHeight;
    button.classList.toggle('show',distance>120);
  };
  box.addEventListener('scroll',update,{passive:true});
  update();
}
function messageHTML(m){
  const reply=m.reply_to_id?'<div class="reply-preview"><b>↩ '+esc(m.reply_display_name||'Reply')+'</b><span>'+esc(m.reply_body||'')+'</span></div>':'';
  const edited=m.edited_at?'<small class="edited">edited</small>':'';
  return '<div class="msg '+(S.me&&Number(m.user_id)===Number(S.me.id)?'me':'')+'" data-message-id="'+esc(m.id)+'" onclick="messageMenu(event,'+m.id+')"><img class="avatar" src="'+esc(m.avatar_url||'/assets/logo.svg')+'"><div><div class="chat-name-line"><b>'+esc(m.display_name||'Deleted user')+'</b>'+badgeHTML(m.badges,true)+'</div>'+reply+'<div class="bubble">'+esc(m.body||'')+edited+'</div><small class="muted">'+esc(chatTime(m.created_at))+'</small></div></div>'
}
function attendanceV(){if(!can('MANAGE_ATTENDANCE'))return title(t('attendance'),'Your attendance record.')+'<div class="card"><p>Attendance management is available to authorized staff.</p></div>';return title(t('attendance'),'<button class="btn primary" onclick="attendanceLoad()">Refresh</button>')+'<div id="attendanceRoot"></div>'}
function adminV(){const cards=[['roles','Roles','MANAGE_ROLES'],['permissions','Permissions','MANAGE_PERMISSIONS'],['accounts','Accounts','MANAGE_ACCOUNTS'],['students','Manage Students','MANAGE_STUDENTS'],['teachers','Manage Teachers','MANAGE_TEACHERS'],['keys','Activation Keys','MANAGE_KEYS'],['badges','Manage Badges','MANAGE_BADGES'],['subjects','Manage Subjects','MANAGE_SUBJECTS'],['schedule','Manage Schedule','MANAGE_SCHEDULE'],['admins','Manage Admins','MANAGE_ADMINS'],['logs','View Logs','VIEW_LOGS'],['attendance','Attendance','MANAGE_ATTENDANCE'],['site','Manage Site','MANAGE_SITE']];if(Number(S.me?.is_super_admin)===1||can('MANAGE_DEVELOPERS'))cards.push(['developers','Manage Developers','MANAGE_DEVELOPERS']);return title(t('admin'),'Control center')+'<div class="grid c3 admin-cards">'+cards.filter(x=>can(x[2])).map(x=>'<button class="card admin-card" onclick="go(\'admin:'+x[0]+'\')"><span>◈</span><h3>'+x[1]+'</h3><small>Open management</small></button>').join('')+'</div>'}
function teacherCenterV(){return title(t('teacherCenter'),'Teacher tools')+'<div class="grid c3">'+[['assignments','Create assignments','MANAGE_ASSIGNMENTS'],['assignment-submissions','Assignment submissions','MANAGE_ASSIGNMENTS'],['resources','Publish resources/PDFs','MANAGE_RESOURCES'],['exams','Create exams','MANAGE_EXAMS'],['announcements','Publish announcements','MANAGE_ANNOUNCEMENTS'],['subjects','Manage teaching subjects','MANAGE_SUBJECTS'],['schedule','View schedule','VIEW_CLASS']].filter(x=>can(x[2])).map(x=>'<button class="card admin-card" onclick="'+(x[0]==='assignment-submissions'?'assignmentSubmissions()':'go(\''+x[0]+'\')')+'"><span>✦</span><h3>'+x[1]+'</h3></button>').join('')+'</div>'}
function settingsV(){
  const ar=S.lang==='ar';
  const ns=S.notificationSettings||{};
  const pushOn=Number(ns.push_enabled)===1;
  return title(t('settings'),ar?'إعدادات الحساب واللغة والمظهر وإشعارات الجهاز وربط Google.':'Account, language, theme, device notifications and Google linking.')+
  '<div class="grid c2"><div class="card"><h3>'+ (ar?'الملف الشخصي':'Profile') +'</h3><form class="form" onsubmit="saveProfile(event)"><label>'+ (ar?'اسم العرض':'Display name') +'<input id="displayName" value="'+esc(S.me?.display_name||'')+'" required></label><label>'+ (ar?'صورة الملف الشخصي':'Profile image') +'<input id="profileAvatar" type="file" accept="image/png,image/jpeg,image/webp"></label><button class="btn primary">'+t('save')+'</button></form><button class="btn ghost" onclick="passwordModal()">'+(ar?'تغيير كلمة المرور':'Change password')+'</button><button class="btn danger" onclick="logout()"> '+t('logout')+'</button></div>'+
  '<div class="card"><h3>'+ (ar?'التفضيلات':'Preferences') +'</h3><div class="settings-lang"><span class="muted">'+t('arabic')+' / '+t('english')+'</span><div><button class="btn '+(S.lang==='en'?'primary':'ghost')+'" onclick="setLang(\'en\')">EN</button><button class="btn '+(S.lang==='ar'?'primary':'ghost')+'" onclick="setLang(\'ar\')">عربي</button></div></div><button class="btn ghost" onclick="toggleTheme()">'+(S.theme==='dark'?t('light'):t('dark'))+'</button><hr><h3>Google</h3><p class="muted">'+(S.linked.length?(ar?'Google مرتبط':'Google linked'):(ar?'Google غير مرتبط':'Google not linked'))+'</p><button class="btn primary" onclick="googleLink()">'+(S.linked.length?(ar?'إعادة ربط Google':'Relink Google'):(ar?'ربط Google':'Link Google'))+'</button>'+(S.linked.length?'<button class="btn danger" onclick="unlinkGoogle()">'+(ar?'إلغاء ربط Google':'Unlink Google')+'</button>':'')+'</div>'+
  '<div class="card" style="grid-column:1/-1"><div class="head"><div><h3>🔔 '+(ar?'إشعارات B4':'B4 Notifications')+'</h3><p class="muted">'+(ar?'كل أنواع إشعارات B4 مفعلة تلقائيًا ولا تحتاج إعدادات منفصلة':'All B4 notification types are enabled automatically — no separate notification switches.')+'</p></div></div>'+
  '<div class="settings-lang notification-setting-row"><div><b>📱 '+(ar?'إشعارات الجهاز':'Device Notifications')+'</b><small class="muted" style="display:block;margin-top:3px">'+(ar?'تظهر حتى لو B4 مقفول — فعّلها مرة واحدة من جهازك':'Can appear even when B4 is closed — enable them once on your device')+'</small></div><div class="actions-row"><button type="button" class="btn '+(pushOn?'primary':'ghost')+'" onclick="togglePushNotifications('+(pushOn?'false':'true')+')">'+(pushOn?(ar?'مفعلة ✓':'Enabled ✓'):(ar?'تفعيل':'Enable'))+'</button>'+(pushOn?'<button type="button" class="btn ghost" onclick="sendTestPush()">🔔 Test Notification</button>':'')+'</div></div>'+
  '</div></div>';
}
function devV(){return title(t('developers'),'The Wep Devoleper')+'<div class="grid developers-grid">'+S.developers.map(d=>'<article class="card developer-card"><div class="developer-photo"><img class="avatar xl" src="'+esc(d.avatar_url||'/assets/logo.svg')+'" onerror="this.src=\'assets/logo.svg\'"></div><div class="developer-info"><span class="badge">B4 DEVELOPER</span>'+(d.title?'<span class="developer-title">'+esc(d.title)+'</span>':'')+(d.title2?'<span class="developer-title">'+esc(d.title2)+'</span>':'')+'<h3>'+esc(d.name)+'</h3>'+(d.link_url?'<a class="btn ghost developer-link" href="'+esc(d.link_url)+'" target="_blank" rel="noopener">Open profile ↗</a>':'')+'</div></article>').join('')||'<div class="card empty">No developers added yet.</div>'+'</div>'}
function animateDashboardStats(){
  document.querySelectorAll('[data-stat-count]').forEach(function(el){
    var target=parseInt(el.getAttribute('data-stat-count'),10)||0;
    el.textContent='0';
    if(target<=0)return;
    var start=performance.now();
    var duration=2200;
    function tick(now){
      var progress=Math.min(1,(now-start)/duration);
      var eased=1-Math.pow(1-progress,3);
      el.textContent=String(Math.floor(target*eased));
      if(progress<1)requestAnimationFrame(tick);
      else el.textContent=String(target);
    }
    requestAnimationFrame(tick);
  });
}
function render(){document.documentElement.dataset.theme=S.theme;document.documentElement.classList.toggle('dark',S.theme==='dark');document.documentElement.lang=S.lang;document.documentElement.dir=S.lang==='ar'?'rtl':'ltr';if($('#lang span'))$('#lang span').textContent=S.lang==='ar'?'EN':'عربي';$('#nav').innerHTML=buildNav();let v=S.view;let html=v==='dashboard'?dashboard():v==='students'?studentsV():v==='teachers'?teachersV():v==='subjects'?subjectsV():v==='subject'?subjectV():v==='schedule'?scheduleV():v==='assignments'?tasksV():v==='resources'?resourcesV():v==='exams'?examsV():v==='announcements'?announcementsV():v==='chat'?chatV():v==='teacherChat'?teacherChatV():v==='attendance'?attendanceV():v==='admin'?adminV():v==='teacherCenter'?teacherCenterV():v==='settings'?settingsV():v==='developers'?devV():v==='exam-run'?examRunV():v==='exam-locked'?examLockedV():v==='exam-result'?examResultV():v==='exam-answers'?examAnswersV():v==='exam-review'?examReviewV():v.startsWith('admin:')?adminPage(v.slice(6)):dashboard();$('#content').innerHTML=html;if(v==='dashboard')animateDashboardStats();$('#topName').textContent=S.me?.display_name||t('guest');if(S.me?.avatar_url)$('#topAvatar').src=S.me.avatar_url;if(v==='attendance'&&can('MANAGE_ATTENDANCE'))attendanceLoad();if(v==='chat'){chatLoop();setupChatPosition('messages');setupChatJumpButton('messages','chatJumpBottom')}if(v==='teacherChat'){teacherChatLoop();setupChatPosition('teacherMessages');setupChatJumpButton('teacherMessages','teacherChatJumpBottom')}if(v.startsWith('admin:'))adminLoad(v.slice(6));if(v==='assignments')startAssignmentCountdown()}
function teacherChatV(){
  return title(t('teacherChat'),'')+'<div class="card chat"><div class="messages" id="teacherMessages">'+S.teacherMessages.map(teacherMessageHTML).join('')+'</div><div id="teacherTyping" class="typing-indicator"></div><button type="button" id="teacherChatJumpBottom" class="chat-jump-bottom" onclick="jumpChatBottom(\'teacherMessages\')" aria-label="Scroll to latest messages" title="Scroll to latest messages">↓</button><form class="chatform" onsubmit="sendTeacherChat(event)"><input id="teacherInput" oninput="teacherTyping(!!this.value.trim())" placeholder="Write a message..."><button class="btn primary">➤</button></form></div>'
}
function adminPage(p){if(p==='roles')return title('Roles','Account role is only Student or Teacher. Super Admin is a private system flag, never a role.')+'<div id="adminRoot"></div>';if(p==='permissions')return title('Permissions','Direct permissions are independent from the account role. Administrator grants every permission.')+'<div id="adminRoot"></div>';if(p==='accounts')return title('Accounts','Activation key, Google link, password and sessions.')+'<div id="adminRoot"></div>';if(p==='students')return title('Manage Students','Edit identity, display name and photo.','<button class="btn primary" onclick="studentEdit()">＋ Add</button>')+'<div class="grid c3">'+S.students.map(x=>peopleCard(x,'student')).join('')+'</div>';if(p==='teachers')return title('Manage Teachers','Edit identity, display name and photo.','<button class="btn primary" onclick="teacherEdit()">＋ Add</button>')+'<div class="grid c3">'+S.teachers.map(x=>peopleCard(x,'teacher')).join('')+'</div>';if(p==='keys')return title('Activation Keys','One-time keys.')+'<div id="adminRoot"></div>';if(p==='badges')return title('Manage Badges','Create icons and assign badges.')+'<div id="adminRoot"></div>';if(p==='subjects')return subjectsV();if(p==='schedule')return scheduleV();if(p==='admins')return title('Manage Admins','Admin access is independent from Student/Teacher role.')+'<div id="adminRoot"></div>';if(p==='logs')return title('Logs','All platform activity and security events.')+'<div id="adminRoot"></div>';if(p==='attendance')return attendanceV();if(p==='site')return title('Manage Site','Lock the entire site for everyone except Super Admin.')+'<div id="adminRoot"></div>';if(p==='developers')return title('Manage Developers','Super Admin only.')+'<div id="adminRoot"></div>';return adminV()}
async function syncProfiles(){
  if(!S.me)return;
  try{
    const d=await api('/api/profile/live');
    for(const u of d.users||[]){
      const uid=Number(u.id),avatar=u.avatar_url||'/assets/logo.svg';
      if(S.me&&Number(S.me.id)===uid)S.me.avatar_url=avatar;
      S.messages=(S.messages||[]).map(m=>Number(m.user_id)===uid?{...m,avatar_url:avatar}:m);
      S.students=(S.students||[]).map(x=>Number(x.user_id)===uid?{...x,avatar_url:avatar}:x);
      S.teachers=(S.teachers||[]).map(x=>Number(x.user_id)===uid?{...x,avatar_url:avatar}:x);
      document.querySelectorAll('[data-user-avatar="'+uid+'"]').forEach(img=>{img.src=avatar});
    }
    if(S.me?.avatar_url&&$('#topAvatar'))$('#topAvatar').src=S.me.avatar_url;
  }catch{}
}
function profileSyncLoop(){clearInterval(window.profileSyncTimer);if(!S.me)return;syncProfiles();window.profileSyncTimer=setInterval(syncProfiles,1500)}
async function loadMe(){
  try{
    const d=await api('/api/auth/me');
    S.me=d.user;
    S.linked=(await api('/api/auth/linked')).linked||[];
    try{
      const ns=await api('/api/notifications/settings');
      S.notificationSettings={...(S.notificationSettings||{}),...(ns.settings||{})};
      S.vapidPublicKey=ns.vapidPublicKey||'';
    }catch{
      S.notificationSettings={...(S.notificationSettings||{}),push_enabled:0};
      S.vapidPublicKey='';
    }
    ensureRealtime();
    ensureGlobalRealtime();
  }catch{
    S.me=null;S.linked=[];
    S.notificationSettings={chat_messages:1,class_chat_messages:1,class_chat_reply:1,teacher_chat_messages:1,teacher_chat_reply:1,exam_notifications:1,exam_results:1,announcement_notifications:1,assignment_notifications:1,resource_notifications:1,attendance_notifications:1,system_notifications:1,push_enabled:0};
    S.vapidPublicKey='';
  }
  await loadData();render();updateNotificationBadge();profileSyncLoop();startAssignmentCountdown();liveDataLoop();
  if(S.me) maybeEnableDeviceNotifications();
}
async function loadData(){try{const d=await api('/api/bootstrap');const server=Number(d.server_now_ms)||Date.now();S.serverNowMs=server;if(!Number.isFinite(Number(S.serverClockOffsetMs))||!S.serverClockOffsetMs)S.serverClockOffsetMs=server-Date.now();Object.assign(S,{students:d.students||[],teachers:d.teachers||[],subjects:d.subjects||[],schedule:d.schedule||[],assignments:d.assignments||[],announcements:d.announcements||[],resources:d.resources||[],exams:d.exams||[],attendance:d.attendance||[],messages:d.messages||[],notifications:d.notifications||[]});try{S.developers=(await api('/api/admin/developers/public')).developers||[]}catch{}updateNotificationBadge();S.error=''}catch(e){S.error=e.message}}


async function login(e){e.preventDefault();try{await api('/api/auth/login',{method:'POST',body:JSON.stringify({login:$('#loginName').value.trim(),password:$('#loginPassword').value})});close();await loadMe();toast('Login successful ✓')}catch(x){toast(x.message)}}
function loginModal(){modal('<div class="modalhead"><h2>'+t('login')+'</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="login(event)"><label>Display name<input id="loginName" required autocomplete="username"></label><label>Password<input id="loginPassword" type="password" required autocomplete="current-password"></label><button class="btn primary">'+t('login')+' →</button></form><div class="login-divider"><span>or</span></div><button class="google-btn" onclick="googleLogin()">Continue with Google</button><button class="btn ghost" onclick="forgotPassword()">Forgot my password</button><button class="btn ghost" onclick="activationModal()">'+t('activate')+'</button>')}
function activationModal(){modal('<div class="modalhead"><h2>'+t('activate')+'</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="activate(event)"><label>One-time key<input id="actKey" required></label><label>Display name<input id="actName" required></label><label>Password<input id="actPw" type="password" minlength="8" required></label><button class="btn primary">Create account</button></form>')}
async function activate(e){e.preventDefault();try{await api('/api/auth/activate',{method:'POST',body:JSON.stringify({key:$('#actKey').value.trim(),displayName:$('#actName').value.trim(),password:$('#actPw').value})});close();toast('Account created ✓');loginModal()}catch(x){toast(x.message)}}
function googleLogin(){location.href=API+'/api/auth/google/login'}
function notificationPermissionModal(){
  const ar=S.lang==='ar';
  modal(
    '<div class="modalhead"><div><h2>🔔 '+(ar?'تفعيل إشعارات B4':'Enable B4 Notifications')+'</h2><p class="muted">'+(ar?'فعّل الإشعارات عشان توصلك الرسائل والامتحانات والواجبات حتى لو B4 مقفول':'Allow notifications so you can receive messages, exams and assignments even when B4 is closed.')+'</p></div><button class="close" onclick="b4Close()">×</button></div>'+
    '<div class="card" style="margin:12px 0"><b>📱 '+(ar?'إشعارات الجهاز':'Device Notifications')+'</b><p class="muted" style="margin:6px 0 0">'+(ar?'المتصفح هيطلب منك السماح بالإشعارات مرة واحدة':'Your browser will ask for permission once.')+'</p></div>'+
    '<div class="actions-row"><button class="btn ghost" onclick="b4Close()">'+(ar?'لاحقًا':'Later')+'</button><button class="btn primary" onclick="requestDeviceNotificationPermission({fromUser:true})">'+(ar?'السماح بالإشعارات':'Allow Notifications')+' →</button></div>'
  );
}
async function requestDeviceNotificationPermission({fromUser=false}={}){
  try{
    if(!('Notification' in window)){toast(S.lang==='ar'?'المتصفح لا يدعم إشعارات الجهاز':'This browser does not support device notifications');return false;}
    if(!window.isSecureContext){toast(S.lang==='ar'?'إشعارات الجهاز تحتاج HTTPS':'Device notifications require HTTPS');return false;}
    if(!('serviceWorker' in navigator)||!('PushManager' in window)){toast(S.lang==='ar'?'إشعارات الجهاز غير مدعومة هنا — جرّب Chrome':'Device notifications are not supported here — try Chrome');return false;}
    toast(S.lang==='ar'?'جاري تفعيل إشعارات الجهاز…':'Enabling device notifications…');
    let permission=Notification.permission;
    if(permission==='default')permission=await Notification.requestPermission();
    if(permission!=='granted'){toast(permission==='denied'?(S.lang==='ar'?'الإشعارات مقفولة من إعدادات المتصفح — اسمح بها للموقع ثم جرّب مرة أخرى':'Notifications are blocked in browser settings — allow them for this site and try again'):(S.lang==='ar'?'لم يتم السماح بالإشعارات':'Notification permission was not granted'));return false;}
    if(!S.me){toast(S.lang==='ar'?'لازم تسجل دخول الأول':'Please log in first');return false;}
    localStorage.setItem('b4NotificationPermission','granted');
    const ok=await syncPushSubscription(true);
    if(!ok)return false;
    const d=await api('/api/notifications/settings',{method:'PATCH',body:JSON.stringify({...S.notificationSettings,chat_messages:1,class_chat_messages:1,class_chat_reply:1,teacher_chat_messages:1,teacher_chat_reply:1,exam_notifications:1,exam_results:1,announcement_notifications:1,assignment_notifications:1,resource_notifications:1,attendance_notifications:1,system_notifications:1,push_enabled:1})});
    S.notificationSettings={...(S.notificationSettings||{}),...(d.settings||{}),push_enabled:1};
    render();
    toast(S.lang==='ar'?'تم تفعيل إشعارات الجهاز ✓':'Device notifications enabled ✓');
    return true;
  }catch(e){console.error('B4 device notifications:',e);toast((S.lang==='ar'?'فشل تفعيل الإشعارات: ':'Could not enable notifications: ')+(e?.message||'Unknown error'));return false;}
}
async function maybeEnableDeviceNotifications(){
  try{
    if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window))return;
    // Device notifications stay OFF until the user explicitly enables them.
    // Having browser permission alone must never turn B4 notifications on.
    if(!S.me||Number(S.notificationSettings?.push_enabled)!==1)return;
    if(Notification.permission!=='granted')return;
    localStorage.setItem('b4NotificationPermission','granted');
    await syncPushSubscription(false);
  }catch{}
}
function base64ToUint8Array(base64){const pad='='.repeat((4-base64.length%4)%4),s=(base64+pad).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(s);return Uint8Array.from([...raw].map(ch=>ch.charCodeAt(0)))}
async function syncPushSubscription(showErrors=true){
  try{
    if(!('serviceWorker' in navigator)||!('PushManager' in window))throw Error('Push notifications are not supported by this browser');
    if(!window.isSecureContext)throw Error('Push notifications require HTTPS');
    const cfg=S.vapidPublicKey?{vapidPublicKey:S.vapidPublicKey}:await api('/api/notifications/settings');
    const publicKey=cfg.vapidPublicKey;if(!publicKey)throw Error('Push notifications are not configured on the server');
    if(Notification.permission!=='granted')throw Error(Notification.permission==='denied'?'Browser notifications are blocked. Allow them for this site.':'Notification permission is required');
    let registration=await navigator.serviceWorker.getRegistration();
    if(!registration)registration=await navigator.serviceWorker.register('/sw.js?v=push10');
    await navigator.serviceWorker.ready;
    let subscription=await registration.pushManager.getSubscription();
    if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64ToUint8Array(publicKey)});
    await api('/api/notifications/push/subscribe',{method:'POST',body:JSON.stringify(subscription.toJSON())});
    S.notificationSettings={...(S.notificationSettings||{}),push_enabled:1};updateNotificationBadge();return true;
  }catch(e){console.error('B4 push subscription:',e);if(showErrors)toast(e?.message||'Could not enable device notifications');return false;}
}
async function sendTestPush(){
  try{
    toast(S.lang==='ar'?'جاري إرسال اختبار الإشعار…':'Sending test notification…');
    const d=await api('/api/notifications/push/test',{method:'POST',body:JSON.stringify({})});
    toast((S.lang==='ar'?'تم إرسال الاختبار ✓ ':'Test push sent ✓ ')+(d.message||''));
  }catch(e){
    toast((S.lang==='ar'?'فشل اختبار الإشعار: ':'Push test failed: ')+(e.message||'Unknown error'));
  }
}
async function togglePushNotifications(enabled){
  if(!enabled){
    try{
      const registration=await navigator.serviceWorker.ready;
      const sub=await registration.pushManager.getSubscription();
      await api('/api/notifications/push/unsubscribe',{method:'POST',body:JSON.stringify({endpoint:sub?.endpoint||''})});
      if(sub)await sub.unsubscribe();
      S.notificationSettings={...(S.notificationSettings||{}),push_enabled:0};
      render();
      toast('Device notifications disabled');
    }catch(e){toast(e.message||'Could not disable device notifications')}
    return;
  }
  await requestDeviceNotificationPermission({fromUser:true});
}
async function toggleNotificationSetting(key,enabled){
  try{
    const next={...(S.notificationSettings||{}),[key]:enabled?1:0};
    const d=await api('/api/notifications/settings',{method:'PATCH',body:JSON.stringify(next)});
    S.notificationSettings=d.settings||next;render();toast(enabled?'Notification enabled ✓':'Notification disabled');
  }catch(e){toast(e.message)}
}
function updateNotificationBadge(){const count=(S.notifications||[]).filter(n=>!n.read_at).length;const dot=$('#bell i');if(dot)dot.style.display=count?'block':'none';const mobile=$('#mobileAlerts');if(mobile)mobile.innerHTML='♢'+(count?' <sup>'+Math.min(count,99)+'</sup>':'')+'<br>Alerts'}
async function markNotificationRead(id){try{await api('/api/notifications/'+id+'/read',{method:'POST'});S.notifications=(S.notifications||[]).map(n=>Number(n.id)===Number(id)?{...n,read_at:new Date().toISOString()}:n);updateNotificationBadge()}catch{}}
function openNotificationTarget(id){const n=(S.notifications||[]).find(x=>Number(x.id)===Number(id));if(!n)return;if(n.id)markNotificationRead(n.id);close();const type=String(n.type||'');const entityId=Number(n.entity_id||0);if(type.includes('chat'))go(type==='teacher_chat_reply'?'teacherChat':'chat');else if(type.includes('exam')){go('exams');if(entityId)setTimeout(()=>startExam(entityId),80)}else if(type.includes('assignment')){go('assignments');if(entityId)setTimeout(()=>openAssignment(entityId),80)}else if(type==='announcement')go('announcements');}
async function notificationTime(value){
  if(!value)return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return String(value);
  return d.toLocaleString(S.lang==='ar'?'ar-EG':'en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false});
}
function notificationMeta(n){
  const type=String(n?.type||'');
  if(type==='class_chat_message'||type==='class_chat_reply')return {icon:'💬',tone:'chat',label:'Chat'};
  if(type==='teacher_chat_message'||type==='teacher_chat_reply')return {icon:'☷',tone:'teacher',label:'Teacher Chat'};
  if(type==='exam'||type==='exam_submission'||type==='exam_result')return {icon:'📝',tone:'exam',label:'Exam'};
  if(type==='announcement')return {icon:'📢',tone:'announcement',label:'Announcement'};
  if(type==='assignment'||type==='assignment_submission')return {icon:'✓',tone:'assignment',label:'Assignment'};
  if(type==='resource')return {icon:'📚',tone:'resource',label:'Resource'};
  if(type==='attendance')return {icon:'📅',tone:'attendance',label:'Attendance'};
  return {icon:'⚙',tone:'system',label:'System'};
}
async function openNotifications(filter='all'){
  try{
    await loadData();
    const all=S.notifications||[];
    const ar=S.lang==='ar';
    const unread=all.filter(n=>!n.read_at).length;
    const list=filter==='unread'?all.filter(n=>!n.read_at):all;
    const items=list.length?list.map((n,i)=>{
      const meta=notificationMeta(n);
      return '<div class="notification-row '+(n.read_at?'':'unread')+'" style="--notification-i:'+i+';" data-notification-id="'+Number(n.id)+'">'+
        '<button class="notification-main" type="button" onclick="openNotificationTarget('+Number(n.id)+')" style="display:flex;align-items:center;gap:10px;flex:1;background:none;border:0;color:inherit;text-align:inherit;padding:0;min-width:0">'+
          '<span class="notification-dot"></span><span class="notification-icon '+meta.tone+'">'+meta.icon+'</span>'+
          '<span class="notification-copy"><span class="notification-title">'+esc(n.title)+'</span><span class="notification-body">'+esc(n.body||'')+'</span><span class="notification-type">'+esc(meta.label)+'</span></span>'+
          '<span class="notification-time">'+esc(notificationTime(n.created_at))+'</span>'+
        '</button>'+
        '<div class="notification-row-actions"><button class="btn ghost" title="'+(n.read_at?(ar?'مقروء':'Read'):(ar?'تحديد كمقروء':'Mark read'))+'" onclick="event.stopPropagation();markNotificationRead('+Number(n.id)+');setTimeout(()=>openNotifications(\''+filter+'\'),120)">'+(n.read_at?'✓':'○')+'</button><button class="btn danger" title="'+(ar?'حذف':'Delete')+'" onclick="event.stopPropagation();deleteNotification('+Number(n.id)+')">×</button></div>'+
      '</div>';
    }).join(''):'<div class="notification-empty"><span>🔔</span><b>'+(filter==='unread'?(ar?'لا توجد إشعارات غير مقروءة':'No unread notifications'):(ar?'لا توجد إشعارات':'No notifications'))+'</b><small>'+(ar?'كل شيء محدث':'You are all caught up')+'</small></div>';
    modal('<div class="notification-modal">'+
      '<div class="notification-head"><div class="notification-heading"><span class="notification-heading-icon">🔔</span><div><h2>'+(ar?'الإشعارات':'Notifications')+'</h2><p>'+(unread?unread+' '+(ar?'غير مقروء':'unread'):(ar?'كل الإشعارات مقروءة':'Everything is read'))+'</p></div></div>'+
      '<div class="notification-actions"><button class="btn ghost" onclick="openNotifications(\'all\')">'+(ar?'الكل':'All')+'</button><button class="btn ghost" onclick="openNotifications(\'unread\')">'+(ar?'غير مقروء':'Unread')+(unread?' <span>'+unread+'</span>':'')+'</button><button class="btn ghost notification-readall" onclick="markAllNotifications()">'+(ar?'قراءة الكل':'Mark all read')+'</button><button class="btn danger" onclick="deleteReadNotifications();">'+(ar?'حذف المقروء':'Delete read')+'</button><button class="close notification-close" onclick="b4Close()">×</button></div></div>'+
      '<div class="notification-list">'+items+'</div></div>');
  }catch(e){toast(e.message)}
}
async function markAllNotifications(){
  try{await api('/api/notifications/read-all',{method:'POST'});S.notifications=(S.notifications||[]).map(n=>({...n,read_at:new Date().toISOString()}));updateNotificationBadge();openNotifications('all');toast('All notifications marked as read ✓')}catch(e){toast(e.message)}
}
async function deleteNotification(id){
  try{await api('/api/notifications/'+id,{method:'DELETE'});S.notifications=(S.notifications||[]).filter(n=>Number(n.id)!==Number(id));updateNotificationBadge();openNotifications('all')}catch(e){toast(e.message)}
}
async function deleteReadNotifications(){
  try{await api('/api/notifications/read',{method:'DELETE'});S.notifications=(S.notifications||[]).filter(n=>!n.read_at);updateNotificationBadge();openNotifications('all');toast('Read notifications deleted')}catch(e){toast(e.message)}
}
async function forgotPassword(){try{const d=await api('/api/auth/forgot-password',{method:'POST'});location.href=d.whatsapp}catch(e){toast('WhatsApp support is unavailable')}} 
function passwordModal(){modal('<div class="modalhead"><h2>Change password</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="changePassword(event)"><label>Current password<input id="oldPw" type="password" required></label><label>New password<input id="newPw" type="password" minlength="8" required></label><button class="btn primary">Save</button></form>')}
async function changePassword(e){e.preventDefault();try{await api('/api/auth/password',{method:'POST',body:JSON.stringify({currentPassword:$('#oldPw').value,newPassword:$('#newPw').value})});close();toast('Password changed ✓')}catch(x){toast(x.message)}}
async function saveProfile(e){e.preventDefault();try{await api('/api/auth/profile',{method:'PATCH',body:JSON.stringify({displayName:$('#displayName').value.trim()})});const f=$('#profileAvatar')?.files?.[0];if(f){const fd=new FormData();fd.append('file',f);const r=await fetch(API+'/api/auth/avatar',{method:'POST',credentials:'include',body:fd});if(!r.ok)throw Error('Image upload failed')}await loadMe();toast('Saved ✓')}catch(x){toast(x.message)}}
async function logout(){await api('/api/auth/logout',{method:'POST'}).catch(()=>{});if(window.realtimeStream){window.realtimeStream.close();window.realtimeStream=null}if(window.teacherRealtimeStream){window.teacherRealtimeStream.close();window.teacherRealtimeStream=null}if(window.globalRealtimeStream){window.globalRealtimeStream.close();window.globalRealtimeStream=null}clearInterval(window.liveFallbackTimer);S.me=null;clearInterval(window.profileSyncTimer);S.view='students';await loadData();render();toast('Logged out')}
function googleLink(){location.href=API+'/api/auth/google/start'}async function unlinkGoogle(){try{await api('/api/auth/linked/GOOGLE',{method:'DELETE'});await loadMe()}catch(e){toast(e.message)}}
function aiModal(){modal('<div class="modalhead"><h2>✦ '+t('ai')+'</h2><button class="close" onclick="b4Close()">×</button></div><div id="aiOut" class="card">Ask a study question.</div><form class="form" onsubmit="askAI(event)"><textarea id="aiInput" rows="4" placeholder="Ask about Telecommunication..."></textarea><button class="btn primary">Send</button></form>')}
async function askAI(e){
  e.preventDefault();
  if(!S.me|| (S.me.role!=='STUDENT' && Number(S.me.is_super_admin)!==1)){toast('لازم تكون حساب B4 مفعل عشان تستخدم الـAI');return}
  const input=$('#aiInput'),out=$('#aiOut'),message=input?.value.trim();
  if(!message)return;
  try{
    out.textContent='Thinking…';
    const r=await fetch(API+'/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({message})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(d.error||`AI request failed (${r.status})`);
    out.textContent=d.answer||'No answer returned.';
  }catch(x){out.textContent='';toast(x.message)}
 }
function patchLiveCards(selector,items,renderItem){
  const root=document.querySelector(selector);
  if(!root)return;
  const nextItems=Array.isArray(items)?items:[];
  const existing=[...root.children].filter(el=>el.dataset?.liveId);
  const byId=new Map(existing.map(el=>[String(el.dataset.liveId),el]));
  const keep=new Set();
  if(!nextItems.length){
    if(existing.length===0)return;
    root.innerHTML='<div class="card empty">No items yet.</div>';
    return;
  }
  root.querySelectorAll(':scope > .empty, :scope > .card.empty').forEach(el=>el.remove());
  nextItems.forEach(item=>{
    const id=String(item.id);
    let node=byId.get(id);
    const holder=document.createElement('div');
    holder.innerHTML=String(renderItem(item)).trim();
    const next=holder.firstElementChild;
    if(!next)return;
    next.dataset.liveId=id;
    if(node){
      keep.add(id);
      if(node.outerHTML!==next.outerHTML){
        node.replaceWith(next);
        node=next;
      }
    }else{
      node=next;
      keep.add(id);
    }
    root.appendChild(node);
  });
  existing.forEach(node=>{
    if(!keep.has(String(node.dataset.liveId)))node.remove();
  });
}
function patchChatList(box,next,htmlFn){
  if(!box)return;
  const items=Array.isArray(next)?next:[];
  const existing=[...box.children];
  const byId=new Map(existing.map(el=>[String(el.dataset.messageId||''),el]).filter(([id])=>id));
  const keep=new Set();
  const unique=[];
  const seen=new Set();
  for(const message of items){
    const id=String(message?.id||'');
    if(!id||seen.has(id))continue;
    seen.add(id);
    unique.push(message);
  }
  unique.forEach(message=>{
    const id=String(message.id);
    const holder=document.createElement('div');
    holder.innerHTML=String(htmlFn(message)).trim();
    const nextNode=holder.firstElementChild;
    if(!nextNode)return;
    nextNode.dataset.messageId=id;
    let node=byId.get(id);
    if(node){
      keep.add(id);
      if(node.outerHTML!==nextNode.outerHTML){
        node.replaceWith(nextNode);
        node=nextNode;
        byId.set(id,node);
      }
    }else{
      node=nextNode;
      keep.add(id);
      byId.set(id,node);
      box.appendChild(node);
    }
  });
  existing.forEach(node=>{
    const id=String(node.dataset.messageId||'');
    if(id&&!keep.has(id))node.remove();
  });
}
function applyChatMessages(messages){
  const next=messages||[];
  const changed=JSON.stringify(next.map(m=>[m.id,m.body,m.edited_at,m.deleted_at,m.avatar_url]))!==JSON.stringify((S.messages||[]).map(m=>[m.id,m.body,m.edited_at,m.deleted_at,m.avatar_url]));
  if(!changed)return;
  S.messages=next;
  const box=$('#messages');
  if(box){
    const wasNearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<120;
    patchChatList(box,S.messages,messageHTML);
    if(wasNearBottom){
      box.scrollTop=box.scrollHeight;
      markChatSeen('messages');
    }
    setupChatJumpButton('messages','chatJumpBottom');
  }
}
function ensureRealtime(){
  if(!S.me)return;
  if(window.realtimeStream&&window.realtimeStream.readyState!==2)return;
  try{
    window.realtimeStream=new EventSource(API+'/api/chat/stream',{withCredentials:true});
    window.realtimeStream.addEventListener('open',()=>{window.realtimeOnline=true});
    window.realtimeStream.addEventListener('chat',e=>{
      try{
        const d=JSON.parse(e.data);
        if(d.type==='created'&&!S.messages.some(m=>Number(m.id)===Number(d.message.id)))applyChatMessages([...S.messages,d.message]);
        else if(d.type==='updated')applyChatMessages(S.messages.map(m=>Number(m.id)===Number(d.message.id)?d.message:m));
        else if(d.type==='deleted')applyChatMessages(S.messages.filter(m=>Number(m.id)!==Number(d.id)));
      }catch{}
    });
    window.realtimeStream.addEventListener('profile',e=>{try{applyProfileEvent(JSON.parse(e.data))}catch{}});
    window.realtimeStream.onerror=()=>{window.realtimeOnline=false};
  }catch{window.realtimeOnline=false}
}
function chatLoop(){
  clearInterval(window.chatTimer);
  clearInterval(window.chatTypingTimer);
  if(!S.me||S.view!=='chat')return;
  ensureRealtime();
  const sync=async()=>{
    if(window.realtimeOnline===true)return;
    try{
      const d=await api('/api/chat/messages?_='+Date.now(),{cache:'no-store'});
      applyChatMessages(d.messages||[]);
    }catch{}
  };
  window.chatTimer=setInterval(sync,5000);
  window.chatTypingTimer=setInterval(async()=>{
    if(S.view!=='chat')return;
    try{
      const ty=await api('/api/chat/typing');
      const el=$('#typing');
      if(el)el.textContent=(ty.users||[]).filter(x=>Number(x.user_id)!==Number(S.me.id)).map(x=>x.display_name+' is typing…').join(' • ');
    }catch{}
  },1000);
  sync();
}
async function sendChat(e){e.preventDefault();const i=$('#chatInput');if(i.dataset.sending==='1'||!i.value.trim())return;i.dataset.sending='1';const btn=e.submitter||e.target.querySelector('button');if(btn)btn.disabled=true;const body=i.value.trim(),replyToId=window.replyTo||null;try{await api('/api/chat/messages',{method:'POST',body:JSON.stringify({body,replyToId})});i.value='';i.placeholder='Write a message...';window.replyTo=null;typing(false);toast('Message sent ✓')}catch(x){toast(x.message)}finally{i.dataset.sending='0';if(btn)btn.disabled=false}}
function typing(v){if(!S.me)return;api('/api/chat/typing',{method:'POST',body:JSON.stringify({typing:v})}).catch(()=>{});if(window.typingT)clearTimeout(window.typingT);if(v)window.typingT=setTimeout(()=>typing(false),1600)}
function messageMenu(e,id){e.preventDefault();if(!S.me)return;const m=S.messages.find(x=>Number(x.id)===Number(id));if(!m)return;const own=Number(m.user_id)===Number(S.me.id),moderator=can('MANAGE_CHAT');modal('<div class="modalhead"><h2>Message</h2><button class="close" onclick="b4Close()">×</button></div><button class="btn ghost" onclick="replyMessage('+id+')">Reply</button>'+(own?'<button class="btn ghost" onclick="editMessage('+id+')">Edit</button>':'')+((own||moderator)?'<button class="btn danger" onclick="deleteMessage('+id+')">Delete</button>':'')+'<button class="btn ghost" onclick="b4Close()">Close</button>')}
function replyMessage(id){const m=S.messages.find(x=>Number(x.id)===Number(id));close();window.replyTo=id;const input=$('#chatInput');if(input){input.value='';input.placeholder='Replying to '+(m?.display_name||'message')+'…';input.focus()}toast('Reply mode enabled')}
function editMessage(id){const m=S.messages.find(x=>Number(x.id)===Number(id));if(!m)return;modal('<div class="modalhead"><h2>Edit message</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="saveMessage(event,'+id+')"><textarea id="editMsg" rows="4">'+esc(m.body)+'</textarea><button class="btn primary">Save</button></form>')}
async function saveMessage(e,id){e.preventDefault();try{await api('/api/chat/messages/'+id,{method:'PATCH',body:JSON.stringify({body:$('#editMsg').value})});close();toast('Message updated ✓')}catch(x){toast(x.message)}}
async function deleteMessage(id){if(!await confirmAction('Delete message?'))return;try{await api('/api/chat/messages/'+id,{method:'DELETE'});close();toast('Message deleted ✓')}catch(x){toast(x.message)}}
function applyTeacherMessages(messages){
  const next=messages||[];
  const changed=JSON.stringify(next.map(m=>[m.id,m.body,m.edited_at,m.deleted_at,m.avatar_url]))!==JSON.stringify((S.teacherMessages||[]).map(m=>[m.id,m.body,m.edited_at,m.deleted_at,m.avatar_url]));
  if(!changed)return;
  S.teacherMessages=next;
  const box=$('#teacherMessages');
  if(box){
    const wasNearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<120;
    patchChatList(box,S.teacherMessages,teacherMessageHTML);
    if(wasNearBottom)box.scrollTop=box.scrollHeight;
  }
}
function ensureTeacherRealtime(){if(!S.me)return;if(window.teacherRealtimeStream&&window.teacherRealtimeStream.readyState!==2)return;try{window.teacherRealtimeStream=new EventSource(API+'/api/teacher-chat/stream',{withCredentials:true});window.teacherRealtimeStream.addEventListener('open',()=>{window.teacherRealtimeOnline=true});window.teacherRealtimeStream.addEventListener('teacher-chat',e=>{try{const d=JSON.parse(e.data);if(d.type==='created'&&!S.teacherMessages.some(m=>Number(m.id)===Number(d.message.id)))applyTeacherMessages([...S.teacherMessages,d.message]);else if(d.type==='updated')applyTeacherMessages(S.teacherMessages.map(m=>Number(m.id)===Number(d.message.id)?d.message:m));else if(d.type==='deleted')applyTeacherMessages(S.teacherMessages.filter(m=>Number(m.id)!==Number(d.id)))}catch{}});window.teacherRealtimeStream.addEventListener('profile',e=>{try{applyProfileEvent(JSON.parse(e.data))}catch{}});window.teacherRealtimeStream.onerror=()=>{window.teacherRealtimeOnline=false}}catch{window.teacherRealtimeOnline=false}}
function teacherChatLoop(){
  clearInterval(window.teacherTimer);
  clearInterval(window.teacherTypingTimer);
  if(!S.me||S.view!=='teacherChat')return;
  ensureTeacherRealtime();
  const sync=async()=>{
    if(window.teacherRealtimeOnline===true)return;
    try{
      const d=await api('/api/teacher-chat/messages?_='+Date.now(),{cache:'no-store'});
      applyTeacherMessages(d.messages||[]);
    }catch{}
  };
  window.teacherTimer=setInterval(sync,5000);
  window.teacherTypingTimer=setInterval(async()=>{
    if(S.view!=='teacherChat')return;
    try{
      const ty=await api('/api/teacher-chat/typing');
      const el=$('#teacherTyping');
      if(el)el.textContent=(ty.users||[]).filter(x=>Number(x.user_id)!==Number(S.me.id)).map(x=>x.display_name+' is typing…').join(' • ');
    }catch{}
  },1000);
  sync();
}
async function sendTeacherChat(e){e.preventDefault();const i=$('#teacherInput');if(i.dataset.sending==='1'||!i.value.trim())return;i.dataset.sending='1';const btn=e.submitter||e.target.querySelector('button');if(btn)btn.disabled=true;const body=i.value.trim(),replyToId=window.teacherReplyTo||null;try{await api('/api/teacher-chat/messages',{method:'POST',body:JSON.stringify({body,replyToId})});i.value='';i.placeholder='Write a message...';window.teacherReplyTo=null;teacherTyping(false);toast('Message sent ✓')}catch(x){toast(x.message)}finally{i.dataset.sending='0';if(btn)btn.disabled=false}}
function teacherTyping(v){if(!S.me)return;api('/api/teacher-chat/typing',{method:'POST',body:JSON.stringify({typing:v})}).catch(()=>{});if(window.teacherTypingT)clearTimeout(window.teacherTypingT);if(v)window.teacherTypingT=setTimeout(()=>teacherTyping(false),1600)}
function teacherMessageMenu(e,id){e.preventDefault();if(!S.me)return;const m=S.teacherMessages.find(x=>Number(x.id)===Number(id));if(!m)return;const own=Number(m.user_id)===Number(S.me.id),moderator=can('MANAGE_TEACHER_CHAT');modal('<div class="modalhead"><h2>Message</h2><button class="close" onclick="b4Close()">×</button></div><button class="btn ghost" onclick="replyTeacherMessage('+id+')">Reply</button>'+(own?'<button class="btn ghost" onclick="editTeacherMessage('+id+')">Edit</button>':'')+((own||moderator)?'<button class="btn danger" onclick="deleteTeacherMessage('+id+')">Delete</button>':'')+'<button class="btn ghost" onclick="b4Close()">Close</button>')}
function replyTeacherMessage(id){const m=S.teacherMessages.find(x=>Number(x.id)===Number(id));close();window.teacherReplyTo=id;const input=$('#teacherInput');if(input){input.value='';input.placeholder='Replying to '+(m?.display_name||'message')+'…';input.focus()}toast('Reply mode enabled')}
function editTeacherMessage(id){const m=S.teacherMessages.find(x=>Number(x.id)===Number(id));if(!m)return;modal('<div class="modalhead"><h2>Edit message</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="saveTeacherMessage(event,'+id+')"><textarea id="editMsg" rows="4">'+esc(m.body)+'</textarea><button class="btn primary">Save</button></form>')}
async function saveTeacherMessage(e,id){e.preventDefault();try{await api('/api/teacher-chat/messages/'+id,{method:'PATCH',body:JSON.stringify({body:$('#editMsg').value})});close();toast('Message updated ✓')}catch(x){toast(x.message)}}
async function deleteTeacherMessage(id){if(!await confirmAction('Delete message?'))return;try{await api('/api/teacher-chat/messages/'+id,{method:'DELETE'});close();toast('Message deleted ✓')}catch(x){toast(x.message)}}
function teacherMessageHTML(m){
  const reply=m.reply_to_id?'<div class="reply-preview"><b>↩ '+esc(m.reply_display_name||'Reply')+'</b><span>'+esc(m.reply_body||'')+'</span></div>':'';
  const edited=m.edited_at?'<small class="edited">edited</small>':'';
  return '<div class="msg '+(S.me&&Number(m.user_id)===Number(S.me.id)?'me':'')+'" data-message-id="'+esc(m.id)+'" onclick="teacherMessageMenu(event,'+m.id+')"><img class="avatar" src="'+esc(m.avatar_url||'/assets/logo.svg')+'"><div><div class="chat-name-line"><b>'+esc(m.display_name||'Deleted user')+'</b>'+badgeHTML(m.badges,true)+'</div>'+reply+'<div class="bubble">'+esc(m.body||'')+edited+'</div><small class="muted">'+esc(chatTime(m.created_at))+'</small></div></div>';
}

async function attendanceLoad(){
  if(!can('MANAGE_ATTENDANCE'))return;
  const root=$('#attendanceRoot');
  if(!root)return;
  const date=new Date().toISOString().slice(0,10);
  try{
    const [d,a]=await Promise.all([
      api('/api/admin/attendance?date='+date),
      api('/api/attendance/analysis')
    ]);
    root.innerHTML='<div class="card"><h3>'+date+'</h3><div class="grid c3"><div class="card"><b>'+Number(d.summary?.present_count||0)+'</b><small>Present</small></div><div class="card"><b>'+Number(d.summary?.absent_count||0)+'</b><small>Absent</small></div><div class="card"><b>'+Number(d.summary?.total_count||0)+'</b><small>Marked</small></div></div><div class="attendance-analysis-head"><div><h3>Attendance Analysis</h3><p class="muted">Attendance rate for each student</p></div><span class="badge">LIVE</span></div><div class="analysis-list">'+(a.students||[]).map(s=>{
      const rate=Math.max(0,Math.min(100,Number(s.present_rate||0)));
      const tone=rate<=35?'red':rate<=50?'yellow':'green';
      return '<div class="analysis-row"><div class="analysis-person"><b>'+esc(s.display_name)+'</b><small><span>'+Number(s.present_days||0)+' present</span><span>'+Number(s.absent_days||0)+' absent</span></small></div><div class="analysis-progress"><div class="analysis-bar '+tone+'"><span style="width:'+rate+'%"></span></div><div class="analysis-scale"><span>0%</span><span>100%</span></div></div><strong class="analysis-percent '+tone+'">'+rate+'%</strong></div>';
    }).join('')+'</div><div class="list">'+d.students.map(s=>'<div class="item"><span class="grow"><b>'+esc(s.display_name)+'</b><small class="muted identity-line">'+(s.student_code?'<span class="identity-code">'+esc(s.student_code)+'</span>':'')+'</small></span><button class="btn '+(s.status==='PRESENT'?'primary':'ghost')+'" onclick="markAttendance('+s.id+',\'PRESENT\')">Present</button><button class="btn '+(s.status==='ABSENT'?'danger':'ghost')+'" onclick="markAttendance('+s.id+',\'ABSENT\')">Absent</button></div>').join('')+'</div></div>';
  }catch(e){
    root.innerHTML='<div class="card notice">'+esc(e.message)+'</div>';
  }
}
async function markAttendance(id,status){try{await api('/api/admin/attendance',{method:'POST',body:JSON.stringify({userId:id,status,date:new Date().toISOString().slice(0,10)})});attendanceLoad();toast(status)}catch(e){toast(e.message)}}
function adminLoad(p){if(p==='roles')loadRoles();if(p==='permissions')loadPermissions();if(p==='accounts')loadAccounts();if(p==='keys')loadKeys();if(p==='badges')loadBadges();if(p==='admins')loadAdmins();if(p==='logs')loadLogs();if(p==='site')loadSiteManagement();if(p==='developers')loadDevelopers()}
async function loadSiteManagement(){
  const r=$('#adminRoot');
  if(!r)return;
  r.innerHTML='<div class="card notice">Loading site status…</div>';
  try{
    const d=await api('/api/admin/site');
    const site=d.site||{};
    const locked=Number(site.is_locked)===1;
    r.innerHTML='<div class="site-control-card '+(locked?'is-locked':'is-open')+'">'+
      '<div class="site-control-status"><div class="site-lock-icon '+(locked?'locked':'open')+'">'+(locked?'🔒':'🔓')+'</div><div><span class="eyebrow">SITE STATUS</span><h2>'+ (locked?'Site is Locked':'Site is Open') +'</h2><p class="muted">'+(locked?'Visitors are blocked. Super Admin access remains available.':'The website is currently available to everyone.')+'</p></div></div>'+
      (locked?'<div class="site-lock-message"><small>Visitor message</small><p>'+esc(site.lock_message||'')+'</p></div>':'')+
      '<div class="site-control-actions">'+
        '<button type="button" class="btn site-lock-btn" onclick="siteLockModal()"><span>🔒</span> Lock</button>'+
        '<button type="button" class="btn danger site-open-btn" onclick="openSite()"> <span>🔓</span> Open</button>'+
      '</div>'+
      '</div>';
    const lockBtn=r.querySelector('.site-lock-btn'),openBtn=r.querySelector('.site-open-btn');
    if(locked){lockBtn.disabled=true;lockBtn.classList.add('disabled');}else{openBtn.disabled=true;openBtn.classList.add('disabled');}
  }catch(e){r.innerHTML='<div class="card notice">'+esc(e.message)+'</div>'}
}
function siteLockModal(){
  modal('<div class="site-lock-modal"><div class="modalhead"><div><span class="eyebrow">MANAGE SITE</span><h2>Lock Site</h2></div><button class="close" onclick="b4Close()">×</button></div><p class="muted">Write the message visitors will see while the site is locked. The site will remain fully open for your Super Admin account.</p><form class="form" onsubmit="saveSiteLock(event)"><label>Lock message<textarea id="siteLockMessage" rows="6" maxlength="2000" required placeholder="The site is temporarily unavailable. Please try again later."></textarea></label><button class="btn site-lock-btn" type="submit">🔒 Save</button></form></div>');
}
async function saveSiteLock(e){
  e.preventDefault();
  const message=$('#siteLockMessage')?.value.trim()||'';
  if(!message)return;
  try{
    await api('/api/admin/site',{method:'PATCH',body:JSON.stringify({locked:true,message})});
    close();
    toast('Site locked ✓');
    if(S.view==='admin:site')loadSiteManagement();
  }catch(x){toast(x.message)}
}
async function openSite(){
  try{
    await api('/api/admin/site',{method:'PATCH',body:JSON.stringify({locked:false,message:''})});
    toast('Site opened ✓');
    if(S.view==='admin:site')loadSiteManagement();
  }catch(x){toast(x.message)}
}
async function loadRoles(){
  const r=$('#adminRoot');
  try{
    const d=await api('/api/admin/users');S.users=d.users||[];
    r.innerHTML='<div class="grid c2">'+S.users.map(u=>{
      const linked=u.role==='TEACHER'?(u.teacher_code||'Not linked'):(u.student_code||'Not linked');
      const options='<option value="STUDENT" '+(u.role==='STUDENT'?'selected':'')+'>STUDENT</option><option value="TEACHER" '+(u.role==='TEACHER'?'selected':'')+'>TEACHER</option>';
      const systemBadge=Number(u.is_super_admin)===1?'<span class="badge super-badge">SUPER ADMIN • SYSTEM</span>':'';
      const roleBadge='<span class="badge">'+esc(u.role)+'</span>';
      const linkAction=Number(u.is_super_admin)===1?'<button class="btn ghost" onclick="identityEdit('+u.id+')">Set class identity</button>':'<label>Account role<select onchange="changeRole('+u.id+',this.value)">'+options+'</select></label>';
      return '<div class="card role-card"><div class="head"><div><b>'+esc(u.display_name)+'</b><p class="muted">'+esc(u.official_name||'')+'</p></div><div class="badges">'+systemBadge+roleBadge+'</div></div><div class="role-meta"><span><small>Class identity</small><b>'+esc(linked)+'</b></span><span><small>System access</small><b>'+ (Number(u.is_super_admin)===1?'Super Admin':'Standard') +'</b></span></div>'+ (Number(u.is_super_admin)===1?'<div class="notice">Super Admin is not a role. This account keeps its Student/Teacher class identity while having full system access.</div>':'')+linkAction+'</div>';
    }).join('')+'</div>';
  }catch(e){r.innerHTML='<div class="card notice">'+esc(e.message)+'</div>'}
}
async function loadPermissions(){
  const r=$('#adminRoot');
  try{const d=await api('/api/admin/users');S.users=d.users||[];
    r.innerHTML='<div class="grid c2">'+S.users.map(u=>{
      const superAdmin=Number(u.is_super_admin)===1, administrator=(u.direct_permissions||[]).includes('ADMINISTRATOR');
      return '<div class="card permission-user" data-user-id="'+u.id+'"><div class="head"><div><b>'+esc(u.display_name)+'</b><p class="muted identity-line">'+((u.student_code||u.teacher_code)?'<span class="identity-code">'+esc(u.student_code||u.teacher_code)+'</span>':'')+' <span>'+esc(u.role)+'</span></p></div><span class="badge">'+(superAdmin?'SUPER ADMIN':(administrator?'ADMINISTRATOR':((u.direct_permissions||[]).length||0)+' direct'))+'</span></div><div class="permission-grid">'+PERMS.map(p=>'<label class="permission-tile '+(((u.direct_permissions||[]).includes(p[0])||superAdmin)?'is-on':'')+'"><input type="checkbox" class="permission-checkbox" data-perm="'+p[0]+'" '+(((u.direct_permissions||[]).includes(p[0])||superAdmin)?'checked':'')+' '+(superAdmin?'disabled':'')+'><span>'+p[1]+'</span></label>').join('')+'</div>'+(superAdmin?'<div class="notice">Super Admin has every permission automatically.</div>':'<button class="btn primary" onclick="savePermissions('+u.id+')">Save permissions</button>')+'</div>';
    }).join('')+'</div>';
  }catch(e){r.innerHTML='<div class="card notice">'+esc(e.message)+'</div>'}
}
function identityEdit(id){
  const u=S.users.find(x=>Number(x.id)===Number(id))||{};
  const studentOpts='<option value="">Choose student</option>'+S.students.map(x=>'<option value="'+x.id+'" '+(Number(x.id)===Number(u.student_id)?'selected':'')+'>'+esc(x.display_name)+' • '+esc(x.student_code||'')+'</option>').join('');
  const teacherOpts='<option value="">Choose teacher</option>'+S.teachers.map(x=>'<option value="'+x.id+'" '+(Number(x.id)===Number(u.teacher_id)?'selected':'')+'>'+esc(x.display_name)+' • '+esc(x.teacher_code||'')+'</option>').join('');
  modal('<div class="modalhead"><h2>Class identity</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="saveIdentity(event,'+id+')"><label>Identity type<select id="identityType" onchange="document.querySelectorAll(\'.identity-select\').forEach(x=>x.hidden=x.dataset.type!==this.value)"><option value="STUDENT" '+(u.student_id?'selected':'')+'>Student</option><option value="TEACHER" '+(u.teacher_id?'selected':'')+'>Teacher</option><option value="NONE" '+(!u.student_id&&!u.teacher_id?'selected':'')+'>No class identity</option></select></label><select id="studentIdentity" class="identity-select" data-type="STUDENT" '+(u.student_id?'':'hidden')+'>'+studentOpts+'</select><select id="teacherIdentity" class="identity-select" data-type="TEACHER" '+(u.teacher_id?'':'hidden')+'>'+teacherOpts+'</select><button class="btn primary">Save identity</button></form>')
}
async function saveIdentity(e,id){
  e.preventDefault();
  const type=$('#identityType').value, identityId=type==='STUDENT'?Number($('#studentIdentity').value):type==='TEACHER'?Number($('#teacherIdentity').value):null;
  try{await api('/api/admin/users/'+id+'/identity',{method:'PATCH',body:JSON.stringify({type,identityId})});close();await loadMe();await loadRoles();toast('Class identity updated ✓')}catch(e){toast(e.message)}
}
async function changeRole(id,role){
  const user=S.users.find(u=>Number(u.id)===Number(id));if(!user)return;
  if(role==='TEACHER'){
    const opts=S.teachers.map(x=>'<option value="'+x.id+'" '+(Number(x.id)===Number(user.teacher_id)?'selected':'')+'>'+esc(x.display_name)+' • '+esc(x.teacher_code||'')+'</option>').join('');
    modal('<div class="modalhead"><h2>Link Teacher Profile</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="saveRoleLink(event,'+id+',\'TEACHER\')"><p class="muted">Choose the teacher profile this account represents.</p><select id="roleLink">'+opts+'</select><button class="btn primary">Save Teacher role</button></form>');
  }else{
    const opts=S.students.map(x=>'<option value="'+x.id+'" '+(Number(x.id)===Number(user.student_id)?'selected':'')+'>'+esc(x.display_name)+' • '+esc(x.student_code||'')+'</option>').join('');
    modal('<div class="modalhead"><h2>Link Student Profile</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="saveRoleLink(event,'+id+',\'STUDENT\')"><p class="muted">Choose the student profile this account represents.</p><select id="roleLink">'+opts+'</select><button class="btn primary">Save Student role</button></form>');
  }
}
async function saveRoleLink(e,id,role){
  e.preventDefault();
  const linkId=Number($('#roleLink').value);
  try{
    const body=role==='TEACHER'?{role,teacherId:linkId}:{role,studentId:linkId};
    await api('/api/admin/users/'+id+'/role',{method:'PATCH',body:JSON.stringify(body)});
    close();await loadMe();await loadRoles();toast('Role and profile link updated ✓');
  }catch(e){toast(e.message)}
}
async function savePermissions(id){try{const card=[...document.querySelectorAll('.permission-user')].find(x=>x.dataset.userId===String(id));const codes=card?[...card.querySelectorAll('[data-perm]:checked')].map(x=>x.dataset.perm):[];await api('/api/admin/users/'+id+'/permissions',{method:'PUT',body:JSON.stringify({permissionCodes:codes})});toast('Permissions saved ✓');loadPermissions()}catch(e){toast(e.message)}}
async function loadAccounts(){
  const r=$('#adminRoot');
  try{
    const d=await api('/api/admin/accounts');
    r.innerHTML=`<div class="tablewrap"><table class="table"><thead><tr><th>Name</th><th>Role</th><th>Activation</th><th>Google</th><th>Session</th><th>Actions</th></tr></thead><tbody>
      ${(d.accounts||[]).map(a=>`<tr><td>${esc(a.display_name)}</td><td>${esc(a.role)}</td><td>${(a.activation_key_preview||a.identity_code)?'<span class="identity-code">'+esc(a.activation_key_preview||a.identity_code)+'</span>':'<span class="identity-code empty-code">—</span>'}</td><td>${a.google_linked?'<div><span class="badge">✓ Google Linked</span>'+(a.google_email?'<small class="muted account-google-email">'+esc(a.google_email)+'</small>':'')+'</div>':'<span class="muted">Not linked</span>'}</td><td>${esc(a.status)}</td><td><button class="btn ghost" onclick="resetAccount(${a.id})">Reset password</button><button class="btn ghost" onclick="endSession(${a.id})">End session</button><button class="btn danger" onclick="deleteAccount(${a.id})">Delete</button></td></tr>`).join('')}
    </tbody></table></div>`;
  }catch(e){r.innerHTML='<div class="card notice">'+esc(e.message)+'</div>'}
}
async function deleteAccount(id){
  if(!await confirmAction('Delete this account permanently?'))return;
  try{await api('/api/admin/accounts/'+id,{method:'DELETE'});await loadData();loadAccounts();toast('Account deleted ✓')}catch(e){toast(e.message)}
}
async function resetAccount(id){try{const d=await api('/api/admin/accounts/'+id+'/reset-password',{method:'POST'});modal('<div class="modalhead"><h2>Temporary password</h2><button class="close" onclick="b4Close()">×</button></div><div class="notice"><b>'+esc(d.tempPassword)+'</b></div><p class="muted">Give it to the account owner and ask them to change it.</p>')}catch(e){toast(e.message)}}
async function endSession(id){try{await api('/api/admin/accounts/'+id+'/end-session',{method:'POST'});toast('Session ended ✓')}catch(e){toast(e.message)}}
async function loadKeys(){
  const r=$('#adminRoot');
  try{
    const d=await api('/api/admin/activation-keys');
    r.innerHTML=`<div class="keys-toolbar"><div><div class="eyebrow">ACCESS CONTROL</div><h3>Activation keys</h3><p class="muted">Create, copy and revoke B4 access keys.</p></div><button class="btn primary" onclick="createKey()">＋ Generate key</button></div>
      <div class="keys-list">${(d.keys||[]).map((k,i)=>`<article class="key-card" style="--i:${i}">
        <div class="key-icon">⌁</div>
        <div class="key-main">
          <div class="key-top"><span class="key-label">ACTIVATION KEY</span><span class="badge ${String(k.status||'').toUpperCase()==='ACTIVE'?'good':String(k.status||'').toUpperCase()==='REVOKED'?'red':''}">${esc(k.status)}</span></div>
          <div class="key-value mono">${esc(k.key_value||k.key_preview)}</div>
          <div class="key-person"><span>♙</span><b>${esc(k.person_name||'Unassigned')}</b><small>${esc(k.person_type||'')}</small></div>
        </div>
        <div class="key-actions">${k.key_value?`<button type="button" class="btn ghost key-copy" data-key-id="${esc(String(k.id))}">Copy</button>`:''}${k.status==='ACTIVE'?`<button type="button" class="btn key-revoke key-revoke-action" data-key-id="${esc(String(k.id))}">Revoke</button>`:''}</div>
      </article>`).join('')||'<div class="card empty">No activation keys yet.</div>'}</div>`;
  }catch(e){r.innerHTML='<div class="card notice">'+esc(e.message)+'</div>'}
  r.querySelectorAll('.key-copy').forEach(btn=>btn.addEventListener('click',()=>copyKey(btn.dataset.keyId)));
  r.querySelectorAll('.key-revoke-action').forEach(btn=>btn.addEventListener('click',()=>revokeKey(btn.dataset.keyId)));
  r.querySelectorAll('.key-delete').forEach(btn=>btn.addEventListener('click',()=>deleteKey(btn.dataset.keyId)));
}
async function copyKey(id){
  try{const d=await api('/api/admin/activation-keys');const k=(d.keys||[]).find(x=>Number(x.id)===Number(id));if(!k?.key_value)return toast('This older key cannot be recovered');await navigator.clipboard.writeText(k.key_value);toast('Activation key copied ✓')}catch(e){toast(e.message)}
}
async function revokeKey(id){
  if(!await confirmAction('Revoke this activation key?'))return;
  try{await api('/api/admin/activation-keys/'+id+'/revoke',{method:'POST'});loadKeys();toast('Key revoked ✓')}catch(e){toast(e.message)}
}
async function deleteKey(id){
  if(!await confirmAction('Delete this activation key permanently? This cannot be undone.'))return;
  try{await api('/api/admin/activation-keys/'+id+'/delete',{method:'POST'});loadKeys();toast('Key deleted ✓')}catch(e){toast(e.message)}
}
async function createKey(){try{const d=await api('/api/admin/people');const opts=[...d.students.map(x=>'<option value="STUDENT:'+x.id+'">'+esc(x.display_name)+'</option>'),...d.teachers.map(x=>'<option value="TEACHER:'+x.id+'">'+esc(x.display_name)+'</option>')].join('');modal('<div class="modalhead"><h2>Generate activation key</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="makeKey(event)"><select id="keyPerson">'+opts+'</select><button class="btn primary">Generate</button></form>')}catch(e){toast(e.message)}}
async function makeKey(e){e.preventDefault();const [personType,personId]=$('#keyPerson').value.split(':');try{const d=await api('/api/admin/activation-keys',{method:'POST',body:JSON.stringify({personType,personId:Number(personId)})});close();await navigator.clipboard?.writeText(d.key);modal('<div class="modalhead"><h2>Activation key</h2><button class="close" onclick="b4Close()">×</button></div><div class="notice mono">'+esc(d.key)+'</div>')}catch(x){toast(x.message)}}
async function loadBadges(){const r=$('#adminRoot');try{const d=await api('/api/admin/badges');S.badges=d.badges||[];r.innerHTML='<button class="btn primary" onclick="badgeCreate()">＋ Add badge</button><div class="grid c3">'+d.badges.map(b=>'<article class="card"><img class="avatar" src="/api/badges/'+b.id+'/icon"><h3>'+esc(b.name)+'</h3><p>'+esc(b.description||'')+'</p><div class="actions-row"><button class="btn ghost" onclick="badgeEdit('+b.id+')">Edit</button><button class="btn primary" onclick="badgeAssign('+b.id+')">Assign</button><button class="btn ghost" onclick="badgeRemove('+b.id+')">Remove From</button><button class="btn danger" onclick="badgeDelete('+b.id+')">Delete</button></div></article>').join('')+'</div>'}catch(e){r.innerHTML='<div class="card notice">'+esc(e.message)+'</div>'}}
function badgeEdit(id){
  const b=(S.badges||[]).find(x=>Number(x.id)===Number(id))||{};
  modal('<div class="modalhead"><h2>Edit badge</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="saveBadge(event,'+Number(id)+')"><label>Badge name<input id="editBadgeName" value="'+esc(b.name||'')+'" required></label><label>Description<input id="editBadgeDesc" value="'+esc(b.description||'')+'" placeholder="Description"></label><label>Icon <span class="muted">(optional)</span><input id="editBadgeIcon" type="file" accept="image/*"></label><button class="btn primary">Save badge</button></form>');
}
async function saveBadge(e,id){
  e.preventDefault();
  try{
    await api('/api/admin/badges/'+id,{method:'PATCH',body:JSON.stringify({name:$('#editBadgeName').value.trim(),description:$('#editBadgeDesc').value.trim()})});
    const f=$('#editBadgeIcon').files?.[0];
    if(f){const fd=new FormData();fd.append('file',f);const rr=await fetch(API+'/api/admin/badges/'+id+'/icon',{method:'POST',credentials:'include',body:fd});if(!rr.ok)throw Error('Badge icon upload failed')}
    close();toast('Badge updated ✓');loadBadges();
  }catch(x){toast(x.message)}
}
function badgeCreate(){modal('<div class="modalhead"><h2>New badge</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="makeBadge(event)"><input id="badgeName" placeholder="Badge name" required><input id="badgeDesc" placeholder="Description"><input id="badgeIcon" type="file" accept="image/*"><button class="btn primary">Create</button></form>')}
async function makeBadge(e){e.preventDefault();try{const d=await api('/api/admin/badges',{method:'POST',body:JSON.stringify({name:$('#badgeName').value,description:$('#badgeDesc').value})});const f=$('#badgeIcon').files[0];if(f){const fd=new FormData();fd.append('file',f);await fetch(API+'/api/admin/badges/'+d.id+'/icon',{method:'POST',credentials:'include',body:fd})}close();loadBadges()}catch(x){toast(x.message)}}
async function badgeAssign(bid){const d=await api('/api/admin/badges');const opts=d.people.map(p=>'<option value="'+p.id+'">'+esc(p.display_name)+' • '+p.role+'</option>').join('');modal('<div class="modalhead"><h2>Assign badge</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="doBadgeAssign(event,'+bid+')"><select id="badgeUser">'+opts+'</select><button class="btn primary">Assign</button></form>')}
async function badgeRemove(bid){
  const d=await api('/api/admin/badges');
  const assigned=(d.people||[]).filter(p=>Number(p.badge_id)===Number(bid));
  if(!assigned.length){toast('No one has this badge');return}
  const rows=assigned.map(p=>'<div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px"><div><b>'+esc(p.display_name)+'</b><div class="muted">'+esc(p.role||'')+'</div></div><button class="btn danger" onclick="removeBadgeFromUser('+p.id+','+bid+')">Remove From</button></div>').join('');
  modal('<div class="modalhead"><h2>Remove From</h2><button class="close" onclick="b4Close()">×</button></div><div class="form">'+rows+'</div>');
}
async function removeBadgeFromUser(uid,bid){
  try{
    await api('/api/admin/badges/assign',{method:'DELETE',body:JSON.stringify({userId:Number(uid),badgeId:Number(bid)})});
    toast('Badge removed ✓');
    badgeRemove(bid);
  }catch(e){toast(e.message)}
}
async function badgeDelete(bid){
  if(!confirm('Delete this badge? It will also be removed from everyone who has it.'))return;
  try{
    await api('/api/admin/badges/'+bid,{method:'DELETE'});
    toast('Badge deleted ✓');
    loadBadges();
  }catch(e){toast(e.message)}
}
async function doBadgeAssign(e,bid){e.preventDefault();try{await api('/api/admin/badges/assign',{method:'POST',body:JSON.stringify({userId:Number($('#badgeUser').value),badgeId:bid})});close();toast('Badge assigned ✓')}catch(x){toast(x.message)}}
async function loadAdmins(){const r=$('#adminRoot');const d=await api('/api/admin/users');r.innerHTML='<div class="grid c2">'+d.users.filter(u=>Number(u.is_super_admin)!==1).map(u=>'<div class="card"><b>'+esc(u.display_name)+'</b><p class="muted">'+esc(u.role)+'</p><button class="btn primary" onclick="adminPermissions('+u.id+')">Manage admin access</button></div>').join('')+'</div><button class="btn ghost" onclick="adminPermissions()">Grant to a person</button>'}
async function adminPermissions(id){const d=await api('/api/admin/users');const opts=d.users.filter(u=>Number(u.is_super_admin)!==1).map(u=>'<option value="'+u.id+'">'+esc(u.display_name)+' • '+u.role+'</option>').join('');modal('<div class="modalhead"><h2>Admin access</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="grantAdmin(event)"><select id="adminUser">'+opts+'</select><div class="permission-grid">'+PERMS.map(p=>'<label class="permission-tile"><input type="checkbox" name="ap" value="'+p[0]+'"><span>'+p[1]+'</span></label>').join('')+'</div><button class="btn primary">Save admin permissions</button></form>')}
async function grantAdmin(e){e.preventDefault();const id=Number($('#adminUser').value),codes=[...document.querySelectorAll('input[name="ap"]:checked')].map(x=>x.value);try{await api('/api/admin/users/'+id+'/permissions',{method:'PUT',body:JSON.stringify({permissionCodes:codes})});close();toast('Admin access saved ✓')}catch(x){toast(x.message)}}
async function loadLogs(){const r=$('#adminRoot');try{const d=await api('/api/admin/logs');const rows=[...(d.activity||[]).map(x=>({...x,kind:'activity'})),...(d.security||[]).map(x=>({...x,kind:'security'}))].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));const icon=x=>x.kind==='security'?'⚿':/DELETE|REMOVED|FAILED|DENIED/i.test(x.action||'')?'✕':/CREATE|ADD|ACTIV/i.test(x.action||'')?'＋':/UPDATE|EDIT|CHANGED/i.test(x.action||'')?'✦':'•';const detail=x=>{let d=x.details;try{if(typeof d==='string')d=JSON.parse(d)}catch{}if(!d||typeof d!=='object')return '';return Object.entries(d).slice(0,4).map(([k,v])=>k+': '+String(v)).join(' • ')};r.innerHTML='<div class="logs-toolbar"><div><b>'+rows.length+'</b> events</div><span class="muted">Activity + security</span></div><div class="log-list">'+(rows.map((x,i)=>'<article class="log-row" style="--i:'+i+'"><span class="log-icon">'+icon(x)+'</span><div class="grow"><div class="log-top"><b>'+esc(x.action||'EVENT')+'</b><span class="log-kind '+x.kind+'">'+x.kind+'</span></div><small class="muted">'+esc(x.actor_name||'System')+' · '+esc(x.created_at||'')+'</small>'+(detail(x)?'<div class="log-detail">'+esc(detail(x))+'</div>':'')+'</div></article>').join('')||'<div class="empty">No activity yet.</div>')+'</div>'}catch(e){r.innerHTML='<div class="card notice">'+esc(e.message)+'</div>'}}
async function loadDevelopers(){
  const r=$('#adminRoot');
  if(!r)return;
  r.innerHTML='<div class="card notice">Loading developers…</div>';
  api('/api/admin/developers').then(d=>{
    S.developers=d.developers||[];
    r.innerHTML=`<div class="head"><div><h3>Developers</h3><p class="muted">Title, name, photo, profile link and custom information.</p></div><button class="btn primary" onclick="developerEdit()">＋ Add developer</button></div>
      <div class="grid developers-grid">${S.developers.map(x=>`<article class="card developer-card"><img class="avatar xl" src="${esc(x.avatar_url||'/assets/logo.svg')}" onerror="this.src='/assets/logo.svg'"><div class="developer-info">${x.title?`<span class="developer-title">${esc(x.title)}</span>`:''}${x.title2?`<span class="developer-title">${esc(x.title2)}</span>`:''}<h3>${esc(x.name)}</h3>${x.link_url?`<a class="btn ghost developer-link" href="${esc(x.link_url)}" target="_blank" rel="noopener">Open link ↗</a>`:''}<div class="actions-row"><button class="btn ghost" onclick="developerEdit(${x.id})">Edit</button><button class="btn danger" onclick="developerDelete(${x.id})">Delete</button></div></div></article>`).join('')||'<div class="card empty">No developers yet.</div>'}</div>`;
  }).catch(e=>r.innerHTML='<div class="card notice">'+esc(e.message)+'</div>')
}
function developerEdit(id){
  const x=(S.developers||[]).find(d=>Number(d.id)===Number(id))||{};
  modal('<div class="modalhead"><h2>'+(id?'Edit':'Add')+' developer</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="saveDeveloper(event,'+(id||'null')+')"><label>Title / Role<input id="devTitle" value="'+esc(x.title||'')+'" placeholder="Main Dev"></label><label>Title / Role 2<input id="devTitle2" value="'+esc(x.title2||'')+'" placeholder="Frontend Developer"></label><label>Name<input id="devName" value="'+esc(x.name||'')+'" placeholder="KAREEM" required></label><label>Profile / Discord / GitHub link<input id="devLink" type="url" value="'+esc(x.link_url||'')+'" placeholder="https://..."></label><label>Photo<input id="devAvatar" type="file" accept="image/*"></label><button class="btn primary">Save developer</button></form>')
}
async function saveDeveloper(e,id){
  e.preventDefault();
  try{
    const d=await api(id?'/api/admin/developers/'+id:'/api/admin/developers',{method:id?'PATCH':'POST',body:JSON.stringify({title:$('#devTitle').value.trim(),title2:$('#devTitle2').value.trim(),name:$('#devName').value.trim(),linkUrl:$('#devLink').value.trim()})});
    const f=$('#devAvatar').files?.[0];
    if(f){const fd=new FormData();fd.append('file',f);const rr=await fetch(API+'/api/admin/developers/'+(id||d.id)+'/avatar',{method:'POST',credentials:'include',body:fd});if(!rr.ok)throw Error('Developer image upload failed')}
    close();loadDevelopers()
  }catch(e){toast(e.message)}
}
async function developerDelete(id){if(await confirmAction('Delete developer?')){await api('/api/admin/developers/'+id,{method:'DELETE'});loadDevelopers()}}
function studentEdit(id){const x=(S.students||[]).find(s=>Number(s.id)===Number(id))||{};modal('<div class="modalhead"><h2>'+ (id?'Edit student':'Add student')+'</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="saveStudent(event,'+(id||'null')+')"><input id="sc" value="'+esc(x.student_code||'')+'" placeholder="Student code" required><input id="so" value="'+esc(x.official_name||'')+'" placeholder="Official name" required><input id="sd" value="'+esc(x.display_name||'')+'" placeholder="Display name" required><input id="sa" type="file" accept="image/*"><button class="btn primary">Save</button></form>')}
async function saveStudent(e,id){e.preventDefault();try{let d;if(id)d=await api('/api/admin/students/'+id,{method:'PATCH',body:JSON.stringify({studentCode:$('#sc').value,officialName:$('#so').value,displayName:$('#sd').value})});else d=await api('/api/admin/students',{method:'POST',body:JSON.stringify({studentCode:$('#sc').value,officialName:$('#so').value,displayName:$('#sd').value})});const f=$('#sa').files[0];if(f){const fd=new FormData();fd.append('file',f);await fetch(API+'/api/admin/students/'+(id||d.id)+'/avatar',{method:'POST',credentials:'include',body:fd})}close();await loadData();render()}catch(x){toast(x.message)}}
function teacherEdit(id){const x=(S.teachers||[]).find(s=>Number(s.id)===Number(id))||{};modal('<div class="modalhead"><h2>'+ (id?'Edit teacher':'Add teacher')+'</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="saveTeacher(event,'+(id||'null')+')"><input id="tc" value="'+esc(x.teacher_code||'')+'" placeholder="Teacher code" required><input id="to" value="'+esc(x.official_name||'')+'" placeholder="Official name" required><input id="td" value="'+esc(x.display_name||'')+'" placeholder="Display name" required><input id="ta" type="file" accept="image/*"><button class="btn primary">Save</button></form>')}
async function saveTeacher(e,id){e.preventDefault();try{let d;if(id)d=await api('/api/admin/teachers/'+id,{method:'PATCH',body:JSON.stringify({teacherCode:$('#tc').value,officialName:$('#to').value,displayName:$('#td').value})});else d=await api('/api/admin/teachers',{method:'POST',body:JSON.stringify({teacherCode:$('#tc').value,officialName:$('#to').value,displayName:$('#td').value})});const f=$('#ta').files[0];if(f){const fd=new FormData();fd.append('file',f);await fetch(API+'/api/admin/teachers/'+(id||d.id)+'/avatar',{method:'POST',credentials:'include',body:fd})}close();await loadData();render()}catch(x){toast(x.message)}}
async function studentDelete(id){if(!await confirmAction('Delete student?'))return;try{await api('/api/admin/students/'+id,{method:'DELETE'});await loadData();render()}catch(e){toast(e.message)}}
async function teacherDelete(id){if(!await confirmAction('Delete teacher?'))return;await api('/api/admin/teachers/'+id,{method:'DELETE'});await loadData();render()}
function subjectEdit(id){const x=S.subjects.find(s=>Number(s.id)===Number(id))||{};modal('<div class="modalhead"><h2>Subject</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="saveSubject(event,'+(id||'null')+')"><input id="sn" value="'+esc(x.name||'')+'" placeholder="Subject name" required><input id="st" value="'+esc(x.teacher_name||'')+'" placeholder="Teacher"><button class="btn primary">Save</button></form>')}
async function saveSubject(e,id){e.preventDefault();try{await api(id?'/api/admin/subjects/'+id:'/api/admin/subjects',{method:id?'PATCH':'POST',body:JSON.stringify({name:$('#sn').value,teacherName:$('#st').value})});close();await loadData();render()}catch(x){toast(x.message)}}
async function subjectDelete(id){if(await confirmAction('Delete subject?')){await api('/api/admin/subjects/'+id,{method:'DELETE'});await loadData();render()}}
function scheduleEdit(){let rows=S.schedule.length?S.schedule: [1,2,3,4,5].map(i=>({day_name:'Day '+i}));modal('<div class="modalhead"><h2>Schedule</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="saveSchedule(event)">'+rows.map((r,i)=>'<div class="schedule-row"><input id="d'+i+'" value="'+esc(r.day_name||'')+'"><input id="p1'+i+'" value="'+esc(r.p1||'')+'"><input id="p2'+i+'" value="'+esc(r.p2||'')+'"><input id="p3'+i+'" value="'+esc(r.p3||'')+'"><input id="p4'+i+'" value="'+esc(r.p4||'')+'"></div>').join('')+'<button class="btn primary">Save schedule</button></form>')}
async function saveSchedule(e){e.preventDefault();const rows=[...document.querySelectorAll('.schedule-row')].map((r,i)=>({day_name:$('#d'+i).value,p1:$('#p1'+i).value,p2:$('#p2'+i).value,p3:$('#p3'+i).value,p4:$('#p4'+i).value}));try{await api('/api/admin/schedule',{method:'PUT',body:JSON.stringify({schedule:rows})});close();await loadData();render()}catch(x){toast(x.message)}}

async function resourceEdit(id){
  const x=S.resources.find(a=>Number(a.id)===Number(id))||{};
  modal('<div class="modalhead"><h2>'+(id?'Edit resource':'New resource')+'</h2><button class="close" onclick="b4Close()">×</button></div>'+
    '<form class="form" onsubmit="saveResource(event,'+(id||'null')+')">'+
    '<label>Title<input id="rt" value="'+esc(x.title||'')+'" placeholder="Resource title" required></label>'+
    '<label>Subject<select id="rs">'+S.subjects.map(s=>'<option value="'+s.id+'" '+(Number(s.id)===Number(x.subject_id)?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select></label>'+
    '<label>Description<textarea id="rd" rows="3">'+esc(x.description||'')+'</textarea></label>'+
    '<label>Link (optional)<input id="ru" value="'+esc(x.url||'')+'" placeholder="https://..."></label>'+
    '<label>PDF (optional)<input id="rf" type="file" accept="application/pdf"><small class="muted">PDF files up to 20 MB.</small></label>'+
    (x.filename?'<div class="notice">Current PDF: '+esc(x.filename)+'</div>':'')+
    '<button class="btn primary">'+(id?'Save changes':'Publish resource')+'</button></form>');
}
async function saveResource(e,id){
  e.preventDefault();
  const file=$('#rf')?.files?.[0];
  if(file){
    if(file.type!=='application/pdf')return toast('Please select a PDF file');
    if(file.size>20*1024*1024)return toast('PDF is too large — maximum size is 20 MB');
  }
  try{
    const title=String($('#rt')?.value||'').trim();
    const description=String($('#rd')?.value||'').trim();
    const subjectId=Number($('#rs')?.value)||null;
    const url=String($('#ru')?.value||'').trim();
    if(!title)return toast('Resource title is required');
    if(url&&!/^https?:\/\//i.test(url))return toast('Link must start with http:// or https://');

    if(!id){
      // New resources (link, note, PDF, or link + PDF) use one optional-file request.
      // This avoids sending a link/note through the PDF-only endpoint.
      const fd=new FormData();
      fd.append('title',title);
      fd.append('description',description);
      fd.append('url',url);
      if(subjectId)fd.append('subjectId',String(subjectId));
      if(file)fd.append('file',file);
      const rr=await fetch(API+'/api/admin/resources/publish',{method:'POST',credentials:'include',body:fd});
      let d={};try{d=await rr.json()}catch{}
      if(!rr.ok)throw Error(d.error||('Could not publish resource ('+rr.status+')'));
    }else{
      const resourceType=file?'FILE':(url?'LINK':'NOTE');
      const d=await api('/api/admin/resources/'+id,{
        method:'PATCH',
        body:JSON.stringify({title,description,url:url||'',subjectId,resourceType})
      });
      if(file){
        const fd=new FormData();
        fd.append('file',file);
        const rr=await fetch(API+'/api/admin/resources/'+id+'/pdf',{method:'POST',credentials:'include',body:fd});
        let out={};try{out=await rr.json()}catch{}
        if(!rr.ok)throw Error(out.error||('PDF upload failed ('+rr.status+')'));
      }
    }
    close();await loadData();render();toast('Resource published ✓');
  }catch(x){toast(x.message||'Resource upload failed')}
}
function announcementEdit(id){const x=S.announcements.find(a=>Number(a.id)===Number(id))||{};modal('<div class="modalhead"><h2>Announcement</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="saveAnnouncement(event,'+(id||'null')+')"><input id="nt" value="'+esc(x.title||'')+'" placeholder="Title" required><input id="nc" value="'+esc(x.category||'General')+'" placeholder="Category"><textarea id="nb" required>'+esc(x.body||'')+'</textarea><button class="btn primary">Publish</button></form>')}
async function saveAnnouncement(e,id){e.preventDefault();try{await api(id?'/api/admin/announcements/'+id:'/api/admin/announcements',{method:id?'PATCH':'POST',body:JSON.stringify({title:$('#nt').value,category:$('#nc').value,body:$('#nb').value})});close();await loadData();render()}catch(x){toast(x.message)}}
let examDraft=[];
function examInputDate(v){return v?String(v).replace(' ','T').slice(0,16):''}
function examDraftFromQuestion(q){return {questionText:q?.question_text||'',questionType:q?.question_type||'MCQ',options:Array.isArray(q?.options_json)?q.options_json:[],correctAnswer:q?.correct_answer||'',points:Number(q?.points||1)}}
function examQuestionHTML(q,i){
  const type=q.questionType||'MCQ';
  const options=(q.options||['Option A','Option B']).map(x=>String(x||''));
  const optionFields=type==='MCQ'?'<div class="answer-list">'+[0,1,2,3].map(j=>'<div class="answer-option"><input data-qopt="'+i+'" data-opt="'+j+'" value="'+esc(options[j]||'')+'" placeholder="Option '+String.fromCharCode(65+j)+'"><button type="button" class="btn ghost" onclick="setExamCorrect('+i+','+j+')">'+(String(q.correctAnswer||'')===String(options[j]||'')?'✓ Correct':'Set correct')+'</button></div>').join('')+'</div>':
    type==='TRUE_FALSE'?'<div class="answer-list"><label class="answer-option"><input type="radio" name="correct-'+i+'" '+(q.correctAnswer==='TRUE'?'checked':'')+' onchange="examDraft['+i+'].correctAnswer=\'TRUE\'"> TRUE</label><label class="answer-option"><input type="radio" name="correct-'+i+'" '+(q.correctAnswer==='FALSE'?'checked':'')+' onchange="examDraft['+i+'].correctAnswer=\'FALSE\'"> FALSE</label></div>':
    '<div class="manual-grade-note"><b>Teacher graded</b><span>This question will not be auto-graded.</span></div>';
  return '<article class="card exam-question question-editor" data-qindex="'+i+'"><div class="head"><div><span class="question-number">Question '+(i+1)+'</span><h3>'+esc(q.questionText||'')+'</h3></div><button type="button" class="btn danger" onclick="removeExamQuestion('+i+')">Remove</button></div><label>Question<textarea data-qtext="'+i+'" rows="3" placeholder="Write the question...">'+esc(q.questionText||'')+'</textarea></label><div class="grid c2"><label>Type<select data-qtype="'+i+'" onchange="examTypeChanged('+i+',this.value)"><option value="MCQ" '+(type==='MCQ'?'selected':'')+'>Multiple choice</option><option value="TRUE_FALSE" '+(type==='TRUE_FALSE'?'selected':'')+'>True / False</option><option value="SHORT" '+(type==='SHORT'?'selected':'')+'>Short answer</option><option value="LONG" '+(type==='LONG'?'selected':'')+'>Long answer</option></select></label><label>Points<input type="number" min="0.5" step="0.5" data-qpoints="'+i+'" value="'+Number(q.points||1)+'"></label></div>'+optionFields+'</article>';
}
function renderExamQuestions(){
  const root=$('#examQuestions');
  if(!root)return;
  const questions=examDraft.map(examQuestionHTML).join('');
  root.innerHTML=questions||'<div class="empty">No questions yet. Add one.</div>';
  root.insertAdjacentHTML('beforeend','<div class="exam-add-question-bottom"><button type="button" class="btn ghost exam-add-question-btn" onclick="addExamQuestion()">＋ Add question</button></div>');
}
function addExamQuestion(){collectExamQuestions();examDraft.push({questionText:'',questionType:'MCQ',options:['','','',''],correctAnswer:'',points:1});renderExamQuestions()}
function removeExamQuestion(i){collectExamQuestions();if(examDraft.length<=1)return toast('An exam needs at least one question');examDraft.splice(i,1);renderExamQuestions()}
function setExamCorrect(i,j){collectExamQuestions();examDraft[i].correctAnswer=String(examDraft[i].options[j]||'').trim();renderExamQuestions()}
function examTypeChanged(i,type){
  collectExamQuestions();
  examDraft[i].questionType=type;
  examDraft[i].correctAnswer=type==='TRUE_FALSE'?'TRUE':'';
  if(type==='MCQ')examDraft[i].options=['','','',''];
  else examDraft[i].options=[];
  renderExamQuestions();
}
function collectExamQuestions(){
  document.querySelectorAll('[data-qindex]').forEach(card=>{
    const i=Number(card.dataset.qindex);if(!examDraft[i])return;
    examDraft[i].questionText=card.querySelector('[data-qtext]')?.value?.trim()||'';
    examDraft[i].points=Number(card.querySelector('[data-qpoints]')?.value||1);
    const type=card.querySelector('[data-qtype]')?.value||examDraft[i].questionType;examDraft[i].questionType=type;
    if(type==='MCQ'){
      examDraft[i].options=[...card.querySelectorAll('[data-qopt="'+i+'"]')].map(x=>x.value.trim()).filter(Boolean);
    }else if(type==='TRUE_FALSE'){
      examDraft[i].correctAnswer=card.querySelector('[name="correct-'+i+'"]:checked')?.value||examDraft[i].correctAnswer||'TRUE';
    }else{
      examDraft[i].correctAnswer='';
    }
  });
}
async function examEdit(id){
  let x=S.exams.find(a=>Number(a.id)===Number(id))||{}, questions=[];
  if(id){try{const d=await api('/api/exams/'+id+'/edit');x=d.exam;questions=(d.questions||[]).map(examDraftFromQuestion)}catch(e){return toast(e.message)}}
  examDraft=questions.length?questions:[{questionText:'',questionType:'MCQ',options:['','','',''],correctAnswer:'',points:1}];
  modal('<div class="modalhead"><h2>'+(id?'Edit exam':'Create exam')+'</h2><button class="close" onclick="b4Close()">×</button></div><form class="form" onsubmit="saveExam(event,'+(id||'null')+')"><label>Title<input id="et" value="'+esc(x.title||'')+'" required></label><label>Subject<select id="es">'+S.subjects.map(s=>'<option value="'+s.id+'" '+(Number(s.id)===Number(x.subject_id)?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select></label><label>Description<textarea id="ed" rows="3">'+esc(x.description||'')+'</textarea></label><label>Deadline<input id="een" type="datetime-local" value="'+examInputDate(x.ends_at)+'"></label><label>Time limit (minutes)<input id="dur" type="number" min="1" value="'+esc(x.duration_minutes||'')+'" placeholder="Optional"></label><div class="head"><h3>Questions</h3><span class="muted">Add questions from the bottom</span></div><div id="examQuestions"></div><button class="btn primary">Save exam</button></form>');
  renderExamQuestions();
}
async function saveExam(e,id){
  e.preventDefault();collectExamQuestions();
  const qs=examDraft.map(q=>({questionText:q.questionText,questionType:q.questionType,options:q.questionType==='MCQ'?q.options:[],correctAnswer:q.correctAnswer||null,points:Number(q.points||1)})).filter(q=>q.questionText);
  if(!qs.length)return toast('Add at least one question');
  if(qs.some(q=>q.questionType==='MCQ'&&(!q.options||q.options.length<2||!q.correctAnswer)))return toast('Each MCQ needs at least 2 options and a correct answer');
  if(qs.some(q=>q.questionType==='TRUE_FALSE'&&!q.correctAnswer))return toast('Choose TRUE or FALSE for every true/false question');
  const b={title:$('#et').value.trim(),description:$('#ed').value,subjectId:Number($('#es').value)||null,endsAt:$('#een').value||null,durationMinutes:Number($('#dur').value)||null,questions:qs};
  try{await api(id?'/api/admin/exams/'+id:'/api/admin/exams',{method:id?'PATCH':'POST',body:JSON.stringify(b)});close();await loadData();render();toast('Exam saved ✓')}catch(x){toast(x.message)}
}
async function startExam(id){
  window.examExitAllowed=false;
  try{
    const d=await api('/api/exams/'+id+'/start',{method:'POST'});
    S.examRun={id,exam:d.exam,attempt:d.attempt,questions:d.questions||[]};
    S.view='exam-run';render();window.scrollTo({top:0,behavior:'smooth'});startExamTimer(d.attempt?.deadline,id);
  }catch(e){
    if(/already submitted/i.test(e.message)){loadStudentExamAnswers(id);return}
    if(/Exam Locked/i.test(e.message)){toast('🔒 Exam Locked — your attempt was locked because you left the exam. A Teacher can unlock it from Submissions.');return}
    toast(e.message);
  }
}
function examRunV(){
  const r=S.examRun||{};
  const questions=r.questions||[];
  const cards=questions.map((q,i)=>{
    const type=q.question_type||'MCQ';
    const opts=q.options_json||[];
    let body='';
    if(type==='MCQ'){
      body=`<div class="exam-choice-list">${opts.map((o,j)=>`<label class="exam-choice"><input type="radio" name="q${q.id}" value="${esc(o)}"><span class="choice-letter">${String.fromCharCode(65+j)}</span><span>${esc(o)}</span></label>`).join('')}</div>`;
    }else if(type==='TRUE_FALSE'){
      body=`<div class="exam-choice-list tf-list"><label class="exam-choice true"><input type="radio" name="q${q.id}" value="TRUE"><span class="choice-icon">✓</span><span>True</span></label><label class="exam-choice false"><input type="radio" name="q${q.id}" value="FALSE"><span class="choice-icon">✕</span><span>False</span></label></div>`;
    }else{
      body=`<label class="exam-answer-box"><span>Your answer</span><textarea name="q${q.id}" rows="${type==='LONG'?9:4}" placeholder="${type==='LONG'?'Write your detailed answer here…':'Write your short answer here…'}"></textarea></label>`;
    }
    return `<article class="exam-run-question"><div class="exam-question-top"><span class="question-number">Question ${i+1}</span><span class="badge">${esc(type==='TRUE_FALSE'?'TRUE / FALSE':type)}</span></div><h3>${esc(q.question_text)}</h3>${body}</article>`;
  }).join('');
  return title('Take Exam',esc(r.exam?.title||'Exam'),'')+
    `<div class="exam-page-shell"><div class="exam-run-hero"><div><span class="eyebrow">EXAM CENTER</span><h2>${esc(r.exam?.title||'Exam')}</h2><p>${esc(r.exam?.description||'Answer each question carefully. MCQ and True/False are auto-graded. Short and Long answers are reviewed by the teacher.')}</p></div><div id="examTimer" class="exam-timer">Loading…</div></div><form class="exam-page-form" id="examRunForm" onsubmit="submitExam(event,${Number(r.id)})">${cards}<div class="exam-submit-row"><p class="muted">Your answers are saved when you submit the exam. Short and Long answers will be reviewed by the teacher.</p><button id="examSubmitBtn" class="btn primary">Submit Exam</button></div></form></div>`;
}
function startExamTimer(deadline,id){
  clearInterval(window.examTimer);
  const box=$('#examTimer');
  const raw=deadline?new Date(deadline).getTime():NaN;
  const duration=Number(S.examRun?.exam?.duration_minutes||0);
  const started=Number(S.examRun?.attempt?.started_at?new Date(S.examRun.attempt.started_at).getTime():NaN);
  const end=Number.isFinite(raw)?raw:(duration>0&&Number.isFinite(started)?started+duration*60000:null);
  const tick=()=>{
    if(!box)return clearInterval(window.examTimer);
    if(!end){box.textContent='No time limit';return}
    const left=Math.max(0,end-Date.now()),sec=Math.floor(left/1000),m=Math.floor(sec/60),s=sec%60;
    box.textContent='Time remaining • '+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    box.classList.toggle('warn',left<=60000&&left>15000);
    box.classList.toggle('danger',left<=15000);
    if(left<=0){
      clearInterval(window.examTimer);
      toast('Time is over — submitting exam');
      const form=$('#examRunForm');
      if(form)submitExam({preventDefault:()=>{}},id,true);
    }
  };
  tick();
  window.examTimer=setInterval(tick,1000);
}
async function submitExam(e,id,auto=false){
  e.preventDefault?.();window.examExitAllowed=true;clearInterval(window.examTimer);
  const form=$('#examRunForm'),answers={};
  if(form)form.querySelectorAll('[name^="q"]').forEach(x=>{if((x.type==='radio'&&x.checked)||x.tagName==='TEXTAREA')answers[x.name.slice(1)]=x.value.trim()});
  try{
    const d=await api('/api/exams/'+id+'/submit',{method:'POST',body:JSON.stringify({answers})});
    S.examResult={...d,examId:id,auto};S.examRun=null;S.view='exam-result';render();window.scrollTo({top:0,behavior:'smooth'});
  }catch(x){
    if(/exam is locked/i.test(x.message)){S.examRun={id,locked:true,lockMessage:x.message};S.view='exam-locked';render();window.scrollTo({top:0,behavior:'smooth'});return}
    toast(x.message)
  }
}
function examLockedV(){
  const r=S.examRun||{};
  return title('Exam Locked','Your exam was locked because you left the exam screen.',`<button class="btn ghost" onclick="go('exams')">← Back to Exams</button>`)+
  '<div class="exam-locked-page"><div class="exam-locked-card"><div class="exam-lock-icon">🔒</div><span class="eyebrow">EXAM LOCKED</span><h2>Exam Locked</h2><p class="muted">'+esc(r.lockMessage||'Leaving the exam screen was detected. Please contact your Teacher to unlock this attempt.')+'</p><div class="exam-locked-note">Your answers were not deleted. A Teacher can unlock this attempt from Submissions.</div><button class="btn primary" onclick="go(\'exams\')">Back to Exams</button></div></div>';
}
async function loadStudentExamAnswers(id){
  try{const d=await api('/api/exams/'+id+'/answers');S.examAnswers={...d,examId:id};S.view='exam-answers';render();window.scrollTo({top:0,behavior:'smooth'});}catch(e){toast(e.message)}
}
function examResultV(){
  const r=S.examResult||{};
  return title('Exam Result','Your submission has been recorded.','<button class="btn ghost" onclick="go(\'exams\')">← Back to Exams</button>')+
  '<div class="exam-result-page"><div class="score-wrap"><div class="score-ring" style="--score:'+Number(r.percent||0)+'"><svg viewBox="0 0 120 120"><circle class="score-bg" cx="60" cy="60" r="50"></circle><circle class="score-value" cx="60" cy="60" r="50" pathLength="100" stroke-dasharray="'+Number(r.percent||0)+' 100"></circle></svg><div class="score-number">'+Number(r.percent||0)+'%<small>'+Number(r.score||0)+' / '+Number(r.total||0)+'</small></div></div><h2>Submitted successfully</h2><p class="muted">'+(r.auto?'Auto-submitted because the time limit ended.':'Your exam has been submitted.')+'</p><div class="exam-result-actions"><button class="btn primary" onclick="loadStudentExamAnswers('+Number(r.examId)+')">View Answers</button><button class="btn ghost" onclick="go(\'exams\')">Back to Exams</button></div></div></div>';
}
function examAnswersV(){
  const r=S.examAnswers||{},qs=r.questions||[];
  return title('View Answers','Review what you submitted and what was marked correct or incorrect.',`<button class="btn ghost" onclick="go('exams')">← Back</button>`)+
  '<div class="exam-answers-summary"><div><b>'+Number(r.percent||0)+'%</b><span>Current score</span></div><div><b>'+Number(r.score||r.attempt?.score||0)+' / '+Number(r.total||0)+'</b><span>Graded points</span></div></div>'+
  '<div class="exam-answer-review-list">'+qs.map((q,i)=>{
    const type=q.question_type==='TRUE_FALSE'?'TRUE / FALSE':(q.question_type||'MCQ');
    const manual=q.question_type==='SHORT'||q.question_type==='LONG';
    const pending=q.is_correct===null||q.is_correct===undefined;
    const state=pending?'pending':(q.is_correct?'correct':'incorrect');
    const status=pending?(manual?'Pending teacher review':'Not graded'):(q.is_correct?'✓ Correct':'✕ Incorrect');
    const answerToShow=manual?(pending?'Not graded yet':(q.teacher_correct_answer||'Correct — no correction needed')):(q.auto_correct_answer||'Correct answer was not saved');
    return '<article class="exam-answer-review '+state+'"><div class="head"><div><div class="exam-question-meta"><span class="question-number">Question '+(i+1)+'</span><span class="badge exam-type-badge">'+esc(type)+'</span></div><h3>'+esc(q.question_text)+'</h3></div><span class="answer-status">'+status+'</span></div><div class="answer-review-grid"><div class="answer-review-box"><small>Your answer</small><p>'+esc(q.answer_text||'No answer')+'</p></div><div class="answer-review-box"><small>'+((!manual)?'Correct answer':'Teacher answer')+'</small><p>'+esc(answerToShow)+'</p></div></div></article>';
  }).join('')+'</div>';
}
async function submissions(id){try{const d=await api('/api/admin/exams/'+id+'/submissions');S.examReview={examId:id,submissions:d.submissions||[]};S.view='exam-review';render();}catch(e){toast(e.message)}}
async function openExamSubmission(examId,attemptId){try{const d=await api('/api/admin/exams/'+examId+'/submissions/'+attemptId);S.examReview={examId,detail:d};S.view='exam-review';render();}catch(e){toast(e.message)}}
function unlockExamAttempt(examId,attemptId){
  if(!confirm('Unlock this exam attempt for the student?'))return;
  api('/api/admin/exams/'+examId+'/submissions/'+attemptId+'/unlock',{method:'POST'}).then(()=>{toast('Exam unlocked');openExamSubmission(examId,attemptId)}).catch(e=>toast(e.message));
}
function examGradeModal(examId,attemptId,qid){
  const q=(S.examReview?.detail?.questions||[]).find(x=>Number(x.id)===Number(qid)); if(!q)return toast('Question not found');
  modal('<div class="exam-grade-modal"><div class="modalhead"><div><span class="eyebrow">MANUAL GRADING</span><h2>Grade Answer</h2></div><button class="close" onclick="b4Close()">×</button></div><p class="muted">Choose whether the student answer is correct. If it is incorrect, enter the correct answer so the student can see it.</p><div class="grade-answer-preview"><small>Student answer</small><div>'+esc(q.answer_text||'No answer')+'</div></div><div class="grade-actions"><button class="btn grade-correct" onclick="gradeExamAnswer('+examId+','+attemptId+','+q.id+',true)">✓ Correct</button><button class="btn grade-wrong" onclick="examWrongAnswerModal('+examId+','+attemptId+','+q.id+')">✕ Incorrect</button></div></div>');
}
function examWrongAnswerModal(examId,attemptId,qid){
  modal('<div class="exam-grade-modal"><div class="modalhead"><div><span class="eyebrow">MANUAL GRADING</span><h2>Correct Answer</h2></div><button class="close" onclick="b4Close()">×</button></div><p class="muted">Write the correct answer. This will be shown to the student.</p><form class="form" onsubmit="submitWrongGrade(event,'+examId+','+attemptId+','+qid+')"><textarea id="gradeCorrectAnswer" rows="6" required placeholder="Write the correct answer…"></textarea><button class="btn grade-wrong" type="submit">Save as Incorrect</button></form></div>');
}
async function gradeExamAnswer(examId,attemptId,qid,correct,correctAnswer=''){
  try{await api('/api/admin/exams/'+examId+'/submissions/'+attemptId+'/questions/'+qid,{method:'PATCH',body:JSON.stringify({correct,correctAnswer})});b4Close();const d=await api('/api/admin/exams/'+examId+'/submissions/'+attemptId);S.examReview={examId,detail:d};render();toast(correct?'Answer marked correct ✓':'Answer marked incorrect ✓')}catch(e){toast(e.message)}
}
async function submitWrongGrade(e,examId,attemptId,qid){e.preventDefault();const answer=$('#gradeCorrectAnswer')?.value.trim()||'';if(!answer)return toast('Write the correct answer');await gradeExamAnswer(examId,attemptId,qid,false,answer)}
async function unlockExamSubmission(examId,attemptId){
  if(!await confirmAction('Unlock this exam for the student? The student will receive a fresh attempt timer.'))return;
  try{
    await api('/api/admin/exams/'+examId+'/submissions/'+attemptId+'/unlock',{method:'POST',body:JSON.stringify({})});
    toast('Exam unlocked ✓');
    const d=await api('/api/admin/exams/'+examId+'/submissions/'+attemptId);
    S.examReview={examId,detail:d};
    render();
  }catch(e){toast(e.message)}
}
function examReviewV(){
  const r=S.examReview||{};
  if(r.detail){
    const d=r.detail,examId=Number(r.examId||0),attemptId=Number(d.attempt?.id||0);
    return title('Submission review','Answers submitted by '+esc(d.attempt?.display_name||'Student'),`<button class="btn ghost" onclick="go('exams')">← Back</button>`+(d.attempt?.status==='LOCKED'?'<button class="btn primary" onclick="unlockExamSubmission('+examId+','+attemptId+')">🔓 Unlock</button>':''))+
    '<div class="grid c3 review-summary"><div class="card"><small>Student</small><b>'+esc(d.attempt?.display_name||'—')+'</b></div><div class="card"><small>Score</small><b>'+Number(d.attempt?.score||0)+' / '+Number(d.total||0)+'</b></div><div class="card"><small>Percentage</small><b>'+Number(d.percent||0)+'%</b></div></div>'+
    '<div class="grid review-questions">'+(d.questions||[]).map((q,i)=>{
      const manual=q.question_type==='SHORT'||q.question_type==='LONG';
      const pending=q.is_correct===null||q.is_correct===undefined;
      const type=q.question_type==='TRUE_FALSE'?'TRUE / FALSE':(q.question_type||'MCQ');
      const answer=manual?(pending?'Awaiting teacher grading':(q.teacher_correct_answer||'Correct — no correction needed')):(q.auto_correct_answer||'Correct answer was not saved');
      const result=pending?'• Awaiting teacher grading':(q.is_correct?'✓ Correct':'✕ Incorrect')+' • '+Number(q.points_awarded||0)+' / '+Number(q.points||0);
      return '<article class="card review-question"><div class="head"><div class="exam-question-meta"><span class="question-number">Question '+(i+1)+'</span><span class="badge exam-type-badge">'+esc(type)+'</span></div></div><h3>'+esc(q.question_text)+'</h3><div class="answer-block"><small>Student answer</small><p>'+esc(q.answer_text||'No answer')+'</p></div><div class="answer-block"><small>Correct answer</small><p>'+esc(answer)+'</p></div>'+ (manual?'<div class="manual-grade-panel"><div class="answer-result '+(pending?'not-graded':(q.is_correct?'correct':'incorrect'))+'">'+result+'</div><button class="btn primary" onclick="examGradeModal('+examId+','+attemptId+','+q.id+')">Grade Answer</button></div>':'<div class="answer-result '+(q.is_correct?'correct':'incorrect')+'">'+(q.is_correct?'✓ Correct':'✕ Incorrect')+' • '+Number(q.points_awarded||0)+' / '+Number(q.points||0)+'</div>')+'</article>';
    }).join('')+'</div>';
  }
  return title('Exam submissions','Choose a student to review their full answers.',`<button class="btn ghost" onclick="go('exams')">← Back</button>`)+
  '<div class="grid review-submissions">'+(r.submissions||[]).map(x=>'<article class="card review-student"><button class="review-student-main" onclick="openExamSubmission('+r.examId+','+x.id+')"><div><b>'+esc(x.display_name)+'</b><small>'+esc(x.status||'')+'</small></div><span class="badge">'+Number(x.percent||0)+'%</span></button>'+(x.status==='LOCKED'?'<button class="btn primary review-unlock" onclick="unlockExamSubmission('+r.examId+','+x.id+')">🔓 Unlock</button>':'')+'</article>').join('')||'<div class="card empty">No submissions yet.</div>'+'</div>';
}
async function delAPI(path,msg){if(!await confirmAction('Are you sure?'))return;try{await api(path,{method:'DELETE'});await loadData();render();toast(msg+' ✓')}catch(e){toast(e.message)}}
function searchBind(){const i=$('#search');if(i)i.oninput=()=>{const q=i.value.toLowerCase().trim();if(!q)return;const all=[...S.students,...S.teachers,...S.subjects,...S.assignments,...S.resources];const x=all.find(a=>String(a.display_name||a.name||a.title||'').toLowerCase().includes(q));if(x)toast('Found: '+(x.display_name||x.name||x.title))}}
function toggleTheme(){S.theme=S.theme==='dark'?'light':'dark';localStorage.b4Theme=S.theme;render()}
function setLang(lang){S.lang=lang==='ar'?'ar':'en';localStorage.b4Lang=S.lang;document.documentElement.lang=S.lang;document.documentElement.dir=S.lang==='ar'?'rtl':'ltr';if($('#lang span'))$('#lang span').textContent=S.lang==='ar'?'EN':'عربي';render()}
function toggleLang(){setLang(S.lang==='ar'?'en':'ar')}
function commandCenter(){modal('<div class="modalhead"><div><span class="eyebrow">B4</span><h2>More</h2></div><button class="close" onclick="b4Close()">×</button></div><div class="more-menu"><button class="more-option" onclick="b4Close();go(\'students\')"><span class="more-icon">♙</span><span><b>Students</b><small>Class members</small></span><i>›</i></button><button class="more-option" onclick="b4Close();go(\'subjects\')"><span class="more-icon">▣</span><span><b>Subjects</b><small>Lessons and materials</small></span><i>›</i></button><button class="more-option" onclick="b4Close();go(\'schedule\')"><span class="more-icon">◫</span><span><b>Schedule</b><small>Class timetable</small></span><i>›</i></button><button class="more-option" onclick="b4Close();go(\'settings\')"><span class="more-icon">⚙</span><span><b>Settings</b><small>Account and preferences</small></span><i>›</i></button><button class="more-option" onclick="b4Close();go(\'developers\')"><span class="more-icon">⌘</span><span><b>Developers</b><small>B4 development team</small></span><i>›</i></button></div>')}
document.addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(b)go(b.dataset.v)});
function setupMobileDockAutoHide(){
  let lastY=window.scrollY||0;
  let ticking=false;
  const update=()=>{
    ticking=false;
    if(window.innerWidth>800)return;
    const dock=document.querySelector('.mobile-dock');
    if(!dock)return;
    const side=document.querySelector('#side');
    if(side?.classList.contains('open')){
      dock.classList.add('dock-hidden');
      lastY=window.scrollY||0;
      return;
    }
    const y=window.scrollY||0;
    const nearTop=y<40;
    const nearBottom=(window.innerHeight+y)>=document.documentElement.scrollHeight-80;
    if(nearTop || nearBottom || y<lastY) dock.classList.remove('dock-hidden');
    else if(y>lastY+8) dock.classList.add('dock-hidden');
    lastY=y;
  };
  window.addEventListener('scroll',()=>{
    if(!ticking){ticking=true;requestAnimationFrame(update)}
  },{passive:true});
  window.addEventListener('resize',update);
  update();
}
function cancelReply(){window.replyTo=null;const i=$('#chatInput');if(i){i.value='';i.placeholder='Write a message...'}close()}
window.addEventListener('beforeunload',()=>clearInterval(window.examTimer));
document.addEventListener('DOMContentLoaded',async()=>{
const params=new URLSearchParams(location.search);const requestedView=params.get('view');const requestedId=Number(params.get('id')||0);if(['dashboard','students','teachers','subjects','schedule','assignments','resources','exams','announcements','chat','teacherChat','attendance','admin','teacherCenter','settings','developers'].includes(requestedView))S.view=requestedView;
setupMobileDockAutoHide();document.documentElement.dataset.theme=S.theme;document.documentElement.classList.toggle('dark',S.theme==='dark');$('#theme').onclick=toggleTheme;$('#lang').onclick=toggleLang;$('#install').onclick=installB4;$('#mobile').onclick=()=>$('#side').classList.toggle('open');document.addEventListener('click',e=>{if(window.innerWidth<=800){const side=$('#side');if(side?.classList.contains('open')&&!side.contains(e.target)&&!e.target.closest('#mobile'))side.classList.remove('open')}});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&window.innerWidth<=800)$('#side')?.classList.remove('open')});$('#ai').onclick=aiModal;$('#bell').onclick=openNotifications;$('#mobileAlerts').onclick=openNotifications;$('#profile').onclick=()=>S.me?go('settings'):loginModal();searchBind();await loadMe();if(requestedView&&requestedId&&requestedView==='assignments')setTimeout(()=>openAssignment(requestedId),120);if(requestedView&&requestedId&&requestedView==='exams')setTimeout(()=>startExam(requestedId),120);startAssignmentCountdown()});
