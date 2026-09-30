const $=s=>document.querySelector(s);const views={};const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const API_BASE=(window.B4_API_URL||localStorage.b4ApiUrl||'').replace(/\/$/,'');
const api=async(path,opts={})=>{const r=await fetch(API_BASE+path,{credentials:'include',headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||'Request failed');return d};
const S={lang:localStorage.b4Lang||'en',theme:localStorage.b4Theme||'light',view:'dashboard',me:null,students:[],subjects:[],tasks:[],announcements:[],messages:[],attendance:[],notifications:[],schedule:[],resources:[],exams:[],activationKeys:[],online:false,dataError:'',linked:[]};
const can=p=>{if(p==='ADMIN_CENTER')return !!S.me&&(['MANAGE_ADMINS','MANAGE_ROLES','MANAGE_ACCOUNTS','MANAGE_STUDENTS','MANAGE_KEYS','MANAGE_SUBJECTS','MANAGE_SCHEDULE','MANAGE_ASSIGNMENTS','MANAGE_RESOURCES','MANAGE_EXAMS','MANAGE_ATTENDANCE','MANAGE_ANNOUNCEMENTS','MANAGE_CHAT','VIEW_LOGS'].some(x=>(S.me.permissions||[]).includes(x)));if(p==='ACCOUNT')return !!S.me;if(!p)return true;return !S.me?p==='VIEW_CLASS':S.me.role==='SUPER_ADMIN'||(S.me.permissions||[]).includes(p)};
const L={en:{dash:'Dashboard',students:'Students',subjects:'Subjects',schedule:'Schedule',tasks:'Assignments',resources:'Resources',exams:'Exam Center',news:'Announcements',chat:'Class Chat',attendance:'Attendance',admin:'Admin Center',settings:'Settings',academic:'ACADEMICS',community:'COMMUNITY',more:'MORE',themeD:'Dark mode',themeL:'Light mode',install:'Install App',search:'Search everything...',welcome:'Welcome to B4 👋',sub:'Telecommunication • your class, academics and communication in one place.',add:'Add',view:'View all',login:'Login',logout:'Logout',activate:'Activation Key',account:'Account',linked:'Linked Accounts',save:'Save',password:'Password',display:'Display name',ai:'B4 AI Assistant'},ar:{dash:'الرئيسية',students:'الطلاب',subjects:'المواد',schedule:'الجدول',tasks:'المهام',resources:'المصادر',exams:'مركز الامتحانات',news:'الإعلانات',chat:'شات الفصل',attendance:'الحضور',admin:'مركز الإدارة',settings:'الإعدادات',academic:'الدراسة',community:'المجتمع',more:'المزيد',themeD:'الوضع الليلي',themeL:'الوضع النهاري',install:'تثبيت التطبيق',search:'ابحث في كل حاجة...',welcome:'أهلاً بك في B4 👋',sub:'اتصالات • دراستك وفصلك وتواصلك في مكان واحد.',add:'إضافة',view:'عرض الكل',login:'تسجيل الدخول',logout:'تسجيل الخروج',activate:'مفتاح التفعيل',account:'الحساب',linked:'الحسابات المرتبطة',save:'حفظ',password:'كلمة المرور',display:'اسم العرض',ai:'مساعد B4 الذكي'}};const t=k=>L[S.lang][k]||k;
const nav=[['dashboard','⌂','dash',null],['g','','academic',null],['students','♙','students','VIEW_CLASS'],['subjects','▣','subjects','VIEW_CLASS'],['schedule','◫','schedule','VIEW_CLASS'],['assignments','✓','tasks','VIEW_CLASS'],['resources','▤','resources','VIEW_CLASS'],['exams','⌁','exams','VIEW_CLASS'],['g','','community',null],['announcements','◈','news','VIEW_CLASS'],['chat','◌','chat','VIEW_CLASS'],['g','','more',null],['attendance','◉','attendance','VIEW_CLASS'],['admin','⚙','admin','ADMIN_CENTER'],['settings','⚙','settings','ACCOUNT']];
function toast(m){const e=document.createElement('div');e.className='toast';e.textContent=m;document.body.append(e);setTimeout(()=>e.remove(),2600)}function close(){$('#back').classList.remove('show')}function modal(h){$('#modal').innerHTML=`<div class="modal">${h}</div>`;$('#back').classList.add('show')}function go(v){S.view=v;render();window.scrollTo({top:0,behavior:'smooth'});$('#side').classList.remove('open')}
function buildNav(){
  let out='',group=[];
  const flush=()=>{if(group.length){out+=group.map(x=>`<button data-v="${x[0]}" class="${S.view===x[0]?'active':''}">${x[1]} <span>${t(x[2])}</span>${x[0]==='assignments'&&S.tasks.length?`<em>${S.tasks.length}</em>`:''}</button>`).join('');group=[]}};
  for(const x of nav){if(x[0]==='g'){flush();out+=`<div class="nav-group">${t(x[2])}</div>`;continue}if(can(x[3]))group.push(x)}
  flush();
  return out;
}
function title(h,p,b=''){return `<div class="title"><div><div class="eyebrow">B4 • TELECOMMUNICATION</div><h1>${h}</h1><p>${p}</p></div><div class="actions">${b}</div></div>`}
function dashboard(){const n=S.me?.display_name||'Guest';return title(`${t('welcome')}`,`${t('sub')} ${S.me?`• ${esc(n)}`:''}`,S.me?`<button class="btn ghost" onclick="go('settings')">⚙ ${t('settings')}</button>`:`<button class="btn primary" onclick="loginModal()">${t('login')}</button>`)+`${S.dataError?`<div class="card notice"><b>Database data could not be loaded.</b><div class="muted">${esc(S.dataError)}</div></div>`:''}<div class="hero"><div class="hero-row"><div><div class="eyebrow" style="color:#fff9">WE SCHOOL • B4</div><h1>B4 Telecommunication</h1><p>${S.lang==='ar'?'منصة الفصل الرسمية للطلاب والمدرسين والإدارة — بدون بيانات تجريبية.':'The official class portal for students, teachers and admins — no demo class data.'}</p><button class="btn" style="background:#fff;color:#6d28d9" onclick="aiModal()">✦ ${t('ai')}</button></div></div></div><div class="grid stats"><div class="card stat"><div><small>${t('students')}</small><b>${S.students.length}</b></div><div class="ico">♙</div></div><div class="card stat"><div><small>${t('subjects')}</small><b>${S.subjects.length}</b></div><div class="ico">▣</div></div><div class="card stat"><div><small>${t('tasks')}</small><b>${S.tasks.length}</b></div><div class="ico">✓</div></div><div class="card stat"><div><small>${t('attendance')}</small><b>${attendanceRate()}%</b></div><div class="ico">◉</div></div></div><div class="grid c2"><div class="card"><div class="head"><h3>${t('news')}</h3><button class="btn ghost" onclick="go('announcements')">${t('view')}</button></div><div class="list">${S.announcements.slice(0,4).map(a=>`<div class="item"><div class="ico">◈</div><div class="grow"><b>${esc(a.title)}</b><div class="muted">${esc(a.body||'')}</div></div></div>`).join('')||`<div class="empty">${S.lang==='ar'?'لا توجد إعلانات حتى الآن':'No announcements yet'}</div>`}</div></div><div class="card"><div class="head"><h3>✦ ${t('ai')}</h3><span class="badge">ONLINE</span></div><p class="muted">${S.lang==='ar'?'اسأل عن دروس الاتصالات، المذاكرة، الواجبات أو الامتحانات.':'Ask about Telecommunication lessons, revision, assignments or exams.'}</p><button class="btn primary" onclick="aiModal()">Ask AI →</button></div></div>`}
function studentsV(){return title(t('students'),S.lang==='ar'?'البيانات الرسمية محفوظة، واسم العرض قابل للتعديل من الحساب.':'Official identity is protected; students can edit only their display profile.',can('MANAGE_STUDENTS')?`<button class="btn primary" onclick="adminStudentModal()">＋ ${t('add')}</button>`:'')+`<div class="grid c3">${S.students.map(s=>`<div class="card"><div class="item" style="padding:0;border:0"><img class="avatar" src="${esc(s.avatar_url||('https://ui-avatars.com/api/?name='+encodeURIComponent(s.display_name||s.official_name)+'&background=b91c1c&color=fff'))}"><div class="grow"><b>${esc(s.display_name||s.official_name)}</b><div class="muted">${esc(s.student_code||'')} • B4</div></div><span class="badge">Student</span></div><p class="muted" style="font-size:11px">${esc(s.official_name)}</p></div>`).join('')}</div>`}
function subjectsV(){return title(t('subjects'),'Telecommunication curriculum and class progress.')+`<div class="grid c3">${S.subjects.map(s=>`<div class="card"><div class="head"><h3>${esc(s.name)}</h3><span class="badge">${s.progress||0}%</span></div><p class="muted">${esc(s.teacher_name||'')}</p><div class="barline"><span style="width:${s.progress||0}%"></span></div><button class="btn ghost" style="margin-top:13px" onclick="go('resources')">Open resources →</button></div>`).join('')||'<div class="card empty">No subjects configured yet.</div>'}</div>`}
function scheduleV(){return title(t('schedule'),'Official B4 schedule. The admin can update it later.')+`<div class="card tablewrap"><table class="table"><thead><tr><th>DAY</th><th>PERIOD 1</th><th>PERIOD 2</th><th>PERIOD 3</th><th>PERIOD 4</th></tr></thead><tbody>${S.schedule.map(r=>`<tr><td><b>${esc(r.day_name)}</b></td><td><div class="classblock">${esc(r.p1||'—')}</div></td><td><div class="classblock">${esc(r.p2||'—')}</div></td><td><div class="classblock">${esc(r.p3||'—')}</div></td><td><div class="classblock">${esc(r.p4||'—')}</div></td></tr>`).join('')||`<tr><td colspan="5" class="empty">Schedule will be added by the admin.</td></tr>`}</tbody></table></div>`}
function tasksV(){return title(t('tasks'),'Assignments from the real backend.',can('MANAGE_ASSIGNMENTS')?`<button class="btn primary" onclick="assignmentModal()">＋ ${t('add')}</button>`:'')+`<div class="grid c2">${S.tasks.map(x=>`<div class="card"><div class="head"><h3>${esc(x.title)}</h3><span class="badge ${x.status==='DONE'?'good':'warn'}">${esc(x.status||'OPEN')}</span></div><p class="muted">${esc(x.subject_name||'')}</p><div class="meter"><span>Due</span><b>${esc(x.due_at||'—')}</b></div>${x.description?`<p>${esc(x.description)}</p>`:''}</div>`).join('')||'<div class="card empty">No assignments yet.</div>'}</div>`}
function resourcesV(){return title(t('resources'),S.lang==='ar'?'مصادر الدراسة والملفات المشتركة.':'Shared lessons, files and study links.')+`<div class="grid c3">${S.resources.map(r=>`<article class="card"><div class="head"><span class="badge">${esc(r.resource_type||'RESOURCE')}</span><span class="muted">${esc(r.subject_name||'B4')}</span></div><h3>${esc(r.title)}</h3><p class="muted">${esc(r.description||'')}</p>${r.url?`<a class="btn primary" href="${esc(r.url)}" target="_blank" rel="noopener">Open resource →</a>`:r.file_url?`<a class="btn primary" href="${esc(r.file_url)}" target="_blank" rel="noopener">Open file →</a>`:''}</article>`).join('')||'<div class="card empty">No resources have been published yet.</div>'}</div>`}
function examsV(){return title(t('exams'),S.lang==='ar'?'الامتحانات المنشورة من الإدارة والمدرسين.':'Published exams and exam schedules.')+`<div class="grid c2">${S.exams.map(e=>`<article class="card"><div class="head"><span class="badge ${e.status==='OPEN'?'good':e.status==='CLOSED'?'red':'warn'}">${esc(e.status)}</span><span class="muted">${esc(e.subject_name||'')}</span></div><h3>${esc(e.title)}</h3><p class="muted">${esc(e.description||'')}</p><div class="meter"><span>Starts</span><b>${esc(e.starts_at||'Not scheduled')}</b></div><div class="meter"><span>Duration</span><b>${e.duration_minutes?esc(e.duration_minutes)+' min':'—'}</b></div></article>`).join('')||'<div class="card empty">No exams have been published yet.</div>'}</div><div class="card" style="margin-top:15px"><h3>Practice with B4 AI</h3><p class="muted">Use the assistant for explanations and revision before an exam.</p><button class="btn primary" onclick="aiModal()">✦ Ask B4 AI</button></div>`}
function newsV(){return title(t('news'),'Official class announcements.',can('MANAGE_ANNOUNCEMENTS')?`<button class="btn primary" onclick="announcementModal()">＋ ${t('add')}</button>`:'')+`<div class="grid">${S.announcements.map(a=>`<div class="card"><div class="head"><span class="badge">${esc(a.category||'General')}</span><span class="muted">${esc(a.created_at||'')}</span></div><h3>${esc(a.title)}</h3><p class="muted">${esc(a.body)}</p></div>`).join('')||'<div class="card empty">No announcements yet.</div>'}</div>`}
function chatV(){return title(t('chat'),S.lang==='ar'?'اضغط مطولاً على رسالتك للتعديل أو الحذف.':'Long-press your message to edit or delete.')+`<div class="card chat"><div class="messages" id="messages">${S.messages.map(m=>{const mine=S.me&&m.user_id===S.me.id;const edited=m.edited_at?' <span class="edited">Edited</span>':'';return `<div class="msg ${mine?'me':''}" data-message-id="${m.id}" oncontextmenu="messageMenu(event,${m.id})" ontouchstart="startMessagePress(event,${m.id})" ontouchend="endMessagePress()" ontouchcancel="cancelMessagePress()"><img class="avatar" src="${esc(m.avatar_url||('https://ui-avatars.com/api/?name='+encodeURIComponent(m.display_name||'User')+'&background=b91c1c&color=fff'))}"><div><b style="font-size:10px">${esc(m.display_name)}</b><div class="bubble">${esc(m.body)}</div><small class="muted">${esc(m.created_at||'')}${edited}</small></div></div>`}).join('')||'<div class="empty">No messages yet.</div>'}</div><form class="chatform" onsubmit="send(event)"><input id="chatInput" placeholder="${S.lang==='ar'?'اكتب رسالة...':'Write a message...'}" ${S.me?'':'disabled'}><button class="btn primary" ${S.me?'':'disabled'}>➤</button></form></div>`}
function attendanceRate(){if(!S.attendance.length)return 0;const p=S.attendance.filter(x=>x.status==='PRESENT').length;return Math.round(p/S.attendance.length*100)}
function attendanceV(){return title(t('attendance'),'Present, absent, late and excused records.')+`<div class="grid c2"><div class="card"><h2>${attendanceRate()}%</h2><p class="muted">Present rate</p><div class="barline"><span style="width:${attendanceRate()}%"></span></div></div><div class="card"><div class="list">${S.attendance.slice(0,12).map(a=>`<div class="item"><b class="grow">${esc(a.date)}</b><span class="badge ${a.status==='PRESENT'?'good':a.status==='ABSENT'?'red':'warn'}">${esc(a.status)}</span></div>`).join('')||'<div class="empty">No attendance records yet.</div>'}</div></div></div>`}
function adminV(){
  if(!can('ADMIN_CENTER'))return '';
  const cards=[];
  if(can('MANAGE_ADMINS')||can('MANAGE_ROLES'))cards.push('<div class="card"><div class="ico">⚙</div><h3>People & Permissions</h3><p class="muted">Give each account its own role and permissions.</p><button class="btn ghost" onclick="go('permissions')">Open →</button></div>');
  if(can('MANAGE_STUDENTS'))cards.push('<div class="card"><div class="ico">♙</div><h3>Students</h3><p class="muted">Manage official B4 students.</p><button class="btn ghost" onclick="adminStudentModal()">Manage →</button></div>');
  if(can('MANAGE_KEYS'))cards.push('<div class="card"><div class="ico">🔑</div><h3>Activation Keys</h3><p class="muted">Create one-time account keys.</p><button class="btn ghost" onclick="activationModal(true)">Manage →</button></div>');
  if(can('MANAGE_ASSIGNMENTS'))cards.push('<div class="card"><div class="ico">✓</div><h3>Assignments</h3><p class="muted">Publish class assignments.</p><button class="btn ghost" onclick="assignmentModal()">Create →</button></div>');
  if(can('MANAGE_ANNOUNCEMENTS'))cards.push('<div class="card"><div class="ico">◈</div><h3>Announcements</h3><p class="muted">Publish official notices.</p><button class="btn ghost" onclick="announcementModal()">Create →</button></div>');
  if(can('VIEW_LOGS'))cards.push('<div class="card"><div class="ico">⌁</div><h3>Logs</h3><p class="muted">Review chat edit history.</p><button class="btn ghost" onclick="logsModal()">View →</button></div>');
  return title(t('admin'),S.lang==='ar'?'إدارة بيانات الفصل والصلاحيات والمحتوى.':'Manage class data, content, accounts and security.')+`<div class="grid c3">${cards.join('')}</div>`;
}
function settingsV(){return title(t('settings'),'Personal preferences and account security.')+`<div class="grid c2"><div class="card"><h3>${t('account')}</h3><div class="form"><div class="field"><label>${t('display')}</label><input id="displayName" value="${esc(S.me?.display_name||'')}" ${S.me?'':'disabled'}></div><button class="btn primary" onclick="saveProfile()" ${S.me?'':'disabled'}>${t('save')}</button><button class="btn ghost" onclick="passwordModal()" ${S.me?'':'disabled'}>Change password</button></div></div><div class="card"><h3>Preferences</h3><div class="list"><button class="item quick" onclick="toggleTheme()"><span class="grow">Appearance</span><b>${S.theme}</b></button><button class="item quick" onclick="toggleLang()"><span class="grow">Language</span><b>${S.lang}</b></button><button class="item quick" onclick="installApp()"><span class="grow">${t('install')}</span>→</button></div></div><div class="card"><h3>${t('linked')}</h3><p class="muted">Google, Discord and Facebook can be linked only to an existing B4 account. They never create a new B4 account.</p><div class="list"><div class="item"><span class="grow">Google</span><span class="badge">Not linked</span></div><div class="item"><span class="grow">Discord</span><span class="badge">Not linked</span></div><div class="item"><span class="grow">Facebook</span><span class="badge">Not linked</span></div></div></div><div class="card"><h3>Session</h3><p class="muted">Persistent secure cookie session. Logging out ends the session.</p><button class="btn danger" onclick="logout()">${t('logout')}</button></div></div>`}
function notificationsV(){return title('Notifications',S.lang==='ar'?'تنبيهات الحساب والفصل.':'Account and class notifications.')+`<div class="grid">${S.notifications.map(n=>`<div class="card ${n.read_at?'':'notice'}"><div class="head"><h3>${esc(n.title)}</h3><small class="muted">${esc(n.created_at||'')}</small></div><p class="muted">${esc(n.body||'')}</p></div>`).join('')||'<div class="card empty">No notifications yet.</div>'}</div>`}
function loginModal(){modal(`<div class="modalhead"><h2>${t('login')}</h2><button class="close" onclick="close()">×</button></div><form class="form" onsubmit="login(event)"><div class="field"><label>Display name / Login</label><input id="loginName" required autocomplete="username"></div><div class="field"><label>${t('password')}</label><input id="loginPassword" type="password" required autocomplete="current-password"></div><button class="btn primary">${t('login')} →</button></form><div class="notice" style="margin-top:14px">New account? Use your one-time Activation Key first.</div><button class="btn ghost" style="margin-top:10px" onclick="activationUserModal()">${t('activate')}</button>`)}
async function login(e){e.preventDefault();try{await api('/api/auth/login',{method:'POST',body:JSON.stringify({login:$('#loginName').value.trim(),password:$('#loginPassword').value})});close();await loadMe();toast('Login successful ✓')}catch(x){toast(x.message)}}
function activationUserModal(){modal(`<div class="modalhead"><h2>${t('activate')}</h2><button class="close" onclick="close()">×</button></div><p class="muted">Your activation key is one-time and is already linked to your B4 identity.</p><form class="form" onsubmit="activate(event)"><div class="field"><label>One-time key</label><input id="activationKey" required autocomplete="off" spellcheck="false"></div><div class="field"><label>${t('display')}</label><input id="activationDisplay" required maxlength="120"></div><div class="field"><label>${t('password')}</label><input id="activationPassword" type="password" minlength="8" required autocomplete="new-password"></div><button class="btn primary">Create B4 account →</button></form>`)}
async function activate(e){e.preventDefault();try{const d=await api('/api/auth/activate',{method:'POST',body:JSON.stringify({key:$('#activationKey').value.trim(),displayName:$('#activationDisplay').value.trim(),password:$('#activationPassword').value})});close();toast(d.message||'Account created ✓');loginModal()}catch(x){toast(x.message)}}
function passwordModal(){modal(`<div class="modalhead"><h2>Change password</h2><button class="close" onclick="close()">×</button></div><form class="form" onsubmit="changePassword(event)"><div class="field"><label>Current password</label><input id="oldPw" type="password" required></div><div class="field"><label>New password</label><input id="newPw" type="password" minlength="8" required></div><button class="btn primary">Save password</button></form>`)}
async function changePassword(e){e.preventDefault();try{await api('/api/auth/password',{method:'POST',body:JSON.stringify({currentPassword:$('#oldPw').value,newPassword:$('#newPw').value})});close();toast('Password changed ✓')}catch(x){toast(x.message)}}
async function saveProfile(){try{await api('/api/auth/profile',{method:'PATCH',body:JSON.stringify({displayName:$('#displayName').value.trim()})});await loadMe();toast('Profile saved ✓')}catch(x){toast(x.message)}}
async function logout(){await api('/api/auth/logout',{method:'POST'}).catch(()=>{});S.me=null;render();toast('Logged out')}function accountInfo(){modal(`<div class="modalhead"><h2>Account security</h2><button class="close" onclick="close()">×</button></div><p class="muted">Passwords are stored as secure hashes. Super Admin cannot view original passwords.</p><div class="notice">Use Reset Password / temporary password workflows instead of exposing passwords.</div>`)}
async function activationModal(manage=false){if(!S.me||S.me.role!=='SUPER_ADMIN'){toast('Super Admin only');return}let keys=[],people={students:[],teachers:[]};try{[keys,people]=[(await api('/api/admin/activation-keys')).keys||[],await api('/api/admin/people')]}catch(e){toast(e.message);return}const opts=[...people.students.map(p=>`<option value="STUDENT:${p.id}">Student • ${esc(p.display_name)} (${esc(p.student_code)})</option>`),...people.teachers.map(p=>`<option value="TEACHER:${p.id}">Teacher • ${esc(p.display_name)}</option>`)].join('');modal(`<div class="modalhead"><h2>Activation Keys</h2><button class="close" onclick="close()">×</button></div><p class="muted">Generate a key only for a person who does not already have a B4 account.</p><form class="form" onsubmit="createKey(event)"><div class="field"><label>Person</label><select id="keyPerson" required>${opts}</select></div><button class="btn primary">Generate one-time key</button></form><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><div class="list">${keys.map(k=>`<div class="item"><span class="grow"><b>${esc(k.key_preview)}</b><br><small class="muted">${esc(k.person_name||'')} • ${esc(k.status)}</small></span><span class="badge">Hash only</span></div>`).join('')||'<div class="empty">No active keys.</div>'}</div>`)}
async function createKey(e){e.preventDefault();try{const [personType,personId]=$('#keyPerson').value.split(':');const d=await api('/api/admin/activation-keys',{method:'POST',body:JSON.stringify({personType,personId:Number(personId)})});await navigator.clipboard?.writeText(d.key);modal('<div class="modalhead"><h2>Activation key created</h2><button class="close" onclick="close()">×</button></div><p class="muted">Copy this key now. The full key is intentionally not stored for later viewing.</p><div class="notice" style="font-family:monospace;font-size:16px;word-break:break-all">'+esc(d.key)+'</div><button class="btn primary" style="margin-top:14px" onclick="copyText(\''+esc(d.key)+'\')">Copy key</button>');toast('Key generated ✓')}catch(x){toast(x.message)}}async function copyText(v){try{await navigator.clipboard.writeText(v)}catch{}toast(v)}function adminStudentModal(){modal('<div class="modalhead"><h2>Add student</h2><button class="close" onclick="close()">×</button></div><form class="form" onsubmit="createStudent(event)"><div class="field"><label>Student Code</label><input id="newStudentCode" placeholder="B4-25" required></div><div class="field"><label>Official full name</label><input id="newOfficialName" required></div><div class="field"><label>Display name</label><input id="newDisplayName" required></div><button class="btn primary">Add student →</button></form>')}
async function createStudent(e){e.preventDefault();try{await api('/api/admin/students',{method:'POST',body:JSON.stringify({studentCode:$('#newStudentCode').value,officialName:$('#newOfficialName').value,displayName:$('#newDisplayName').value})});close();await loadData();render();toast('Student added ✓')}catch(x){toast(x.message)}}
function assignmentModal(){modal('<div class="modalhead"><h2>Create assignment</h2><button class="close" onclick="close()">×</button></div><form class="form" onsubmit="createAssignment(event)"><div class="field"><label>Title</label><input id="assignmentTitle" required></div><div class="field"><label>Subject</label><select id="assignmentSubject">'+S.subjects.map(s=>'<option value="'+s.id+'">'+esc(s.name)+'</option>').join('')+'</select></div><div class="field"><label>Description</label><textarea id="assignmentDescription" rows="4"></textarea></div><div class="field"><label>Due date</label><input id="assignmentDue" type="datetime-local"></div><button class="btn primary">Publish assignment →</button></form>')}
async function createAssignment(e){e.preventDefault();try{await api('/api/admin/assignments',{method:'POST',body:JSON.stringify({title:$('#assignmentTitle').value,description:$('#assignmentDescription').value,subjectId:Number($('#assignmentSubject').value)||null,dueAt:$('#assignmentDue').value||null})});close();await loadData();render();toast('Assignment published ✓')}catch(x){toast(x.message)}}
function announcementModal(){modal('<div class="modalhead"><h2>New announcement</h2><button class="close" onclick="close()">×</button></div><form class="form" onsubmit="createAnnouncement(event)"><div class="field"><label>Title</label><input id="announcementTitle" required></div><div class="field"><label>Category</label><input id="announcementCategory" value="General"></div><div class="field"><label>Message</label><textarea id="announcementBody" rows="6" required></textarea></div><button class="btn primary">Publish announcement →</button></form>')}
async function createAnnouncement(e){e.preventDefault();try{await api('/api/admin/announcements',{method:'POST',body:JSON.stringify({title:$('#announcementTitle').value,body:$('#announcementBody').value,category:$('#announcementCategory').value})});close();await loadData();render();toast('Announcement published ✓')}catch(x){toast(x.message)}}async function logsModal(){
  try{
    const d=await api('/api/admin/logs');
    const rows=[...(d.activity||[]).map(x=>({...x,kind:'Activity'})),...(d.security||[]).map(x=>({...x,kind:'Security'}))]
      .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const body=rows.map(x=>'<div class="log-row"><div class="log-icon">'+(x.kind==='Security'?'🔒':'•')+'</div><div class="grow"><b>'+esc(x.action)+'</b><small class="muted">'+esc(x.actor_name||'System')+' • '+esc(x.created_at||'')+'</small><div class="muted">'+esc(x.entity_type||'')+(x.entity_id?' #'+esc(x.entity_id):'')+(x.details?' • '+esc(x.details):'')+'</div></div><span class="badge">'+esc(x.kind)+'</span></div>').join('');
    modal('<div class="modalhead"><h2>Activity & Security Logs</h2><button class="close" onclick="close()">×</button></div><p class="muted">All important account, admin, content, permission and security actions.</p><div class="log-list">'+(body||'<div class="empty">No logs yet.</div>')+'</div>');
  }catch(x){toast(x.message)}
}

// The backend needs the editor endpoint used by examModal().
async function loadData(){
  try{
    const d=await api('/api/bootstrap');
    S.students=d.students||[];S.subjects=d.subjects||[];S.tasks=d.assignments||[];S.announcements=d.announcements||[];S.schedule=d.schedule||[];S.resources=d.resources||[];S.exams=d.exams||[];S.attendance=d.attendance||[];S.messages=d.messages||[];S.notifications=d.notifications||[];S.dataError='';
  }catch(e){S.dataError=e.message||'Could not load class data';S.students=[];S.subjects=[];S.tasks=[];S.announcements=[];S.schedule=[];S.resources=[];S.exams=[];S.notifications=[];S.attendance=[];S.messages=[]}
}
function permissionsV(){
  if(!S.me || !(S.me.role==='SUPER_ADMIN'||(S.me.permissions||[]).includes('MANAGE_ROLES')||(S.me.permissions||[]).includes('MANAGE_ADMINS'))) return title('People & Permissions','You do not have permission to manage accounts.');
  return title('People & Permissions','Manage each account with separate role and permission controls.','<button class="btn ghost" onclick="go(\'admin\')">← Admin Center</button>') + '<div id="permissionsRoot" class="permissions-shell"><div class="card empty">Loading people & permissions…</div></div>';
}
async function loadPermissionsPage(){
 const root=$('#permissionsRoot');if(!root)return;
 try{const data=await api('/api/admin/users'),pd=await api('/api/admin/permissions'),users=data.users||[],perms=pd.permissions||[];
 if(!users.length){root.innerHTML='<div class="card empty">No accounts found yet.</div>';return;}
 const selected=users.find(u=>Number(u.id)===Number(window.__permissionUserId))||users[0];window.__permissionUserId=selected.id;
 const groups={Management:['MANAGE_ADMINS','MANAGE_ACCOUNTS','MANAGE_KEYS','MANAGE_TEACHERS','MANAGE_STUDENTS','MANAGE_ROLES'],Academic:['MANAGE_SUBJECTS','MANAGE_SCHEDULE','MANAGE_ASSIGNMENTS','MANAGE_RESOURCES','MANAGE_EXAMS','MANAGE_ATTENDANCE','MANAGE_ANNOUNCEMENTS'],System:['MANAGE_CHAT','VIEW_LOGS','USE_AI','VIEW_CLASS']};
 const people=users.map(u=>'<button class="person-card '+(Number(u.id)===Number(selected.id)?'selected':'')+'" onclick="selectPermissionUser('+Number(u.id)+')"><span class="avatar avatar-fallback">'+esc((u.display_name||'?').slice(0,1).toUpperCase())+'</span><span class="grow"><b>'+esc(u.display_name||'Unnamed')+'</b><small>'+esc(u.role)+' • '+esc(u.status)+'</small></span><span>›</span></button>').join('');
 let cards='';for(const [group,codes] of Object.entries(groups)){const items=codes.map(code=>{const p=perms.find(x=>x.code===code);if(!p)return '';const on=selected.role==='SUPER_ADMIN'||(selected.effective_permissions||[]).includes(code);return '<label class="permission-tile '+(on?'is-on':'')+'"><input type="checkbox" data-perm="'+esc(code)+'" '+(on?'checked':'')+' '+(selected.role==='SUPER_ADMIN'?'disabled':'')+'><span class="perm-check">'+(on?'✓':'')+'</span><span class="perm-copy"><b>'+esc(p.label||code)+'</b><small>'+esc(code)+'</small></span></label>';}).join('');cards+='<section class="perm-group"><div class="perm-group-head"><div><span class="eyebrow">PERMISSIONS</span><h3>'+esc(group)+'</h3></div><span class="badge">'+codes.length+'</span></div><div class="permission-grid">'+items+'</div></section>';}
 root.innerHTML='<div class="people-panel"><div class="people-list"><div class="people-list-head"><b>People</b><span class="badge">'+users.length+'</span></div>'+people+'</div><div class="permissions-detail"><div class="card perm-profile"><div class="perm-profile-main"><span class="avatar avatar-fallback big">'+esc((selected.display_name||'?').slice(0,1).toUpperCase())+'</span><div><span class="eyebrow">ACCOUNT</span><h2>'+esc(selected.display_name||'Unnamed')+'</h2><p class="muted">'+esc(selected.official_name||'')+' • '+esc(selected.status)+'</p></div></div><div class="role-controls"><label>Role<select id="permRole" '+(selected.role==='SUPER_ADMIN'?'disabled':'')+'><option '+(selected.role==='STUDENT'?'selected':'')+'>STUDENT</option><option '+(selected.role==='TEACHER'?'selected':'')+'>TEACHER</option><option '+(selected.role==='ADMIN'?'selected':'')+'>ADMIN</option><option '+(selected.role==='SUPER_ADMIN'?'selected':'')+'>SUPER_ADMIN</option></select></label><span class="badge">'+esc(selected.role)+'</span></div></div>'+(selected.role==='SUPER_ADMIN'?'<div class="card notice"><b>Super Admin</b><div class="muted">Full access is automatic. Individual permissions are locked.</div></div>':'')+cards+'<div class="perm-actions"><button class="btn primary" onclick="saveSelectedPermissions('+Number(selected.id)+')" '+(selected.role==='SUPER_ADMIN'?'disabled':'')+'>Save Changes</button><span class="muted">Effective permissions: '+(selected.effective_permissions||[]).length+'</span></div></div></div>';
 }catch(e){root.innerHTML='<div class="card notice"><b>Could not load People & Permissions</b><div class="muted">'+esc(e.message)+'</div></div>';}
}
async function selectPermissionUser(id){window.__permissionUserId=Number(id);await loadPermissionsPage();}
async function saveSelectedPermissions(id){try{const role=$('#permRole')?.value;if(role&&role!=='SUPER_ADMIN')await api('/api/admin/users/'+id+'/role',{method:'PATCH',body:JSON.stringify({role})});const codes=[...document.querySelectorAll('#permissionsRoot input[data-perm]:checked')].map(x=>x.dataset.perm);await api('/api/admin/users/'+id+'/permissions',{method:'PUT',body:JSON.stringify({permissionCodes:codes})});toast('Permissions saved ✓');await loadPermissionsPage();if(Number(id)===Number(S.me?.id))await loadMe();}catch(e){toast(e.message)}}
function render(){const content=$('#content'),navEl=$('#nav');if(!content||!navEl)return;document.documentElement.lang=S.lang;document.documentElement.dir=S.lang==='ar'?'rtl':'ltr';navEl.innerHTML=buildNav();try{content.innerHTML=(views[S.view]||views.dashboard)();}catch(e){console.error('B4 render failed:',e);content.innerHTML='<div class="card notice"><b>Page failed to render.</b><div class="muted">'+esc(e.message||e)+'</div></div>';return;}if(S.view==='permissions')loadPermissionsPage();const name=$('#topName');if(name)name.textContent=S.me?.display_name||'Guest';const avatar=$('#topAvatar');if(avatar&&S.me?.avatar_url)avatar.src=S.me.avatar_url;const search=$('#search');if(search)search.placeholder=t('search');}
async function loadMe(){try{const d=await api('/api/auth/me');S.me=d.user;}catch(e){S.me=null;}await loadData();render();}
function toggleTheme(){S.theme=S.theme==='dark'?'light':'dark';localStorage.b4Theme=S.theme;document.documentElement.dataset.theme=S.theme;render();}
function toggleLang(){S.lang=S.lang==='ar'?'en':'ar';localStorage.b4Lang=S.lang;render();}
async function installApp(){if(window.__b4InstallPrompt){window.__b4InstallPrompt.prompt();window.__b4InstallPrompt=null;}else toast('Use the browser menu to install B4 as an app.');}
function commandCenter(){modal('<div class="modalhead"><h2>More</h2><button class="close" onclick="close()">×</button></div><div class="list"><button class="item quick" onclick="close();go(\'students\')">♙ Students →</button><button class="item quick" onclick="close();go(\'subjects\')">▣ Subjects →</button><button class="item quick" onclick="close();go(\'schedule\')">◫ Schedule →</button><button class="item quick" onclick="close();go(\'resources\')">▤ Resources →</button><button class="item quick" onclick="close();go(\'settings\')">⚙ Settings →</button></div>');}
function startDeadlineTicker(){}
document.documentElement.dataset.theme=S.theme;
document.addEventListener('click',e=>{const n=e.target.closest?.('#nav [data-v]');if(n){e.preventDefault();go(n.dataset.v);}if(e.target.closest?.('#theme'))toggleTheme();if(e.target.closest?.('#lang'))toggleLang();if(e.target.closest?.('#install'))installApp();if(e.target.closest?.('#mobile'))$('#side')?.classList.toggle('open');if(e.target.closest?.('#profile'))S.me?go('settings'):loginModal();if(e.target.closest?.('#ai'))aiModal();if(e.target.closest?.('#bell'))go('notifications');});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();window.__b4InstallPrompt=e;});
views.dashboard=dashboard;views.students=studentsV;views.subjects=subjectsV;views.schedule=scheduleV;views.assignments=tasksV;views.resources=resourcesV;views.exams=examsV;views.announcements=newsV;views.chat=chatV;views.attendance=attendanceV;views.admin=adminV;views.settings=settingsV;views.notifications=notificationsV;views.permissions=permissionsV;

document.addEventListener('click',e=>{
  const closeBtn=e.target.closest?.('.close'); if(closeBtn)e.stopPropagation();
});
startDeadlineTicker();



/* ===== B4 FINAL CLASSROOM UI ===== */
function teacherModal(){
  if(!can('MANAGE_TEACHERS')) return;
  modal('<div class="modalhead"><h2>Teachers</h2><button class="close" onclick="close()">×</button></div>'+
    '<form class="form" onsubmit="createTeacher(event)">'+
    '<div class="field"><label>Teacher code</label><input id="teacherCode" placeholder="T-01" required></div>'+
    '<div class="field"><label>Official name</label><input id="teacherOfficial" required></div>'+
    '<div class="field"><label>Display name</label><input id="teacherDisplay" required></div>'+
    '<button class="btn primary">Add teacher →</button></form>'+
    '<div class="notice" style="margin-top:14px">After adding the teacher, use Activation Keys to create their one-time account key.</div>');
}
async function createTeacher(e){
  e.preventDefault();
  try{
    await api('/api/admin/teachers',{method:'POST',body:JSON.stringify({
      teacherCode:$('#teacherCode').value.trim(),
      officialName:$('#teacherOfficial').value.trim(),
      displayName:$('#teacherDisplay').value.trim()
    })});
    close();toast('Teacher added ✓');
    await loadData();render();
  }catch(x){toast(x.message)}
}
function scheduleModal(){
  if(!can('MANAGE_SCHEDULE')) return;
  const days=['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
  const rows=days.map((d,i)=>{
    const r=S.schedule[i]||{day_name:d,p1:'',p2:'',p3:'',p4:''};
    return '<div class="card schedule-edit-row"><b>'+esc(d)+'</b>'+
      '<input id="sp_'+i+'_1" value="'+esc(r.p1||'')+'" placeholder="Period 1">'+
      '<input id="sp_'+i+'_2" value="'+esc(r.p2||'')+'" placeholder="Period 2">'+
      '<input id="sp_'+i+'_3" value="'+esc(r.p3||'')+'" placeholder="Period 3">'+
      '<input id="sp_'+i+'_4" value="'+esc(r.p4||'')+'" placeholder="Period 4"></div>';
  }).join('');
  modal('<div class="modalhead"><h2>Edit Schedule</h2><button class="close" onclick="close()">×</button></div>'+
    '<p class="muted">Update all B4 periods from one place.</p><div class="schedule-editor">'+rows+'</div>'+
    '<button class="btn primary" style="margin-top:14px" onclick="saveSchedule()">Save schedule ✓</button>');
}
async function saveSchedule(){
  const days=['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
  const schedule=days.map((d,i)=>({day_name:d,p1:$('#sp_'+i+'_1').value,p2:$('#sp_'+i+'_2').value,p3:$('#sp_'+i+'_3').value,p4:$('#sp_'+i+'_4').value}));
  try{await api('/api/admin/schedule',{method:'PUT',body:JSON.stringify({schedule})});close();await loadData();render();toast('Schedule saved ✓')}catch(x){toast(x.message)}
}
function deadlineMarkup(start,end){
  if(!end) return '<div class="deadline-wrap"><div class="deadline-track"><span class="deadline-fill neutral"></span></div><small class="muted">No hard deadline</small></div>';
  return '<div class="deadline-wrap" data-deadline="'+esc(end)+'" data-start="'+esc(start||'')+'"><div class="deadline-track"><span class="deadline-fill"></span></div><small class="deadline-label">Deadline: '+esc(end)+'</small></div>';
}
function deadlineTicker(){
  document.querySelectorAll('.deadline-wrap[data-deadline]').forEach(w=>{
    const end=Date.parse(w.dataset.deadline), start=Date.parse(w.dataset.start||'');
    const now=Date.now(), total=(Number.isFinite(start)&&end>start)?end-start:0;
    const remaining=end-now;
    const pct=total>0?Math.max(0,Math.min(100,remaining/total*100)):remaining>0?100:0;
    const fill=w.querySelector('.deadline-fill'), label=w.querySelector('.deadline-label');
    if(!fill)return;
    fill.style.width=pct+'%';
    fill.classList.toggle('green',pct>50);
    fill.classList.toggle('yellow',pct<=50&&pct>20);
    fill.classList.toggle('red',pct<=20);
    if(remaining<=0){fill.style.width='0%';if(label)label.textContent='Deadline passed';}
  });
}
setInterval(deadlineTicker,1000);

function tasksV(){
  return title(t('tasks'),'Assignments from the real backend.',can('MANAGE_ASSIGNMENTS')?'<button class="btn primary" onclick="assignmentModal()">＋ '+t('add')+'</button>':'')+
  '<div class="grid c2">'+(S.tasks.map(x=>{
    const owner=Number(x.created_by)===Number(S.me?.id);
    const edit=can('MANAGE_ASSIGNMENTS')&&(S.me?.role==='SUPER_ADMIN'||S.me?.role==='ADMIN'||owner);
    return '<div class="card"><div class="head"><h3>'+esc(x.title)+'</h3><span class="badge '+(x.status==='DONE'?'good':'warn')+'">'+esc(x.status||'OPEN')+'</span></div>'+
      '<p class="muted">'+esc(x.subject_name||'')+'</p>'+
      '<div class="meter"><span>Due</span><b>'+esc(x.due_at||'—')+'</b></div>'+
      (x.description?'<p>'+esc(x.description)+'</p>':'')+
      (edit?'<div class="actions-row"><button class="btn ghost" onclick="editAssignmentModal('+x.id+')">Edit</button><button class="btn danger" onclick="deleteAssignment('+x.id+')">Delete</button></div>':'')+
      '</div>';
  }).join('')||'<div class="card empty">No assignments yet.</div>')+'</div>';
}

function assignmentModal(existing=null){
  if(!can('MANAGE_ASSIGNMENTS'))return;
  const x=existing||{};
  modal('<div class="modalhead"><h2>'+(existing?'Edit assignment':'Create assignment')+'</h2><button class="close" onclick="close()">×</button></div>'+
    '<form class="form" onsubmit="'+(existing?'updateAssignment(event,'+x.id+')':'createAssignment(event)')+'">'+
    '<div class="field"><label>Title</label><input id="assignmentTitle" value="'+esc(x.title||'')+'" required></div>'+
    '<div class="field"><label>Subject</label><select id="assignmentSubject">'+S.subjects.map(s=>'<option value="'+s.id+'" '+(Number(s.id)===Number(x.subject_id)?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select></div>'+
    '<div class="field"><label>Description</label><textarea id="assignmentDescription" rows="4">'+esc(x.description||'')+'</textarea></div>'+
    '<div class="field"><label>Due date</label><input id="assignmentDue" type="datetime-local" value="'+(x.due_at?String(x.due_at).slice(0,16):'')+'"></div>'+
    (existing?'<div class="field"><label>Status</label><select id="assignmentStatus"><option>OPEN</option><option>DONE</option><option>CLOSED</option></select></div>':'')+
    '<button class="btn primary">'+(existing?'Save changes ✓':'Publish assignment →')+'</button></form>');
  if(existing&&$('#assignmentStatus'))$('#assignmentStatus').value=x.status||'OPEN';
}
function editAssignmentModal(id){const x=S.tasks.find(a=>Number(a.id)===Number(id));if(x)assignmentModal(x)}
async function updateAssignment(e,id){
  e.preventDefault();
  try{await api('/api/admin/assignments/'+id,{method:'PATCH',body:JSON.stringify({title:$('#assignmentTitle').value,description:$('#assignmentDescription').value,subjectId:Number($('#assignmentSubject').value)||null,dueAt:$('#assignmentDue').value||null,status:$('#assignmentStatus')?.value||'OPEN'})});close();await loadData();render();toast('Assignment updated ✓')}catch(x){toast(x.message)}
}
async function deleteAssignment(id){if(!confirm('Delete this assignment?'))return;try{await api('/api/admin/assignments/'+id,{method:'DELETE'});await loadData();render();toast('Assignment deleted ✓')}catch(x){toast(x.message)}}

function renderExamQuestions(){
  const box=$('#examQuestions');if(!box)return;
  box.innerHTML=window.__examQuestions.map((q,i)=>{
    const type=q.type||'MCQ';
    const options=type==='MCQ'?'<div class="grid c2">'+q.options.map((o,j)=>'<input id="eq_opt_'+i+'_'+j+'" oninput="syncExamQuestion('+i+')" placeholder="Option '+(j+1)+'" value="'+esc(o)+'">').join('')+'</div>':'';
    let correct='';
    if(type==='MCQ'){
      correct='<select id="eq_correct_'+i+'" onchange="syncExamQuestion('+i+')" required><option value="">Choose correct answer…</option>'+q.options.filter(Boolean).map(o=>'<option value="'+esc(o)+'" '+(q.correct===o?'selected':'')+'>'+esc(o)+'</option>').join('')+'</select>';
    }else if(type==='TRUE_FALSE'){
      correct='<select id="eq_correct_'+i+'" onchange="syncExamQuestion('+i+')"><option value="TRUE" '+(q.correct==='TRUE'?'selected':'')+'>True</option><option value="FALSE" '+(q.correct==='FALSE'?'selected':'')+'>False</option></select>';
    }else{
      correct='<input id="eq_correct_'+i+'" oninput="syncExamQuestion('+i+')" value="'+esc(q.correct||'')+'" placeholder="Exact answer (optional)">';}
    return '<div class="card exam-question"><div class="head"><b>Question '+(i+1)+'</b>'+(i?'<button type="button" class="btn danger" onclick="removeExamQuestion('+i+')">Remove</button>':'')+'</div>'+
      '<div class="field"><label>Question</label><textarea id="eq_text_'+i+'" oninput="syncExamQuestion('+i+')" rows="2" required>'+esc(q.text||'')+'</textarea></div>'+
      '<div class="field"><label>Type</label><select id="eq_type_'+i+'" onchange="changeExamType('+i+',this.value)"><option value="MCQ" '+(type==='MCQ'?'selected':'')+'>MCQ</option><option value="TRUE_FALSE" '+(type==='TRUE_FALSE'?'selected':'')+'>True / False</option><option value="SHORT" '+(type==='SHORT'?'selected':'')+'>Short answer</option></select></div>'+
      options+'<div class="grid c2"><div class="field"><label>Correct answer</label>'+correct+'</div><div class="field"><label>Points</label><input id="eq_points_'+i+'" oninput="syncExamQuestion('+i+')" type="number" min="0.5" step="0.5" value="'+(q.points||1)+'"></div></div></div>';
  }).join('');
}
function syncExamQuestion(i){
  const q=window.__examQuestions[i];if(!q)return;
  q.text=$('#eq_text_'+i)?.value||q.text;q.type=$('#eq_type_'+i)?.value||q.type;q.points=Number($('#eq_points_'+i)?.value)||1;
  if(q.type==='MCQ')q.options=[0,1,2,3].map(j=>$('#eq_opt_'+i+'_'+j)?.value||q.options[j]||'');
  q.correct=$('#eq_correct_'+i)?.value||q.correct||'';
}
function changeExamType(i,type){syncExamQuestion(i);window.__examQuestions[i].type=type;if(type==='TRUE_FALSE')window.__examQuestions[i].correct='TRUE';renderExamQuestions()}
function examModal(existing=null){
  if(!can('MANAGE_EXAMS'))return;
  window.__examQuestions=existing?(existing.questions||[]).map(q=>({type:q.question_type,text:q.question_text,options:Array.isArray(q.options_json)?q.options_json:[],correct:q.correct_answer||'',points:Number(q.points)||1})):[{type:'MCQ',text:'',options:['','','',''],correct:'',points:1}];
  const x=existing?.exam||{};
  modal('<div class="modalhead"><h2>'+(existing?'Edit exam':'Create exam')+'</h2><button class="close" onclick="close()">×</button></div>'+
    '<form class="form" onsubmit="'+(existing?'updateExam(event,'+x.id+')':'createExam(event)')+'">'+
    '<div class="field"><label>Title</label><input id="examTitle" value="'+esc(x.title||'')+'" required></div>'+
    '<div class="field"><label>Subject</label><select id="examSubject">'+S.subjects.map(s=>'<option value="'+s.id+'" '+(Number(s.id)===Number(x.subject_id)?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select></div>'+
    '<div class="grid c2"><div class="field"><label>Start</label><input id="examStart" type="datetime-local" value="'+(x.starts_at?String(x.starts_at).slice(0,16):'')+'"></div><div class="field"><label>Deadline</label><input id="examEnd" type="datetime-local" value="'+(x.ends_at?String(x.ends_at).slice(0,16):'')+'"></div></div>'+
    '<div class="field"><label>Time limit (minutes)</label><input id="examDuration" type="number" min="1" value="'+(x.duration_minutes||'')+'"></div>'+
    '<div class="field"><label>Description</label><textarea id="examDesc" rows="3">'+esc(x.description||'')+'</textarea></div>'+
    '<div class="head"><h3>Questions</h3><button type="button" class="btn ghost" onclick="addExamQuestion()">＋ Add question</button></div><div id="examQuestions"></div>'+
    '<button class="btn primary">'+(existing?'Save exam ✓':'Publish exam →')+'</button></form>');
  renderExamQuestions();
}
async function editExamModal(id){
  try{const d=await api('/api/exams/'+id+'/edit');examModal(d)}catch(x){toast(x.message)}
}
async function updateExam(e,id){
  e.preventDefault();
  try{const questions=collectExamQuestions();await api('/api/admin/exams/'+id,{method:'PATCH',body:JSON.stringify({title:$('#examTitle').value,description:$('#examDesc').value,subjectId:Number($('#examSubject').value)||null,startsAt:$('#examStart').value||null,endsAt:$('#examEnd').value||null,durationMinutes:Number($('#examDuration').value)||null,questions})});close();await loadData();render();toast('Exam updated ✓')}catch(x){toast(x.message)}
}
async function deleteExam(id){if(!confirm('Delete this exam?'))return;try{await api('/api/admin/exams/'+id,{method:'DELETE'});await loadData();render();toast('Exam deleted ✓')}catch(x){toast(x.message)}}

function examsV(){
  return title(t('exams'),'Published exams and schedules.',can('MANAGE_EXAMS')?'<button class="btn primary" onclick="examModal()">＋ '+t('add')+'</button>':'')+
  '<div class="grid c2">'+(S.exams.map(e=>{
    const owner=Number(e.created_by)===Number(S.me?.id);
    const edit=can('MANAGE_EXAMS')&&(S.me?.role==='SUPER_ADMIN'||S.me?.role==='ADMIN'||owner);
    return '<article class="card exam-card"><div class="head"><span class="badge '+(e.status==='OPEN'?'good':e.status==='CLOSED'?'red':'warn')+'">'+esc(e.status||'SCHEDULED')+'</span><span class="muted">'+esc(e.subject_name||'')+'</span></div>'+
      '<h3>'+esc(e.title)+'</h3><p class="muted">'+esc(e.description||'')+'</p>'+
      '<div class="meter"><span>Starts</span><b>'+esc(e.starts_at||'Available now')+'</b></div>'+
      deadlineMarkup(e.starts_at,e.ends_at)+
      '<div class="meter"><span>Duration</span><b>'+(e.duration_minutes?esc(e.duration_minutes)+' min':'No limit')+'</b></div>'+
      '<div class="actions-row"><button class="btn primary" onclick="startExam('+e.id+')">Open exam →</button>'+
      (edit?'<button class="btn ghost" onclick="editExamModal('+e.id+')">Edit</button><button class="btn danger" onclick="deleteExam('+e.id+')">Delete</button>':'')+'</div></article>';
  }).join('')||'<div class="card empty">No exams have been published yet.</div>')+'</div>';
}

function showExamResult(result){
  const pct=Math.max(0,Math.min(100,Number(result.percent)||0));
  const r=50,c=2*Math.PI*r,dash=c*pct/100;
  modal('<div class="modalhead"><h2>Exam Result</h2><button class="close" onclick="close()">×</button></div>'+
    '<div class="score-wrap"><div class="score-ring"><svg viewBox="0 0 120 120"><circle class="score-bg" cx="60" cy="60" r="50"></circle><circle class="score-value" cx="60" cy="60" r="50" stroke-dasharray="'+dash+' '+c+'"></circle></svg><div class="score-number">'+pct+'<small>/100</small></div></div>'+
    '<h2 style="text-align:center;margin:12px 0 4px">'+esc(result.score)+' / '+esc(result.total)+'</h2><p class="muted" style="text-align:center">Your exam score</p></div>');
}
async function submitExam(auto=false){
  if(!window.__examRun)return;
  const answers={};
  for(const q of window.__examRun.questions||[]){
    if(q.question_type==='SHORT')answers[q.id]=$('#short_'+q.id)?.value||'';
    else answers[q.id]=document.querySelector('input[name="q_'+q.id+'"]:checked')?.value||'';
  }
  try{
    const d=await api('/api/exams/'+window.__examRun.exam.id+'/submit',{method:'POST',body:JSON.stringify({answers})});
    clearInterval(examTimerHandle);close();await loadData();render();showExamResult(d);
  }catch(x){toast(x.message);if(auto)close()}
}

function adminV(){
  if(!can('ADMIN_CENTER'))return '';
  const cards=[];
  if(can('MANAGE_ADMINS')||can('MANAGE_ROLES'))cards.push('<div class="card admin-card" onclick="go(\'permissions\')"><div class="ico">⚙</div><h3>People & Permissions</h3><p class="muted">Manage roles and separate permission tiles.</p><button class="btn ghost">Open →</button></div>');
  if(can('MANAGE_TEACHERS'))cards.push('<div class="card admin-card" onclick="teacherModal()"><div class="ico">👨‍🏫</div><h3>Teachers</h3><p class="muted">Add teachers and prepare their B4 activation keys.</p><button class="btn ghost">Manage →</button></div>');
  if(can('MANAGE_STUDENTS'))cards.push('<div class="card admin-card" onclick="adminStudentModal()"><div class="ico">♙</div><h3>Students</h3><p class="muted">Manage official B4 students.</p><button class="btn ghost">Manage →</button></div>');
  if(can('MANAGE_KEYS'))cards.push('<div class="card admin-card" onclick="activationModal(true)"><div class="ico">🔑</div><h3>Activation Keys</h3><p class="muted">Create one-time keys for students and teachers.</p><button class="btn ghost">Manage →</button></div>');
  if(can('MANAGE_ASSIGNMENTS'))cards.push('<div class="card admin-card" onclick="assignmentModal()"><div class="ico">✓</div><h3>Assignments</h3><p class="muted">Create and edit teacher-owned assignments.</p><button class="btn ghost">Manage →</button></div>');
  if(can('MANAGE_RESOURCES'))cards.push('<div class="card admin-card" onclick="resourceModal()"><div class="ico">▤</div><h3>Resources & PDFs</h3><p class="muted">Publish study links and PDF files.</p><button class="btn ghost">Manage →</button></div>');
  if(can('MANAGE_EXAMS'))cards.push('<div class="card admin-card" onclick="examModal()"><div class="ico">⌁</div><h3>Exam Center</h3><p class="muted">Timed exams, hard deadlines and automatic scoring.</p><button class="btn ghost">Manage →</button></div>');
  if(can('MANAGE_SCHEDULE'))cards.push('<div class="card admin-card" onclick="scheduleModal()"><div class="ico">◫</div><h3>Schedule</h3><p class="muted">Edit the complete B4 weekly schedule.</p><button class="btn ghost">Manage →</button></div>');
  if(can('MANAGE_ANNOUNCEMENTS'))cards.push('<div class="card admin-card" onclick="announcementModal()"><div class="ico">◈</div><h3>Announcements</h3><p class="muted">Publish official class notices.</p><button class="btn ghost">Manage →</button></div>');
  if(can('VIEW_LOGS'))cards.push('<div class="card admin-card" onclick="logsModal()"><div class="ico">⌁</div><h3>Logs</h3><p class="muted">Activity and security events across the site.</p><button class="btn ghost">View →</button></div>');
  return title(t('admin'),'Everything for B4 administration in separate, clean sections.')+'<div class="grid c3 admin-grid">'+cards.join('')+'</div>';
}

function loginModal(){
  modal('<div class="modalhead"><h2>'+t('login')+'</h2><button class="close" onclick="close()">×</button></div>'+
    '<form class="form" onsubmit="login(event)"><div class="field"><label>Display name / Login</label><input id="loginName" required autocomplete="username"></div><div class="field"><label>'+t('password')+'</label><input id="loginPassword" type="password" required autocomplete="current-password"></div><button class="btn primary">'+t('login')+' →</button></form>'+
    '<button class="btn google-btn" style="width:100%;margin-top:12px" onclick="googleLogin()">Continue with Google</button>'+
    '<div class="notice" style="margin-top:14px">Google login only works when this Google account is already linked to an existing B4 account.</div>'+
    '<button class="btn ghost" style="margin-top:10px" onclick="activationUserModal()">'+t('activate')+'</button>');
}
function googleLogin(){location.href=API_BASE+'/api/auth/google/login'}
function settingsV(){
  const google=S.linked.find(x=>x.provider==='GOOGLE');
  return title(t('settings'),'Personal preferences and account security.')+
    '<div class="grid c2"><div class="card"><h3>'+t('account')+'</h3><div class="form"><div class="field"><label>'+t('display')+'</label><input id="displayName" value="'+esc(S.me?.display_name||'')+'"></div><button class="btn primary" onclick="saveProfile()">'+t('save')+'</button><button class="btn ghost" onclick="passwordModal()">Change password</button></div></div>'+
    '<div class="card"><h3>Preferences</h3><div class="list"><button class="item quick" onclick="toggleTheme()"><span class="grow">Appearance</span><b>'+S.theme+'</b></button><button class="item quick" onclick="toggleLang()"><span class="grow">Language</span><b>'+S.lang+'</b></button><button class="item quick" onclick="installApp()"><span class="grow">'+t('install')+'</span>→</button></div></div>'+
    '<div class="card"><h3>'+t('linked')+'</h3><p class="muted">Google can be linked only to your existing B4 account.</p><div class="list"><div class="item"><span class="grow">Google</span>'+(google?'<span class="badge good">Linked</span><button class="btn danger" onclick="unlinkGoogle()">Unlink</button>':'<button class="btn primary" onclick="linkedGoogle()">Link Google</button>')+'</div><div class="item"><span class="grow">Discord</span><span class="badge">Not Available</span></div><div class="item"><span class="grow">Facebook</span><span class="badge">Not Available</span></div></div></div>'+
    '<div class="card"><h3>Session</h3><p class="muted">Persistent secure cookie session. Logging out ends the session.</p><button class="btn danger" onclick="logout()">'+t('logout')+'</button></div></div>';
}
async function unlinkGoogle(){try{await api('/api/auth/linked/GOOGLE',{method:'DELETE'});await loadMe();toast('Google unlinked ✓')}catch(x){toast(x.message)}}

const __oldStartExam=window.startExam;
async function startExam(id){
  try{
    const d=await api('/api/exams/'+id+'/start',{method:'POST'});window.__examRun=d;
    const q=d.questions||[];
    modal('<div class="modalhead"><h2>'+esc(d.exam.title)+'</h2><span id="examTimer" class="badge red">--:--</span><button class="close" onclick="close()">×</button></div>'+
      '<div class="exam-run-list">'+q.map((x,i)=>'<div class="card exam-run-question"><b>'+(i+1)+'. '+esc(x.question_text)+'</b>'+
      (x.question_type==='MCQ'?'<div class="list" style="margin-top:10px">'+(x.options_json||[]).map(o=>'<label class="item"><input type="radio" name="q_'+x.id+'" value="'+esc(o)+'"> <span>'+esc(o)+'</span></label>').join('')+'</div>':
      x.question_type==='TRUE_FALSE'?'<div class="list" style="margin-top:10px"><label class="item"><input type="radio" name="q_'+x.id+'" value="TRUE"> True</label><label class="item"><input type="radio" name="q_'+x.id+'" value="FALSE"> False</label></div>':
      '<textarea id="short_'+x.id+'" rows="4" style="margin-top:10px" placeholder="Your answer..."></textarea>')+
      '</div>').join('')+'</div><button class="btn primary" onclick="submitExam()">Submit exam</button>');
    startExamTimer(new Date(d.attempt.deadline).getTime());
  }catch(x){toast(x.message)}
}

views.assignments=tasksV;views.exams=examsV;views.admin=adminV;views.settings=settingsV;

/* Allow every authorized key manager to issue student/teacher activation keys. */
async function activationModal(){
  if(!can('MANAGE_KEYS')){toast('You do not have permission to manage activation keys');return}
  let keys=[],people={students:[],teachers:[]};
  try{
    keys=(await api('/api/admin/activation-keys')).keys||[];
    people=await api('/api/admin/people');
  }catch(e){toast(e.message);return}
  const opts=[...(people.students||[]).map(p=>'<option value="STUDENT:'+p.id+'">Student • '+esc(p.display_name)+' ('+esc(p.student_code)+')</option>'),
    ...(people.teachers||[]).map(p=>'<option value="TEACHER:'+p.id+'">Teacher • '+esc(p.display_name)+' ('+esc(p.teacher_code||'')+')</option>')].join('');
  modal('<div class="modalhead"><h2>Activation Keys</h2><button class="close" onclick="close()">×</button></div>'+
    '<p class="muted">Create a one-time key for a B4 student or teacher.</p>'+
    '<form class="form" onsubmit="createKey(event)"><div class="field"><label>Person</label><select id="keyPerson" required>'+opts+'</select></div>'+
    '<button class="btn primary">Generate one-time key</button></form><hr style="border:0;border-top:1px solid var(--line);margin:18px 0">'+
    '<div class="list">'+(keys.map(k=>'<div class="item"><span class="grow"><b>'+esc(k.key_preview)+'</b><br><small class="muted">'+esc(k.person_name||'')+' • '+esc(k.person_type)+' • '+esc(k.status)+'</small></span><span class="badge">Hash only</span></div>').join('')||'<div class="empty">No active keys.</div>')+'</div>');
}

views.admin=adminV;views.settings=settingsV;views.assignments=tasksV;views.exams=examsV;

// Stable boot: render immediately, then hydrate the session/data without blocking the UI.
function b4BootError(message){
  console.error('[B4 boot]',message);
  const content=document.querySelector('#content');
  if(content) content.innerHTML='<div class="card notice"><b>B4 could not finish loading.</b><div class="muted">'+esc(message||'Unknown error')+'</div><button class="btn ghost" style="margin-top:12px" onclick="location.reload()">Reload</button></div>';
}
window.addEventListener('error',e=>b4BootError(e.error?.message||e.message||'JavaScript error'));
window.addEventListener('unhandledrejection',e=>b4BootError(e.reason?.message||String(e.reason||'Unhandled promise rejection')));

document.documentElement.dataset.theme=S.theme;
render();
deadlineTicker();
loadMe().catch(e=>b4BootError(e.message||e));
