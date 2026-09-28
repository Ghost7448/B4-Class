const state = {
  view: "dashboard",
  lang: localStorage.getItem("classhub-lang") || "en",
  theme: localStorage.getItem("classhub-theme") || "light",
  tasks: JSON.parse(localStorage.getItem("classhub-tasks") || "null") || [
    {id:1,title:"Networking Worksheet",subject:"Networking",due:"2026-09-29",done:false},
    {id:2,title:"English Presentation",subject:"English",due:"2026-10-01",done:false},
    {id:3,title:"Programming Lab",subject:"Programming",due:"2026-10-03",done:true}
  ],
  announcements: [
    {title:"Welcome to Class Hub",text:"Everything for our class is now organized in one place.",date:"Sep 27, 2026",tag:"Important"},
    {title:"Upcoming assessment",text:"Check the schedule and assignments section for the latest dates.",date:"Sep 26, 2026",tag:"Academic"},
    {title:"Class activity",text:"New gallery album is available.",date:"Sep 24, 2026",tag:"Event"}
  ]
};

const students = [
  ["Kareem Tarek","Class Rep","A2"],["Ahmed Ali","Student","A2"],["Youssef Mohamed","Student","A2"],
  ["Omar Hassan","Student","A2"],["Abdelrahman Samir","Student","A2"],["Mahmoud Adel","Student","A2"],
  ["Mariam Ahmed","Student","A2"],["Menna Khaled","Student","A2"]
];
const subjects = [
  ["Networking","Mr. Ahmed","12 lessons","82%"],["Programming","Ms. Salma","15 lessons","74%"],
  ["English","Mr. Mostafa","10 lessons","91%"],["Mathematics","Ms. Dina","14 lessons","79%"],
  ["Physics","Mr. Hany","12 lessons","68%"],["Technical Drawing","Ms. Aya","8 lessons","87%"]
];
const schedule = [
  ["Sunday","Networking","Programming","English","Mathematics"],
  ["Monday","Physics","Networking","Programming","English"],
  ["Tuesday","Mathematics","Technical Drawing","Networking","Physics"],
  ["Wednesday","Programming","English","Mathematics","Networking"],
  ["Thursday","Technical Drawing","Physics","Programming","Mathematics"]
];
const i18n = {
  en:{dashboard:"Dashboard",students:"Students",subjects:"Subjects",schedule:"Schedule",assignments:"Assignments",announcements:"Announcements",calendar:"Calendar",gallery:"Gallery",polls:"Polls",leaderboard:"Leaderboard",admin:"Admin",theme:"Dark mode",search:"Search everything...",welcome:"Welcome back, Kareem 👋",subtitle:"Your class, your schedule, your work — all in one place.",totalStudents:"Students",subjectsCount:"Subjects",pending:"Pending tasks",events:"Upcoming events",quick:"Quick overview",latest:"Latest announcements",today:"Today",viewAll:"View all",add:"Add new",done:"Done",pendingWord:"Pending",completed:"Completed",due:"Due",teacher:"Teacher",attendance:"Class activity",upcoming:"Upcoming",save:"Save",cancel:"Cancel",newAnnouncement:"New announcement",title:"Title",description:"Description",messageSaved:"Saved successfully",noResults:"No results found",light:"Light mode",dark:"Dark mode"},
  ar:{dashboard:"الرئيسية",students:"الطلاب",subjects:"المواد",schedule:"الجدول",assignments:"المهام",announcements:"الإعلانات",calendar:"التقويم",gallery:"المعرض",polls:"الاستطلاعات",leaderboard:"الترتيب",admin:"الإدارة",theme:"الوضع الليلي",search:"ابحث في الموقع...",welcome:"أهلاً يا كريم 👋",subtitle:"فصلك، جدولك، ومهامك — كله في مكان واحد.",totalStudents:"الطلاب",subjectsCount:"المواد",pending:"المهام المعلقة",events:"الأحداث القادمة",quick:"نظرة سريعة",latest:"آخر الإعلانات",today:"اليوم",viewAll:"عرض الكل",add:"إضافة",done:"تم",pendingWord:"معلق",completed:"مكتمل",due:"التسليم",teacher:"المدرس",attendance:"نشاط الفصل",upcoming:"القادم",save:"حفظ",cancel:"إلغاء",newAnnouncement:"إعلان جديد",title:"العنوان",description:"الوصف",messageSaved:"تم الحفظ بنجاح",noResults:"لا توجد نتائج",light:"الوضع النهاري",dark:"الوضع الليلي"}
};
const t=k=>i18n[state.lang][k]||k;

function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function avatar(name){return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7c3aed&color=fff&bold=true`}
function save(){localStorage.setItem("classhub-tasks",JSON.stringify(state.tasks))}
function toast(msg){const el=document.createElement("div");el.className="toast";el.textContent=msg;document.getElementById("toastContainer").appendChild(el);setTimeout(()=>el.remove(),2600)}
function openModal(html){document.getElementById("modal").innerHTML=html;document.getElementById("modalBackdrop").classList.add("show")}
function closeModal(){document.getElementById("modalBackdrop").classList.remove("show")}
document.getElementById("modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal()});

function render(){
  document.documentElement.lang=state.lang; document.documentElement.dir=state.lang==="ar"?"rtl":"ltr";
  document.body.classList.toggle("ar",state.lang==="ar");
  document.querySelectorAll("[data-i18n]").forEach(x=>x.textContent=t(x.dataset.i18n));
  document.querySelectorAll("[data-placeholder]").forEach(x=>x.placeholder=t(x.dataset.placeholder));
  document.getElementById("themeBtn").querySelector("span").textContent=state.theme==="dark"?t("light"):t("theme");
  document.getElementById("langBtn").lastElementChild.textContent=state.lang==="en"?"العربية":"English";
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.view===state.view));
  document.body.classList.toggle("dark",state.theme==="dark");
  document.documentElement.style.setProperty("--bg",state.theme==="dark"?"#100d16":"#f6f7fb");
  document.documentElement.style.setProperty("--surface",state.theme==="dark"?"#191421":"#fff");
  document.documentElement.style.setProperty("--surface2",state.theme==="dark"?"#241c30":"#f0f1f7");
  document.documentElement.style.setProperty("--text",state.theme==="dark"?"#f5f1fa":"#17131f");
  document.documentElement.style.setProperty("--muted",state.theme==="dark"?"#aaa0b7":"#716b7d");
  const fn=views[state.view]||views.dashboard; document.getElementById("content").innerHTML=fn();
  bindView();
}
const views={
dashboard:()=>`<div class="view-title"><div><div class="eyebrow">CLASS HUB • A2</div><h1>${t("welcome")}</h1><p>${t("subtitle")}</p></div><div class="actions"><button class="btn ghost" onclick="setView('calendar')">◷ ${t("upcoming")}</button><button class="btn primary" onclick="setView('admin')">＋ ${t("add")}</button></div></div>
<div class="hero"><div class="hero-row"><div><div class="eyebrow" style="color:#ddd">WE SCHOOL • CLASS A2</div><h1>Class Hub</h1><p>${state.lang==="ar"?"بوابة الفصل الذكية لكل الدراسة والأنشطة والتنظيم.":"The smart class portal for study, activities and organization."}</p><button class="btn" style="background:#fff;color:#6d28d9" onclick="setView('students')">${t("students")} →</button></div><img class="hero-logo" src="assets/logo.jpg"></div></div>
<div class="grid stats"><div class="card stat"><div><span class="muted">${t("totalStudents")}</span><div class="num">${students.length}</div></div><div class="icon">♙</div></div><div class="card stat"><div><span class="muted">${t("subjectsCount")}</span><div class="num">${subjects.length}</div></div><div class="icon">▣</div></div><div class="card stat"><div><span class="muted">${t("pending")}</span><div class="num">${state.tasks.filter(x=>!x.done).length}</div></div><div class="icon">✓</div></div><div class="card stat"><div><span class="muted">${t("events")}</span><div class="num">4</div></div><div class="icon">◷</div></div></div>
<div class="grid cards-2"><div class="card"><div class="section-head"><h3>${t("latest")}</h3><button class="btn ghost" onclick="setView('announcements')">${t("viewAll")}</button></div><div class="list">${state.announcements.map(a=>`<div class="list-item"><div class="icon" style="width:38px;height:38px;border-radius:12px;background:#7c3aed15;display:grid;place-items:center">◈</div><div class="grow"><b>${esc(a.title)}</b><div class="muted" style="font-size:12px;margin-top:3px">${esc(a.text)}</div></div><span class="badge">${esc(a.tag)}</span></div>`).join("")}</div></div>
<div class="card"><div class="section-head"><h3>${t("assignments")}</h3><button class="btn ghost" onclick="setView('assignments')">${t("viewAll")}</button></div><div class="list">${state.tasks.slice(0,4).map(task=>`<div class="list-item"><button class="icon-btn" style="width:34px;height:34px" onclick="toggleTask(${task.id})">${task.done?"✓":"○"}</button><div class="grow"><b>${esc(task.title)}</b><div class="muted" style="font-size:12px">${esc(task.subject)} • ${t("due")}: ${task.due}</div></div><span class="badge ${task.done?"green":"orange"}">${task.done?t("completed"):t("pendingWord")}</span></div>`).join("")}</div></div></div>`,
students:()=>`<div class="view-title"><div><div class="eyebrow">CLASS A2</div><h1>${t("students")}</h1><p>${students.length} ${t("totalStudents").toLowerCase()}</p></div><button class="btn primary" onclick="addStudent()">＋ ${t("add")}</button></div><div class="grid cards-3">${students.map((s,i)=>`<div class="card"><div class="list-item" style="border:0;padding:0"><img class="avatar" src="${avatar(s[0])}"><div class="grow"><b>${s[0]}</b><div class="muted">${s[1]}</div></div><span class="badge">${s[2]}</span></div><div style="margin-top:18px" class="muted">Activity level</div><div class="progress" style="margin-top:7px"><span style="width:${65+(i*4)%31}%"></span></div><div class="muted" style="font-size:11px;margin-top:7px">${65+(i*4)%31}% active</div></div>`).join("")}</div>`,
subjects:()=>`<div class="view-title"><div><div class="eyebrow">ACADEMICS</div><h1>${t("subjects")}</h1><p>${t("subtitle")}</p></div></div><div class="grid cards-3">${subjects.map(s=>`<div class="card"><div class="section-head"><h3>${s[0]}</h3><span class="badge">${s[3]}</span></div><p class="muted">${t("teacher")}: ${s[1]}</p><p class="muted">${s[2]}</p><div class="progress"><span style="width:${parseInt(s[3])}%"></span></div><div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px"><span>${t("attendance")}</span><b>${s[3]}</b></div></div>`).join("")}</div>`,
schedule:()=>`<div class="view-title"><div><div class="eyebrow">WEEKLY</div><h1>${t("schedule")}</h1><p>Sunday → Thursday</p></div></div><div class="card table-wrap"><table class="table"><thead><tr><th>Day</th><th>08:00</th><th>09:00</th><th>10:00</th><th>11:00</th></tr></thead><tbody>${schedule.map(r=>`<tr>${r.map((x,i)=>i===0?`<td><b class="day-pill">${x}</b></td>`:`<td><div class="event">${x}</div></td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
assignments:()=>`<div class="view-title"><div><div class="eyebrow">WORKSPACE</div><h1>${t("assignments")}</h1><p>${state.tasks.length} tasks</p></div><button class="btn primary" onclick="addTask()">＋ ${t("add")}</button></div><div class="grid cards-2">${state.tasks.map(task=>`<div class="card"><div class="section-head"><h3>${esc(task.title)}</h3><span class="badge ${task.done?"green":"orange"}">${task.done?t("completed"):t("pendingWord")}</span></div><p class="muted">${esc(task.subject)}</p><div style="display:flex;justify-content:space-between;font-size:12px;margin:15px 0"><span>${t("due")}</span><b>${task.due}</b></div><button class="btn ${task.done?"ghost":"primary"}" onclick="toggleTask(${task.id})">${task.done?"↶ "+t("pendingWord"):"✓ "+t("done")}</button></div>`).join("")}</div>`,
announcements:()=>`<div class="view-title"><div><div class="eyebrow">NEWS</div><h1>${t("announcements")}</h1><p>Class updates and important messages.</p></div><button class="btn primary" onclick="addAnnouncement()">＋ ${t("add")}</button></div><div class="grid">${state.announcements.map(a=>`<div class="card"><div class="section-head"><span class="badge">${esc(a.tag)}</span><span class="muted">${esc(a.date)}</span></div><h3>${esc(a.title)}</h3><p class="muted">${esc(a.text)}</p></div>`).join("")}</div>`,
calendar:()=>{const days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];return `<div class="view-title"><div><div class="eyebrow">SEPTEMBER 2026</div><h1>${t("calendar")}</h1><p>Events, exams and deadlines</p></div></div><div class="card"><div class="calendar">${days.map(d=>`<div class="muted" style="font-weight:800;padding:5px">${d}</div>`).join("")}${Array.from({length:30},(_,i)=>{let day=i+1;return `<div class="cal-day ${day===27?"today":""}"><b>${day}</b>${[3,8,15,22,27].includes(day)?`<div class="cal-event">${day===27?"Class event":"Academic event"}</div>`:""}</div>`}).join("")}</div></div>`},
gallery:()=>`<div class="view-title"><div><div class="eyebrow">MEMORIES</div><h1>${t("gallery")}</h1><p>Class activities and events.</p></div><button class="btn primary" onclick="toast('Gallery upload demo is ready')">＋ ${t("add")}</button></div><div class="grid gallery">${["Class Activity","Networking Lab","Team Challenge","School Event","Workshop","Project Day","Class Trip","Graduation Prep"].map(x=>`<div class="photo"><span>${x}</span></div>`).join("")}</div>`,
polls:()=>`<div class="view-title"><div><div class="eyebrow">VOICE</div><h1>${t("polls")}</h1><p>Let the class decide together.</p></div></div><div class="grid cards-2">${[["Which day works best for the class activity?",["Sunday","Tuesday","Thursday"]],["What should we add next?",["Study resources","Gallery","Class chat"]]].map((p,i)=>`<div class="card"><h3>${p[0]}</h3><div class="list">${p[1].map((x,j)=>`<button class="list-item" style="border:1px solid var(--line);cursor:pointer;color:var(--text)" onclick="vote(${i},${j},this)"><span class="grow">${x}</span><span class="badge">${[48,31,21][j]||10}%</span></button>`).join("")}</div></div>`).join("")}</div>`,
leaderboard:()=>`<div class="view-title"><div><div class="eyebrow">GAMIFICATION</div><h1>${t("leaderboard")}</h1><p>Points from activities and participation.</p></div></div><div class="card"><div class="list">${students.map((s,i)=>`<div class="list-item rank"><div class="rank-number">${i+1}</div><img class="avatar" src="${avatar(s[0])}"><div class="grow"><b>${s[0]}</b><div class="muted">Level ${Math.max(1,8-i)}</div></div><span class="badge">${980-i*71} XP</span></div>`).join("")}</div></div>`,
admin:()=>`<div class="view-title"><div><div class="eyebrow">CONTROL CENTER</div><h1>${t("admin")}</h1><p>Manage class content from one place.</p></div></div><div class="grid cards-3">${[["👥","Manage students","Add, edit and organize student profiles","students"],["📢","Manage announcements","Publish class news and updates","announcements"],["✓","Manage assignments","Create deadlines and track work","assignments"],["📅","Manage schedule","Update the weekly class timetable","schedule"],["📸","Manage gallery","Add event albums and memories","gallery"],["⚙","Site settings","Theme, language and class identity","settings"]].map(x=>`<div class="card"><div class="icon" style="width:50px;height:50px;border-radius:15px;background:#7c3aed15;display:grid;place-items:center;font-size:22px">${x[0]}</div><h3>${x[1]}</h3><p class="muted">${x[2]}</p><button class="btn ghost" onclick="${x[3]==="settings"?"openSettings()":"setView('"+x[3]+"')"}">Open →</button></div>`).join("")}</div>`
};

function setView(v){state.view=v;render();window.scrollTo({top:0,behavior:"smooth"});document.getElementById("sidebar").classList.remove("open")}
function toggleTask(id){const x=state.tasks.find(a=>a.id===id);if(x){x.done=!x.done;save();render();toast(t("messageSaved"))}}
function addTask(){openModal(`<div class="modal-head"><h2>${t("add")} ${t("assignments")}</h2><button class="close" onclick="closeModal()">×</button></div><form class="form" onsubmit="event.preventDefault();saveTask()"><div class="field"><label>${t("title")}</label><input id="taskTitle" required></div><div class="field"><label>${t("subjects")}</label><select id="taskSubject">${subjects.map(s=>`<option>${s[0]}</option>`).join("")}</select></div><div class="field"><label>${t("due")}</label><input id="taskDue" type="date" required></div><button class="btn primary">${t("save")}</button></form>`)}
function saveTask(){state.tasks.push({id:Date.now(),title:document.getElementById("taskTitle").value,subject:document.getElementById("taskSubject").value,due:document.getElementById("taskDue").value,done:false});save();closeModal();render();toast(t("messageSaved"))}
function addAnnouncement(){openModal(`<div class="modal-head"><h2>${t("newAnnouncement")}</h2><button class="close" onclick="closeModal()">×</button></div><form class="form" onsubmit="event.preventDefault();saveAnnouncement()"><div class="field"><label>${t("title")}</label><input id="annTitle" required></div><div class="field"><label>${t("description")}</label><textarea id="annText" required></textarea></div><button class="btn primary">${t("save")}</button></form>`)}
function saveAnnouncement(){state.announcements.unshift({title:document.getElementById("annTitle").value,text:document.getElementById("annText").value,date:new Date().toLocaleDateString(),tag:"New"});closeModal();render();toast(t("messageSaved"))}
function addStudent(){openModal(`<div class="modal-head"><h2>${t("add")} ${t("students")}</h2><button class="close" onclick="closeModal()">×</button></div><form class="form" onsubmit="event.preventDefault();toast('Demo: connect this form to your database for permanent student records');closeModal()"><div class="field"><label>Name</label><input required></div><div class="field"><label>Role</label><select><option>Student</option><option>Class Rep</option></select></div><button class="btn primary">${t("save")}</button></form>`)}
function vote(i,j,el){el.style.borderColor="var(--primary)";toast(state.lang==="ar"?"تم تسجيل تصويتك":"Your vote was recorded")}
function openSettings(){openModal(`<div class="modal-head"><h2>Settings</h2><button class="close" onclick="closeModal()">×</button></div><div class="list"><button class="list-item" onclick="toggleTheme();closeModal()"><span class="grow">${state.theme==="dark"?t("light"):t("dark")}</span>◐</button><button class="list-item" onclick="toggleLang();closeModal()"><span class="grow">Language / اللغة</span>文</button></div>`)}
function toggleTheme(){document.body.classList.add("theme-transition");state.theme=state.theme==="light"?"dark":"light";localStorage.setItem("classhub-theme",state.theme);setTimeout(()=>document.body.classList.remove("theme-transition"),600);render()}
function toggleLang(){document.body.classList.add("theme-transition");state.lang=state.lang==="en"?"ar":"en";localStorage.setItem("classhub-lang",state.lang);setTimeout(()=>document.body.classList.remove("theme-transition"),600);render()}
function bindView(){document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.onclick=()=>setView(b.dataset.view))}
document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.getElementById("themeBtn").onclick=toggleTheme;
document.getElementById("langBtn").onclick=toggleLang;
document.getElementById("mobileMenu").onclick=()=>document.getElementById("sidebar").classList.toggle("open");
document.getElementById("notificationBtn").onclick=()=>toast(state.lang==="ar"?"عندك 3 إشعارات جديدة":"You have 3 new notifications");
document.getElementById("profileBtn").onclick=()=>toast("Profile menu demo");
document.getElementById("globalSearch").addEventListener("input",e=>{
  const q=e.target.value.trim().toLowerCase(); if(!q)return;
  const match=[...document.querySelectorAll(".card,.list-item")].find(x=>x.textContent.toLowerCase().includes(q));
  if(match){match.scrollIntoView({behavior:"smooth",block:"center"});match.animate([{transform:"scale(1)"},{transform:"scale(1.02)"},{transform:"scale(1)"}],{duration:500})}
});
window.addEventListener("load",()=>{render();setTimeout(()=>document.getElementById("pageLoader").classList.add("hide"),550)});
