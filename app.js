const $=s=>document.querySelector(s);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const ava=n=>`https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=7c3aed&color=fff&bold=true`;

const S={
  lang:localStorage.chLang||'en',
  theme:localStorage.chTheme||'light',
  view:'dashboard',
  tasks:(()=>{
    try{
      const saved=JSON.parse(localStorage.chTasks||'null');
      return saved||[
        {id:1,title:'Networking Worksheet',sub:'Networking',due:'2026-09-29',done:false},
        {id:2,title:'English Presentation',sub:'English',due:'2026-10-01',done:false},
        {id:3,title:'Programming Lab',sub:'Programming',due:'2026-10-03',done:true}
      ];
    }catch{return [
      {id:1,title:'Networking Worksheet',sub:'Networking',due:'2026-09-29',done:false},
      {id:2,title:'English Presentation',sub:'English',due:'2026-10-01',done:false},
      {id:3,title:'Programming Lab',sub:'Programming',due:'2026-10-03',done:true}
    ]}
  })(),
  role:localStorage.chRole||'Student',
  notifications:JSON.parse(localStorage.chNotifications||'null')||[],
  attendance:JSON.parse(localStorage.chAttendance||'null')||[82,91,76,88,94,79,86,90],
  grades:JSON.parse(localStorage.chGrades||'null')||[84,91,76,88,93,81],
  msgs:[
    ['Ahmed','خلصتوا الـ Networking worksheet؟'],
    ['Mariam','لسه، هخلصه النهارده 😄'],
    ['Youssef','رفعت الملخص في Resources.']
  ]
};

const L={
  en:{dash:'Dashboard',students:'Students',subjects:'Subjects',schedule:'Schedule',tasks:'Assignments',resources:'Resources',exams:'Exam Center',news:'Announcements',cal:'Calendar',events:'Events',polls:'Polls',chat:'Class Chat',rank:'Leaderboard',card:'Student Card',analytics:'Analytics',admin:'Admin Center',grades:'Grades',attendance:'Attendance',notifications:'Notifications',login:'Login & Roles',academic:'ACADEMICS',community:'COMMUNITY',more:'MORE',themeD:'Dark mode',themeL:'Light mode',install:'Install App',search:'Search everything...',welcome:'Welcome back, Kareem 👋',sub:'Everything for Class A2 — organized, animated and easy to use.',add:'Add new',view:'View all',pending:'Pending',done:'Completed'},
  ar:{dash:'الرئيسية',students:'الطلاب',subjects:'المواد',schedule:'الجدول',tasks:'المهام',resources:'المصادر',exams:'مركز الامتحانات',news:'الإعلانات',cal:'التقويم',events:'الأحداث',polls:'الاستطلاعات',chat:'شات الفصل',rank:'الترتيب',card:'بطاقة الطالب',analytics:'الإحصائيات',admin:'مركز الإدارة',grades:'الدرجات',attendance:'الحضور',notifications:'الإشعارات',login:'الدخول والصلاحيات',academic:'الدراسة',community:'المجتمع',more:'المزيد',themeD:'الوضع الليلي',themeL:'الوضع النهاري',install:'تثبيت التطبيق',search:'ابحث في كل حاجة...',welcome:'أهلاً يا كريم 👋',sub:'كل حاجة لفصل A2 — منظمة ومتحركة وسهلة الاستخدام.',add:'إضافة',view:'عرض الكل',pending:'معلق',done:'مكتمل'}
};
const t=k=>L[S.lang][k]||k;

const students=['Kareem Tarek','Ahmed Ali','Youssef Mohamed','Omar Hassan','Abdelrahman Samir','Mahmoud Adel','Mariam Ahmed','Menna Khaled'];
const subjects=[['Networking','Mr. Ahmed',82],['Programming','Ms. Salma',74],['English','Mr. Mostafa',91],['Mathematics','Ms. Dina',79],['Physics','Mr. Hany',68],['Technical Drawing','Ms. Aya',87]];
const schedule=[['Sunday','Networking','Programming','English','Mathematics'],['Monday','Physics','Networking','Programming','English'],['Tuesday','Mathematics','Technical Drawing','Networking','Physics'],['Wednesday','Programming','English','Mathematics','Networking'],['Thursday','Technical Drawing','Physics','Programming','Mathematics']];
const news=[['Welcome to Class Hub','Everything for our class is now organized in one place.','Important'],['Upcoming assessment','Check Exam Center for the latest dates.','Academic'],['New gallery album','Class activity photos are now available.','Event']];

const nav=[
  ['dashboard','⌂','dash'],['g','','academic'],['students','♙','students'],['subjects','▣','subjects'],['schedule','◫','schedule'],['assignments','✓','tasks'],['resources','▤','resources'],['exams','⌁','exams'],['g','','community'],['announcements','◈','news'],['calendar','◷','cal'],['events','✦','events'],['polls','☷','polls'],['chat','◌','chat'],['g','','more'],['leaderboard','★','rank'],['card','▣','card'],['analytics','◒','analytics'],['grades','▤','grades'],['attendance','◉','attendance'],['notifications','♢','notifications'],['login','↪','login'],['admin','⚙','admin']
];

function buildNav(){
  return nav.map(x=>x[0]=='g'
    ? `<div class="nav-group">${t(x[2])}</div>`
    : `<button data-v="${x[0]}" class="${S.view===x[0]?'active':''}">${x[1]} <span>${t(x[2])}</span>${x[0]=='assignments'?`<em class="count">${S.tasks.filter(a=>!a.done).length}</em>`:''}</button>`
  ).join('');
}

function toast(m){
  const e=document.createElement('div');
  e.className='toast';
  e.textContent=m;
  $('#toast').append(e);
  setTimeout(()=>e.remove(),2500);
}
function save(){localStorage.chTasks=JSON.stringify(S.tasks)}
function close(){$('#back').classList.remove('show')}
function modal(h){
  $('#modal').innerHTML=`<div class="modal">${h}</div>`;
  $('#back').classList.add('show');
}
function go(v){
  S.view=v;
  render();
  window.scrollTo({top:0,behavior:'smooth'});
  $('#side').classList.remove('open');
}
function title(e,p,buttons=''){
  return `<div class="title"><div><div class="eyebrow">CLASS HUB • A2</div><h1>${e}</h1><p>${p}</p></div><div class="actions">${buttons}</div></div>`;
}

function dashboard(){
  return title(t('welcome'),t('sub'),`<button class="btn ghost" data-go="calendar">◷ ${t('cal')}</button><button class="btn primary" onclick="addTask()">＋ ${t('add')}</button>`)+`
  <div class="hero"><div class="hero-row"><div><div class="eyebrow" style="color:#ddd">WE SCHOOL • CLASS A2</div><h1>Class Hub Pro</h1><p>${S.lang==='ar'?'دراسة، مجتمع، أنشطة، نقاط، ملفات وذكاء اصطناعي في مكان واحد.':'Academics, community, activities, points, resources and AI in one place.'}</p><button class="btn" style="background:#fff;color:#6d28d9" onclick="aiModal()">✦ Ask Class AI</button></div><img src="assets/logo.jpg" alt="Class Hub" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect width=%22200%22 height=%22200%22 rx=%2245%22 fill=%22%237c3aed%22/%3E%3Ctext x=%22100%22 y=%22122%22 text-anchor=%22middle%22 font-size=%2282%22 font-family=%22Arial%22 font-weight=%22700%22 fill=%22white%22%3EA2%3C/text%3E%3C/svg%3E'"></div></div>
  <div class="grid stats">${[[students.length,t('students'),'♙'],[subjects.length,t('subjects'),'▣'],[S.tasks.filter(x=>!x.done).length,t('pending'),'✓'],[4,t('events'),'✦'],['1,240','XP','★']].map(x=>`<div class="card stat"><div><small>${x[1]}</small><b>${x[0]}</b></div><div class="ico">${x[2]}</div></div>`).join('')}</div>
  <div class="grid c3"><div class="card" style="grid-column:span 2"><div class="head"><h3>Latest announcements</h3><button class="btn ghost" data-go="announcements">${t('view')}</button></div><div class="list">${news.map(x=>`<div class="item"><div class="ico">◈</div><div class="grow"><b>${x[0]}</b><div class="muted" style="font-size:11px">${x[1]}</div></div><span class="badge">${x[2]}</span></div>`).join('')}</div></div>
  <div class="card"><div class="head"><h3>🟢 LIVE NOW</h3><span class="badge good">LIVE</span></div><h2>Networking</h2><p class="muted">Mr. Ahmed • Lab 2</p><div class="meter"><span>Ends in</span><b id="time">32:15</b></div><div class="barline"><span style="width:68%"></span></div><button class="btn primary" style="margin-top:14px" onclick="toast('Live class mode opened')">Open Live Mode →</button></div></div>
  <div class="grid c2" style="margin-top:16px"><div class="card"><div class="head"><h3>⚡ Quick Actions</h3></div><div class="grid c3">${[['✦','Ask AI','aiModal()'],['📁','Resources',"go('resources')"],['🗳','Vote',"go('polls')"],['🪪','My Card',"go('card')"],['📅','Calendar',"go('calendar')"],['💬','Chat',"go('chat')"]].map(x=>`<button class="item quick" onclick="${x[2]}"><b>${x[0]}</b><span class="grow">${x[1]}</span>→</button>`).join('')}</div></div><div class="card"><div class="head"><h3>🎯 Weekly Challenge</h3><span class="badge">+100 XP</span></div><h3>Complete 3 assignments</h3><div class="meter"><span>Progress</span><b>2 / 3</b></div><div class="barline"><span style="width:67%"></span></div><p class="muted">One more task to unlock the badge.</p></div></div>`;
}

function studentsV(){
  return title(t('students'),`${students.length} students`,`<button class="btn primary" onclick="addStudent()">＋ ${t('add')}</button>`)+`<div class="grid c3">${students.map((n,i)=>`<div class="card"><div class="item" style="padding:0;border:0"><img class="avatar" src="${ava(n)}"><div class="grow"><b>${n}</b><div class="muted">${i?'Student':'Class Rep'}</div></div><span class="badge">A2</span></div><div class="meter"><span>Activity</span><b>${65+i*4}%</b></div><div class="barline"><span style="width:${65+i*4}%"></span></div><div style="margin-top:12px"><span class="badge">Level ${9-i%5}</span> <span class="badge">★ ${1240-i*77} XP</span></div></div>`).join('')}</div>`;
}
function subjectsV(){
  return title(t('subjects'),'Progress and activity by subject.')+`<div class="grid c3">${subjects.map(s=>`<div class="card"><div class="head"><h3>${s[0]}</h3><span class="badge">${s[2]}%</span></div><p class="muted">Teacher: ${s[1]}</p><div class="meter"><span>Progress</span><b>${s[2]}%</b></div><div class="barline"><span style="width:${s[2]}%"></span></div><button class="btn ghost" style="margin-top:13px" data-go="resources">Open resources →</button></div>`).join('')}</div>`;
}
function scheduleV(){
  return title(t('schedule'),'Sunday → Thursday')+`<div class="card tablewrap"><table class="table"><thead><tr><th>DAY</th><th>08:00</th><th>09:00</th><th>10:00</th><th>11:00</th></tr></thead><tbody>${schedule.map(r=>`<tr>${r.map((x,i)=>i?`<td><div class="classblock">${x}</div></td>`:`<td><b>${x}</b></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function tasksV(){
  return title(t('tasks'),'Deadlines, completion and progress.',`<button class="btn primary" onclick="addTask()">＋ ${t('add')}</button>`)+`<div class="grid c2">${S.tasks.map(x=>`<div class="card"><div class="head"><h3>${esc(x.title)}</h3><span class="badge ${x.done?'good':'warn'}">${x.done?t('done'):t('pending')}</span></div><p class="muted">${esc(x.sub)}</p><div class="meter"><span>Due</span><b>${x.due}</b></div><button class="btn ${x.done?'ghost':'primary'}" onclick="toggleTask(${x.id})">${x.done?'↶ Pending':'✓ Complete'}</button></div>`).join('')}</div>`;
}
function resourcesV(){
  const a=[['Networking','📄','Lesson 01 PDF'],['Networking','📝','Revision Questions'],['Programming','💻','Code Examples'],['English','📄','Presentation Guide'],['Mathematics','🧮','Formula Sheet'],['Physics','📄','Chapter Summary'],['Technical Drawing','📐','Workshop Notes'],['All Subjects','⭐','Shared Favorites'],['Exam Prep','🎯','Practice Pack']];
  return title(t('resources'),'Smart library for notes and revision.',`<button class="btn primary" onclick="toast('Upload demo opened')">＋ Upload</button>`)+`<div class="grid c3">${a.map(x=>`<div class="card"><div style="font-size:25px">${x[1]}</div><h3>${x[0]}</h3><p class="muted">${x[2]}</p><button class="btn ghost" onclick="toast('Demo resource opened')">Open →</button></div>`).join('')}</div>`;
}
function examsV(){
  return title(t('exams'),'Schedule, countdown and practice quizzes.')+`<div class="grid c2"><div class="card"><span class="badge red">NEXT EXAM</span><h2>Networking</h2><p class="muted">October 5, 2026 • 09:00</p><div style="font-size:31px;font-weight:900;margin:18px 0">07d 03h 12m</div><button class="btn primary" onclick="toast('Practice quiz opened')">Start Practice Quiz</button></div><div class="card"><h3>Preparation</h3>${subjects.slice(0,4).map((s,i)=>`<div style="margin:14px 0"><div class="meter"><span>${s[0]}</span><b>${[82,67,73,91][i]}%</b></div><div class="barline"><span style="width:${[82,67,73,91][i]}%"></span></div></div>`).join('')}</div></div>`;
}
function newsV(){
  return title(t('news'),'Class updates and important messages.',`<button class="btn primary" onclick="addNews()">＋ ${t('add')}</button>`)+`<div class="grid">${news.map(x=>`<div class="card"><div class="head"><span class="badge">${x[2]}</span><span class="muted">Sep 27, 2026</span></div><h3>${x[0]}</h3><p class="muted">${x[1]}</p></div>`).join('')}</div>`;
}
function calV(){
  const wd=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return title(t('cal'),'Events, exams and deadlines.',`<button class="btn primary" onclick="toast('Event creation demo')">＋ ${t('add')}</button>`)+`<div class="card"><div class="calendar">${wd.map(x=>`<div class="weekday">${x}</div>`).join('')}${Array.from({length:30},(_,i)=>{const d=i+1;return `<div class="day ${d==27?'today':''}"><b>${d}</b>${[3,8,15,22,27].includes(d)?`<div class="dayevent">${d==27?'Class Event':'Academic'}</div>`:''}</div>`}).join('')}</div></div>`;
}
function eventsV(){
  const a=[['SEP 30','Networking Workshop','Lab 2','28 attending'],['OCT 04','Class Activity','School Yard','19 attending'],['OCT 12','Team Challenge','Room A2','32 attending'],['OCT 20','Class Trip','TBA','Coming soon']];
  return title(t('events'),'Trips, workshops and team activities.',`<button class="btn primary" onclick="toast('Create event demo')">＋ ${t('add')}</button>`)+`<div class="grid c3">${a.map(x=>`<div class="card"><span class="badge">${x[0]}</span><h3>${x[1]}</h3><p class="muted">📍 ${x[2]}</p><span class="badge good">${x[3]}</span><br><button class="btn ghost" style="margin-top:13px" onclick="toast('RSVP saved ✓')">RSVP →</button></div>`).join('')}</div>`;
}
function pollsV(){
  const p=[['Which day works best for the activity?',['Sunday','Tuesday','Thursday']],['What should we build next?',['Study resources','Gallery','Class chat']]];
  return title(t('polls'),'Vote and let the class decide.')+`<div class="grid c2">${p.map(x=>`<div class="card"><h3>${x[0]}</h3><div class="list">${x[1].map((z,i)=>`<button class="item" style="color:var(--t);background:transparent" onclick="vote(this)"><span class="grow">${z}</span><span class="badge">${[48,31,21][i]}%</span></button>`).join('')}</div></div>`).join('')}</div>`;
}
function chatV(){
  return title(t('chat'),'Talk with the class.')+`<div class="card chat"><div class="messages" id="messages">${S.msgs.map((m,i)=>`<div class="msg ${i==S.msgs.length-1?'me':''}"><img class="avatar" src="${ava(m[0])}"><div><b style="font-size:10px">${m[0]}</b><div class="bubble">${esc(m[1])}</div></div></div>`).join('')}</div><form class="chatform" onsubmit="send(event)"><input id="chatInput" placeholder="${S.lang==='ar'?'اكتب رسالة...':'Write a message...'}"><button class="btn primary">➤</button></form></div>`;
}
function rankV(){
  return title(t('rank'),'XP from activities, assignments and participation.')+`<div class="card"><div class="list">${students.map((n,i)=>`<div class="item"><b style="width:28px">${i+1}</b><img class="avatar" src="${ava(n)}"><div class="grow"><b>${n}</b><div class="muted">Level ${9-i%5} • 🏆 Active</div></div><span class="badge">${1240-i*77} XP</span></div>`).join('')}</div></div>`;
}
function cardV(){
  return title(t('card'),'Digital student identity card.',`<button class="btn ghost" onclick="toast('Export demo')">⇩ Export</button>`)+`<div class="idcard"><div class="idtop"><div><b>CLASS HUB</b><small style="display:block;opacity:.7">WE SCHOOL • A2</small></div><img src="assets/logo.jpg" alt="Class Hub" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect width=%22200%22 height=%22200%22 rx=%2245%22 fill=%22%237c3aed%22/%3E%3Ctext x=%22100%22 y=%22122%22 text-anchor=%22middle%22 font-size=%2282%22 font-family=%22Arial%22 font-weight=%22700%22 fill=%22white%22%3EA2%3C/text%3E%3C/svg%3E'"></div><div class="idperson"><img src="${ava('Kareem Tarek')}"><div><b style="font-size:23px">Kareem Tarek</b><div style="opacity:.75">Student • Class A2</div><span class="badge" style="margin-top:8px;background:#fff2;color:#fff">ID: A2-001</span></div></div><div style="display:flex;justify-content:space-between;align-items:end"><div>🏆 ⭐ 🚀 🎯</div><div class="qr"></div></div></div>`;
}
function analyticsV(){
  return title(t('analytics'),'Demo class activity insights.')+`<div class="grid c3">${[['Assignments',[42,58,51,72,68,84,91]],['Participation',[30,45,38,64,57,77,86]],['Resources',[25,42,60,54,70,79,88]]].map(x=>`<div class="card"><h3>${x[0]}</h3><div class="chart">${x[1].map((n,i)=>`<i style="height:${n}%;animation-delay:${i*.08}s"><span>${n}</span></i>`).join('')}</div><p class="muted">Last 7 activity points</p></div>`).join('')}</div>`;
}
function adminV(){
  const a=[['👥','Students','Profiles, roles and groups','students'],['📢','Announcements','Publish class news','announcements'],['✓','Assignments','Deadlines and tracking','assignments'],['📅','Schedule','Weekly timetable','schedule'],['📁','Resources','Study materials','resources'],['🛡','Roles & Permissions','Admin / Teacher / Rep / Student','roles'],['📊','Analytics','Activity insights','analytics'],['🎨','Theme Studio','Colors and identity','theme'],['📊','Grades','Averages and student progress','grades'],['◉','Attendance','Daily attendance tracking','attendance'],['🔔','Notifications','Class reminders and updates','notifications'],['↪','Login & Roles','Demo role-based access','login'],['⌁','Activity Logs','Important admin actions','logs']];
  return title(t('admin'),'Manage the class experience.',`<span class="badge good">● SYSTEM ONLINE</span>`)+`<div class="grid c3">${a.map(x=>`<div class="card"><div style="font-size:25px">${x[0]}</div><h3>${x[1]}</h3><p class="muted">${x[2]}</p><button class="btn ghost" onclick="${x[3]=='roles'?'roles()':x[3]=='theme'?'themes()':x[3]=='logs'?'logs()':`go('${x[3]}')`}">Open →</button></div>`).join('')}</div>`;
}


function gradesV(){
  const rows=students.map((n,i)=>[n,S.grades[i%S.grades.length],['A','A+','B+','A-','B','A+','B+','A'][i%8]]);
  return title(t('grades'),'Grades, averages and academic progress.',`<button class="btn primary" onclick="addGrade()">＋ Add grade</button>`)+`<div class="grid c3"><div class="card"><small>Class Average</small><b style="font-size:30px">${Math.round(S.grades.reduce((a,b)=>a+b,0)/S.grades.length)}%</b><p class="muted">Across current demo subjects</p></div><div class="card"><small>Highest</small><b style="font-size:30px">${Math.max(...S.grades)}%</b><p class="muted">Current record</p></div><div class="card"><small>Passing</small><b style="font-size:30px">${Math.round(S.grades.filter(x=>x>=50).length/S.grades.length*100)}%</b><p class="muted">Students above 50%</p></div></div><div class="card tablewrap" style="margin-top:16px"><table class="table"><thead><tr><th>STUDENT</th><th>AVERAGE</th><th>LEVEL</th><th>PROGRESS</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${r[0]}</b></td><td>${r[1]}%</td><td><span class="badge">${r[2]}</span></td><td><div class="barline"><span style="width:${r[1]}%"></span></div></td></tr>`).join('')}</tbody></table></div>`;
}
function attendanceV(){
  const rows=students.map((n,i)=>[n,S.attendance[i%S.attendance.length]]);
  return title(t('attendance'),'Attendance tracking for the class.',`<button class="btn primary" onclick="markAttendance()">＋ Mark attendance</button>`)+`<div class="grid c3"><div class="card"><small>Class Attendance</small><b style="font-size:30px">${Math.round(S.attendance.reduce((a,b)=>a+b,0)/S.attendance.length)}%</b><p class="muted">Overall demo rate</p></div><div class="card"><small>Present</small><b style="font-size:30px">${S.attendance.filter(x=>x>=80).length}/${students.length}</b><p class="muted">Regular attendance</p></div><div class="card"><small>Needs attention</small><b style="font-size:30px">${S.attendance.filter(x=>x<80).length}</b><p class="muted">Below 80%</p></div></div><div class="card" style="margin-top:16px"><div class="list">${rows.map(r=>`<div class="item"><img class="avatar" src="${ava(r[0])}"><div class="grow"><b>${r[0]}</b><div class="barline"><span style="width:${r[1]}%"></span></div></div><span class="badge ${r[1]>=80?'good':'warn'}">${r[1]}%</span></div>`).join('')}</div></div>`;
}
function notificationsV(){
  const n=S.notifications.length?S.notifications:[['Assignment deadline','Networking Worksheet is due tomorrow','Today'],['New resource','A new Programming resource was added','Today'],['Class event','Thursday activity RSVP is open','Yesterday']];
  return title(t('notifications'),'Your class updates and reminders.',`<button class="btn ghost" onclick="clearNotifications()">Clear all</button>`)+`<div class="card"><div class="list">${n.map(x=>`<div class="item"><div class="ico">♢</div><div class="grow"><b>${esc(x[0])}</b><div class="muted">${esc(x[1])}</div></div><small class="muted">${esc(x[2])}</small></div>`).join('')}</div></div>`;
}
function loginV(){
  return title(t('login'),'Demo login and role switching. Real authentication will be connected to the backend later.')+`<div class="grid c2"><div class="card"><h3>Sign in</h3><p class="muted">Use this demo panel to preview role-based screens.</p><div class="form"><div class="field"><label>Email</label><input id="loginEmail" placeholder="student@classhub.local"></div><div class="field"><label>Password</label><input type="password" placeholder="••••••••"></div><button class="btn primary" onclick="demoLogin()">Sign in →</button></div></div><div class="card"><h3>Current role</h3><div class="role-pill">${S.role}</div><p class="muted">Switching roles only changes the demo UI. Server-side permissions require a backend.</p><div class="grid c2">${['Student','Teacher','Class Rep','Super Admin'].map(r=>`<button class="btn ${S.role===r?'primary':'ghost'}" onclick="setRole('${r}')">${r}</button>`).join('')}</div></div></div>`;
}
function commandCenter(){
  modal(`<div class="modalhead"><h2>⌘ Command Center</h2><button class="close" onclick="close()">×</button></div><p class="muted">Quickly jump anywhere in Class Hub.</p><input id="cmd" autofocus placeholder="Search pages, actions..." oninput="filterCommands()"><div id="cmdList" class="list" style="margin-top:12px">${[['dashboard','Dashboard'],['students','Students'],['assignments','Assignments'],['grades','Grades'],['attendance','Attendance'],['resources','Resources'],['exams','Exam Center'],['chat','Class Chat'],['analytics','Analytics'],['admin','Admin Center']].map(x=>`<button class="item cmditem" onclick="close();go('${x[0]}')"><span class="grow">${x[1]}</span>→</button>`).join('')}</div>`);
}
function filterCommands(){
  const q=($('#cmd')?.value||'').toLowerCase();
  document.querySelectorAll('.cmditem').forEach(x=>x.style.display=x.textContent.toLowerCase().includes(q)?'flex':'none');
}
function demoLogin(){toast('Demo sign-in successful ✓');setRole(S.role)}
function setRole(r){S.role=r;localStorage.chRole=r;render();toast(`${r} mode enabled ✓`)}
function clearNotifications(){S.notifications=[];localStorage.chNotifications='[]';render();toast('Notifications cleared ✓')}
function addGrade(){modal(`<div class="modalhead"><h2>Add Grade</h2><button class="close" onclick="close()">×</button></div><form class="form" onsubmit="event.preventDefault();const v=+$('#gradeValue').value;if(v>=0&&v<=100){S.grades.push(v);localStorage.chGrades=JSON.stringify(S.grades);close();render();toast('Grade added ✓')}else toast('Enter a value from 0 to 100')"><div class="field"><label>Student</label><select>${students.map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Grade</label><input id="gradeValue" type="number" min="0" max="100" required></div><button class="btn primary">Save grade</button></form>`)}
function markAttendance(){modal(`<div class="modalhead"><h2>Mark Attendance</h2><button class="close" onclick="close()">×</button></div><p class="muted">Demo action — choose a status to simulate today's attendance.</p><div class="grid c2"><button class="btn primary" onclick="close();toast('All students marked present ✓')">✓ Present</button><button class="btn ghost" onclick="close();toast('Attendance saved with absences ✓')">× Absent</button></div>`)}

const views={dashboard,students:studentsV,subjects:subjectsV,schedule:scheduleV,assignments:tasksV,resources:resourcesV,exams:examsV,announcements:newsV,calendar:calV,events:eventsV,polls:pollsV,chat:chatV,leaderboard:rankV,card:cardV,analytics:analyticsV,grades:gradesV,attendance:attendanceV,notifications:notificationsV,login:loginV,admin:adminV};

function render(){
  document.documentElement.dir=S.lang==='ar'?'rtl':'ltr';
  document.documentElement.lang=S.lang==='ar'?'ar':'en';
  document.body.classList.toggle('ar',S.lang==='ar');
  document.body.classList.toggle('dark',S.theme==='dark');
  $('#nav').innerHTML=buildNav();
  $('#theme span').textContent=S.theme==='dark'?t('themeL'):t('themeD');
  $('#lang span').textContent=S.lang==='en'?'العربية':'English';
  $('#search').placeholder=t('search');
  $('#content').innerHTML=`<div class="page">${views[S.view]()}</div>`;
  bind();
}
function bind(){
  document.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>go(b.dataset.v));
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
}

function toggleTask(id){
  const x=S.tasks.find(a=>a.id===id);
  if(!x)return;
  x.done=!x.done;
  save();
  render();
  toast('Task updated ✓');
}
function addTask(){
  modal(`<div class="modalhead"><h2>Add Assignment</h2><button class="close" onclick="close()">×</button></div><form class="form" onsubmit="saveTask(event)"><div class="field"><label>Title</label><input id="tt" required></div><div class="field"><label>Subject</label><select id="ts">${subjects.map(x=>`<option>${x[0]}</option>`).join('')}</select></div><div class="field"><label>Due</label><input id="td" type="date" required></div><button class="btn primary">Save</button></form>`);
}
function saveTask(e){
  e.preventDefault();
  S.tasks.push({id:Date.now(),title:$('#tt').value,sub:$('#ts').value,due:$('#td').value,done:false});
  save();
  close();
  render();
  toast('Saved ✓');
}
function addNews(){
  modal(`<div class="modalhead"><h2>New Announcement</h2><button class="close" onclick="close()">×</button></div><form class="form" onsubmit="event.preventDefault();close();toast('Announcement published ✓')"><div class="field"><label>Title</label><input required></div><div class="field"><label>Message</label><textarea required></textarea></div><button class="btn primary">Save</button></form>`);
}
function addStudent(){
  modal(`<div class="modalhead"><h2>Add Student</h2><button class="close" onclick="close()">×</button></div><form class="form" onsubmit="event.preventDefault();close();toast('Student added in demo mode ✓')"><div class="field"><label>Name</label><input required></div><div class="field"><label>Role</label><select><option>Student</option><option>Class Rep</option><option>Teacher</option></select></div><button class="btn primary">Save</button></form>`);
}
function vote(e){
  e.style.borderColor='var(--p)';
  e.style.transform='scale(1.02)';
  toast(S.lang==='ar'?'تم تسجيل تصويتك ✓':'Vote recorded ✓');
}
function send(e){
  e.preventDefault();
  const input=$('#chatInput');
  if(!input)return;
  const v=input.value.trim();
  if(!v)return;
  S.msgs.push(['Kareem',v]);
  render();
  toast('Message sent ✓');
}
function aiModal(){
  modal(`<div class="modalhead"><h2>✦ Class AI</h2><button class="close" onclick="close()">×</button></div><p class="muted">Ask about subjects, schedule or class resources.</p><div class="field"><label>Question</label><textarea id="aiq" placeholder="${S.lang==='ar'?'مثلاً: اشرحلي TDM بطريقة بسيطة':'Example: Explain TDM simply'}"></textarea></div><button class="btn primary" onclick="answerAI()">Ask AI →</button><div id="air" style="margin-top:14px"></div>`);
}
function answerAI(){
  const q=$('#aiq')?.value||'';
  const r=$('#air');
  if(!r)return;
  r.innerHTML=`<div class="card"><b>✦ Class AI</b><p class="muted">${q?`Demo answer: I can create an explanation, examples and revision plan for “${esc(q)}”. Connect a real AI API for live answers.`:'Write a question first.'}</p></div>`;
}
function roles(){
  modal(`<div class="modalhead"><h2>Roles & Permissions</h2><button class="close" onclick="close()">×</button></div><div class="list">${[['Super Admin','Everything'],['Teacher','Academics + announcements'],['Class Rep','Events + polls'],['Student','View + participate']].map(x=>`<div class="item"><b>${x[0]}</b><span class="grow muted">${x[1]}</span><span class="badge">Role</span></div>`).join('')}</div>`);
}
function logs(){
  modal(`<div class="modalhead"><h2>Activity Logs</h2><button class="close" onclick="close()">×</button></div><div class="list">${['Kareem opened Admin Center','Ahmed voted in a poll','Mariam opened Networking resources','Admin updated schedule','Youssef completed an assignment'].map((x,i)=>`<div class="item"><span class="badge">${i+1}</span><span class="grow">${x}</span><small class="muted">Today</small></div>`).join('')}</div>`);
}
function themes(){
  modal(`<div class="modalhead"><h2>Theme Studio</h2><button class="close" onclick="close()">×</button></div><div class="grid c3">${['#7c3aed','#2563eb','#db2777','#059669','#ea580c','#0891b2'].map(c=>`<button class="btn" style="height:65px;background:${c};color:white" onclick="accent('${c}')">${c}</button>`).join('')}</div>`);
}
function accent(c){
  document.documentElement.style.setProperty('--p',c);
  document.documentElement.style.setProperty('--p2',c);
  localStorage.chAccent=c;
  toast('Theme updated ✓');
}

$('#theme').onclick=()=>{
  S.theme=S.theme==='dark'?'light':'dark';
  localStorage.chTheme=S.theme;
  render();
  document.body.animate([{opacity:.65},{opacity:1}],{duration:500,easing:'ease-out'});
};

$('#lang').onclick=()=>{
  S.lang=S.lang==='en'?'ar':'en';
  localStorage.chLang=S.lang;
  render();
  document.body.animate([{opacity:.65,transform:'scale(.99)'},{opacity:1,transform:'scale(1)'}],{duration:500,easing:'ease-out'});
};

$('#mobile').onclick=()=>$('#side').classList.toggle('open');
$('#bell').onclick=()=>toast(S.lang==='ar'?'عندك 3 إشعارات جديدة 🔔':'You have 3 new notifications 🔔');
$('#ai').onclick=aiModal;
$('#profile').onclick=()=>go('card');
$('#back').onclick=e=>{if(e.target.id==='back')close()};

document.addEventListener('mousemove',e=>{
  const glow=$('#glow');
  if(!glow)return;
  glow.style.left=e.clientX+'px';
  glow.style.top=e.clientY+'px';
});

$('#search').oninput=e=>{
  const q=e.target.value.toLowerCase().trim();
  if(!q)return;
  const x=[...document.querySelectorAll('.card,.item')].find(a=>a.textContent.toLowerCase().includes(q));
  if(x){x.scrollIntoView({behavior:'smooth',block:'center'});x.animate([{transform:'scale(1)'},{transform:'scale(1.025)'},{transform:'scale(1)'}],{duration:500});}
};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();commandCenter();}});


let promptInstall;
addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  promptInstall=e;
});

$('#install').onclick=async()=>{
  if(promptInstall){
    promptInstall.prompt();
    promptInstall=null;
  }else{
    toast(S.lang==='ar'?'استخدم قائمة المتصفح لتثبيت الموقع':'Use your browser menu to install the app');
  }
};

const ac=localStorage.chAccent;
if(ac)accent(ac);

let sec=1935;

setInterval(()=>{
  const e=$('#time');
  const m=$('#miniTime');
  if(!e&&!m)return;

  sec=sec>0?sec-1:1935;

  const minutes=Math.floor(sec/60);
  const seconds=sec%60;
  const z=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;

  if(e)e.textContent=z;
  if(m)m.textContent=z;
},1000);

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}

addEventListener('load',()=>{
  render();
  setTimeout(()=>$('#loader').classList.add('hide'),800);
});
