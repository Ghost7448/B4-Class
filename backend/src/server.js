import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('SESSION_SECRET must be set to at least 32 characters in production');
}
const PORT = Number(process.env.PORT || 3000);

const mysqlUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
const pool = mysqlUrl
  ? mysql.createPool({ uri: mysqlUrl, charset: 'utf8mb4' })
  : mysql.createPool({
      host: process.env.MYSQLHOST,
      port: Number(process.env.MYSQLPORT || 3306),
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4'
    });

const frontend = process.env.FRONTEND_URL || '';
const corsOptions = frontend
  ? { origin: frontend, credentials: true }
  : { origin: true, credentials: true };

app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (req,file,cb) => cb(null, file.mimetype === 'application/pdf') });

const MySQLStore = MySQLStoreFactory(session);
app.use(session({
  name: 'b4.sid',
  secret: process.env.SESSION_SECRET || 'CHANGE_ME_IN_RAILWAY',
  resave: false,
  saveUninitialized: false,
  store: new MySQLStore({
    clearExpired: true,
    checkExpirationInterval: 900000,
    expiration: 1000 * 60 * 60 * 24 * 30
  }, pool),
  cookie: {
    httpOnly: true,
    sameSite: process.env.FRONTEND_URL ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 30
  }
}));

const q = (sql, args = []) => pool.execute(sql, args);

async function audit(req, action, entityType = null, entityId = null, details = null) {
  try { await q('INSERT INTO activity_logs(actor_user_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)',[req.session?.userId||null,action,entityType,entityId,details==null?null:(typeof details==='string'?details:JSON.stringify(details))]); }
  catch(e){ console.error('Audit log failed:',e.message); }
}
async function assertTeacherOwner(req, table, id) {
  const [actor]=await q('SELECT role FROM users WHERE id=? LIMIT 1',[req.session.userId]);
  if(actor[0]?.role!=='TEACHER') return;
  const [rows]=await q(`SELECT created_by FROM ${table} WHERE id=? LIMIT 1`,[id]);
  if(!rows[0]||Number(rows[0].created_by)!==Number(req.session.userId)) throw Object.assign(new Error('Teachers can only manage their own content'),{statusCode:403});
}

const PERMISSION_DEFS = [
  ['MANAGE_ADMINS','Manage admins'],
  ['MANAGE_ACCOUNTS','Manage accounts'],
  ['MANAGE_KEYS','Manage activation keys'],
  ['MANAGE_TEACHERS','Manage teachers'],
  ['MANAGE_STUDENTS','Manage students'],
  ['MANAGE_ROLES','Manage roles & permissions'],
  ['MANAGE_SUBJECTS','Manage subjects'],
  ['MANAGE_SCHEDULE','Manage schedule'],
  ['MANAGE_ASSIGNMENTS','Manage assignments'],
  ['MANAGE_RESOURCES','Manage resources'],
  ['MANAGE_EXAMS','Manage exams'],
  ['MANAGE_ATTENDANCE','Manage attendance'],
  ['MANAGE_ANNOUNCEMENTS','Manage announcements'],
  ['MANAGE_CHAT','Moderate chat'],
  ['VIEW_LOGS','View security/activity logs'],
  ['USE_AI','Use B4 AI'],
  ['VIEW_CLASS','View class']
];

async function ensurePermissionSchema() {
  await q('CREATE TABLE IF NOT EXISTS resource_files( id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, resource_id BIGINT UNSIGNED NOT NULL, filename VARCHAR(255) NOT NULL, mime_type VARCHAR(120) NOT NULL DEFAULT \'application/pdf\', data MEDIUMBLOB NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE, INDEX idx_resource_files_resource(resource_id) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
  await q('CREATE TABLE IF NOT EXISTS user_permissions( user_id BIGINT UNSIGNED NOT NULL, permission_id INT UNSIGNED NOT NULL, granted_by BIGINT UNSIGNED NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,permission_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE, FOREIGN KEY(granted_by) REFERENCES users(id) ON DELETE SET NULL ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
  for (const [code,label] of PERMISSION_DEFS) await q('INSERT IGNORE INTO permissions(code,label) VALUES(?,?)',[code,label]);
  await q("INSERT IGNORE INTO role_permissions(role,permission_id) SELECT 'SUPER_ADMIN',id FROM permissions");
}

async function getPermissionCodes(userId) {
  const [users] = await q('SELECT role,status FROM users WHERE id=? LIMIT 1',[userId]);
  const user = users[0];
  if (!user || user.status !== 'ACTIVE') return [];
  if (user.role === 'SUPER_ADMIN') {
    const [all] = await q('SELECT code FROM permissions ORDER BY code');
    return all.map(x=>x.code);
  }
  const [rows] = await q('SELECT DISTINCT p.code FROM permissions p LEFT JOIN role_permissions rp ON rp.permission_id=p.id AND rp.role=? LEFT JOIN user_permissions up ON up.permission_id=p.id AND up.user_id=? WHERE rp.permission_id IS NOT NULL OR up.permission_id IS NOT NULL ORDER BY p.code',[user.role,userId]);
  return rows.map(x=>x.code);
}

const requireAuth = (req, res, next) => req.session.userId
  ? next()
  : res.status(401).json({ error: 'Login required' });
const requirePermission = permission => async (req,res,next) => {
  if (!req.session.userId) return res.status(401).json({error:'Login required'});
  try {
    const permissions=await getPermissionCodes(req.session.userId);
    if(!permissions.includes(permission)) return res.status(403).json({error:'Permission denied',permission});
    req.permissions=permissions; next();
  } catch(e) { console.error('Permission check failed:',e.message); res.status(500).json({error:'Permission check failed'}); }
};
const requireAnyPermission = permissions => async (req,res,next) => {
  if (!req.session.userId) return res.status(401).json({error:'Login required'});
  try {
    const granted=await getPermissionCodes(req.session.userId);
    if(!permissions.some(p=>granted.includes(p))) return res.status(403).json({error:'Permission denied'});
    req.permissions=granted; next();
  } catch(e) { console.error('Permission check failed:',e.message); res.status(500).json({error:'Permission check failed'}); }
};

async function userById(id) {
  const [r] = await q(
    `SELECT id,display_name,official_name,role,status,student_id,teacher_id,avatar_url
     FROM users WHERE id=? LIMIT 1`,
    [id]
  );
  if(!r[0]) return null;
  return {...r[0],permissions:await getPermissionCodes(id)};
}

app.get('/api/health', async (req, res) => {
  try {
    await q('SELECT 1');
    res.json({ ok: true, service: 'B4 backend', database: true });
  } catch (e) {
    console.error('Database health check failed:', e.message);
    res.status(500).json({ ok: false, database: false, error: 'Database connection failed' });
  }
});

async function getBootstrap(req) {
  const [students] = await q(`
    SELECT s.id,s.student_code,s.official_name,
           COALESCE(u.display_name,s.display_name) display_name,u.avatar_url
    FROM students s
    LEFT JOIN users u ON u.student_id=s.id AND u.status='ACTIVE'
    WHERE s.class_name='B4'
    ORDER BY s.display_name
  `);
  const [subjects] = await q(`SELECT id,name,teacher_name,progress FROM subjects WHERE class_name='B4' ORDER BY name`);
  const [assignments] = await q(`
    SELECT a.id,a.title,a.description,a.status,a.subject_id,a.due_at,a.created_by,s.name subject_name
    FROM assignments a LEFT JOIN subjects s ON s.id=a.subject_id
    WHERE a.class_name='B4' ORDER BY a.due_at IS NULL,a.due_at
  `);
  const [announcements] = await q(`
    SELECT id,title,body,category,created_at,created_by FROM announcements
    WHERE class_name='B4' ORDER BY created_at DESC LIMIT 20
  `);
  const [schedule] = await q(`SELECT day_name,p1,p2,p3,p4 FROM schedule WHERE class_name='B4' ORDER BY day_order`);
  const [resources] = await q(`
    SELECT r.id,r.title,r.description,r.url,r.created_by,
           COALESCE(r.file_url,CASE WHEN rf.id IS NOT NULL THEN CONCAT('/api/resources/files/',rf.id) END) file_url,
           rf.filename,r.resource_type,r.subject_id,s.name subject_name
    FROM resources r LEFT JOIN subjects s ON s.id=r.subject_id
    LEFT JOIN resource_files rf ON rf.resource_id=r.id
    WHERE r.class_name='B4' ORDER BY r.created_at DESC LIMIT 100
  `);
  const [exams] = await q(`
    SELECT e.id,e.title,e.description,e.subject_id,e.created_by,s.name subject_name,e.starts_at,e.ends_at,e.duration_minutes,e.status
    FROM exams e LEFT JOIN subjects s ON s.id=e.subject_id
    WHERE e.class_name='B4' ORDER BY e.starts_at IS NULL,e.starts_at
  `);
  let attendance=[],messages=[],notifications=[];
  if(req.session.userId) {
    [attendance]=await q(`SELECT date,status FROM attendance WHERE user_id=? ORDER BY date DESC LIMIT 60`,[req.session.userId]);
  }
  [messages]=await q(`
    SELECT m.id,m.body,m.created_at,m.edited_at,m.user_id,m.reply_to_id,
           COALESCE(u.display_name,'Deleted user') display_name,u.avatar_url,
           rm.body reply_body,ru.display_name reply_display_name
    FROM chat_messages m LEFT JOIN users u ON u.id=m.user_id
    LEFT JOIN chat_messages rm ON rm.id=m.reply_to_id
    LEFT JOIN users ru ON ru.id=rm.user_id
    WHERE m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 100
  `);
  messages.reverse();
  if(req.session.userId) {
    [notifications]=await q(`
      SELECT id,title,body,read_at,created_at FROM notifications
      WHERE user_id=? OR user_id IS NULL ORDER BY created_at DESC LIMIT 30
    `,[req.session.userId]);
  }
  if(!req.session.userId) return {students,subjects,schedule,assignments:[],announcements:[],resources:[],exams:[],attendance:[],messages:[],notifications:[]};
  return {students,subjects,schedule,assignments,announcements,resources,exams,attendance,messages,notifications};
}

app.get('/api/bootstrap', async (req, res) => {
  try {
    res.json(await getBootstrap(req));
  } catch (e) {
    console.error('Bootstrap failed:', e);
    res.status(500).json({ error: 'Could not load class data', detail: process.env.NODE_ENV === 'production' ? undefined : e.message });
  }
});

app.get('/api/students', async (req,res)=>{
  try {
    const [students]=await q(`SELECT s.id,s.student_code,s.official_name,COALESCE(u.display_name,s.display_name) display_name,u.avatar_url
      FROM students s LEFT JOIN users u ON u.student_id=s.id AND u.status='ACTIVE'
      WHERE s.class_name='B4' ORDER BY s.display_name`);
    res.json({students});
  } catch(e) {
    console.error('Students API failed:',e);
    res.status(500).json({error:'Could not load students',detail:process.env.NODE_ENV==='production'?undefined:e.message});
  }
});
app.get('/api/class-data', async (req,res)=>{
  try { res.json(await getBootstrap(req)); }
  catch(e) {
    console.error('Class data API failed:',e);
    res.status(500).json({error:'Could not load class data',detail:process.env.NODE_ENV==='production'?undefined:e.message});
  }
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const user = await userById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session expired' });
  res.json({ user });
});

app.post('/api/auth/activate', async (req, res) => {
  const { key, displayName, password } = req.body || {};
  if (!key || !displayName || !password || password.length < 8) {
    return res.status(400).json({ error: 'Key, display name and an 8+ character password are required' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const hash = crypto.createHash('sha256').update(String(key).trim()).digest('hex');
    const [keys] = await conn.execute(`
      SELECT * FROM activation_keys
      WHERE key_hash=? AND status='ACTIVE'
        AND (expires_at IS NULL OR expires_at>NOW()) FOR UPDATE
    `, [hash]);
    const k = keys[0];
    if (!k) throw new Error('Invalid, expired or already used activation key');

    const [existing] = await conn.execute(
      `SELECT id FROM users WHERE LOWER(display_name)=LOWER(?) LIMIT 1`,
      [displayName.trim()]
    );
    if (existing[0]) throw new Error('That display name is already in use');

    const identityColumn = k.person_type === 'TEACHER' ? 'teacher_id' : 'student_id';
    const [linked] = await conn.execute(
      `SELECT id FROM users WHERE ${identityColumn}=? LIMIT 1`,
      [k.person_type === 'TEACHER' ? k.teacher_id : k.student_id]
    );
    if (linked[0]) throw new Error('This B4 identity already has an account');

    const pw = await bcrypt.hash(password, 12);
    const [u] = await conn.execute(`
      INSERT INTO users(student_id,teacher_id,official_name,display_name,password_hash,role,status)
      VALUES(?,?,?,?,?,?,?)
    `, [
      k.student_id || null,
      k.teacher_id || null,
      k.official_name,
      displayName.trim(),
      pw,
      k.person_type === 'TEACHER' ? 'TEACHER' : 'STUDENT',
      'ACTIVE'
    ]);

    await conn.execute(
      `UPDATE activation_keys SET status='USED',used_at=NOW(),used_user_id=? WHERE id=?`,
      [u.insertId, k.id]
    );
    await conn.execute(`INSERT INTO security_logs(actor_user_id,action,details) VALUES(NULL,'ACTIVATION_USED',?)`,[`Account ${u.insertId} activated`]);
    await conn.execute(`INSERT INTO activity_logs(actor_user_id,action,entity_type,entity_id,details) VALUES(NULL,'ACCOUNT_ACTIVATED','user',?,?)`,[u.insertId,JSON.stringify({person_type:k.person_type})]);
    await conn.commit();
    res.json({ ok: true, message: 'Account created. You can now log in with your display name.' });
  } catch (e) {
    await conn.rollback();
    res.status(400).json({ error: e.message || 'Activation failed' });
  } finally {
    conn.release();
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { login, password } = req.body || {};
  const [rows] = await q(
    `SELECT * FROM users WHERE LOWER(display_name)=LOWER(?) AND status='ACTIVE' LIMIT 1`,
    [login || '']
  );
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password || '', u.password_hash))) {
    return res.status(401).json({ error: 'Invalid login or password' });
  }
  req.session.userId = u.id;
  req.session.role = u.role;
  await audit(req,'LOGIN','user',u.id);
  res.json({ ok: true, user: await userById(u.id) });
});

app.post('/api/auth/logout',(req,res)=>{const uid=req.session.userId;req.session.destroy(()=>{if(uid)q('INSERT INTO activity_logs(actor_user_id,action,entity_type,entity_id) VALUES(?,?,?,?)',[uid,'LOGOUT','user',uid]).catch(()=>{});res.json({ok:true});});});

app.post('/api/auth/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  const [r] = await q(`SELECT password_hash FROM users WHERE id=?`, [req.session.userId]);
  if (!r[0] || !(await bcrypt.compare(currentPassword || '', r[0].password_hash))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  await q(`UPDATE users SET password_hash=? WHERE id=?`, [await bcrypt.hash(newPassword, 12), req.session.userId]);
  await q(`INSERT INTO security_logs(actor_user_id,action,details) VALUES(?,?,?)`, [req.session.userId,'PASSWORD_CHANGED','User changed their password']);
  await audit(req,'PASSWORD_CHANGED','user',req.session.userId);
  res.json({ ok: true });
});

app.patch('/api/auth/profile', requireAuth, async (req, res) => {
  const { displayName } = req.body || {};
  if (!displayName || displayName.trim().length < 2) {
    return res.status(400).json({ error: 'Display name is too short' });
  }
  const [x] = await q(
    `SELECT id FROM users WHERE LOWER(display_name)=LOWER(?) AND id<>? LIMIT 1`,
    [displayName.trim(), req.session.userId]
  );
  if (x[0]) return res.status(400).json({ error: 'That display name is already in use' });
  await q(`UPDATE users SET display_name=? WHERE id=?`, [displayName.trim(), req.session.userId]);
  await audit(req,'PROFILE_UPDATED','user',req.session.userId,{displayName:displayName.trim()});
  res.json({ ok: true, user: await userById(req.session.userId) });
});

app.get('/api/admin/permissions', requireAnyPermission(['MANAGE_ROLES','MANAGE_ADMINS']), async (req,res)=>{
  const [permissions]=await q('SELECT id,code,label FROM permissions ORDER BY code');
  res.json({permissions});
});

app.get('/api/admin/users', requireAnyPermission(['MANAGE_ROLES','MANAGE_ADMINS']), async (req,res)=>{
  const [users]=await q('SELECT id,display_name,official_name,role,status,student_id,teacher_id FROM users ORDER BY display_name');
  const result=[];
  for(const u of users){
    const [direct]=await q('SELECT p.code FROM user_permissions up JOIN permissions p ON p.id=up.permission_id WHERE up.user_id=? ORDER BY p.code',[u.id]);
    result.push({...u,direct_permissions:direct.map(x=>x.code),effective_permissions:await getPermissionCodes(u.id)});
  }
  res.json({users:result});
});

app.put('/api/admin/users/:id/permissions', requireAnyPermission(['MANAGE_ROLES','MANAGE_ADMINS']), async (req,res)=>{
  const targetId=Number(req.params.id);
  const codes=Array.isArray(req.body?.permissionCodes)?[...new Set(req.body.permissionCodes.map(String))]:[];
  if(!Number.isSafeInteger(targetId)) return res.status(400).json({error:'Invalid user id'});
  const [targetRows]=await q('SELECT id,role,status FROM users WHERE id=? LIMIT 1',[targetId]);
  const target=targetRows[0];
  if(!target) return res.status(404).json({error:'User not found'});
  if(target.role==='SUPER_ADMIN') return res.status(403).json({error:'Super Admin always has every permission'});
  const [valid]=await q('SELECT id,code FROM permissions WHERE code IN (?)',[codes.length?codes:['__NONE__']]);
  if(valid.length!==codes.length) return res.status(400).json({error:'One or more permissions are invalid'});
  await q('DELETE FROM user_permissions WHERE user_id=?',[targetId]);
  for(const p of valid) await q('INSERT INTO user_permissions(user_id,permission_id,granted_by) VALUES(?,?,?)',[targetId,p.id,req.session.userId]);
  await q('INSERT INTO security_logs(actor_user_id,action,details) VALUES(?,?,?)',[req.session.userId,'PERMISSIONS_UPDATED',JSON.stringify({target_user_id:targetId,permissions:codes})]);
  await audit(req,'PERMISSIONS_UPDATED','user',targetId,{permissions:codes});
  res.json({ok:true,permissions:await getPermissionCodes(targetId)});
});

app.patch('/api/admin/users/:id/role', requirePermission('MANAGE_ADMINS'), async (req,res)=>{
  const targetId=Number(req.params.id), role=String(req.body?.role||'').toUpperCase();
  if(!Number.isSafeInteger(targetId)||!['STUDENT','TEACHER','ADMIN','SUPER_ADMIN'].includes(role)) return res.status(400).json({error:'Invalid user or role'});
  const [actor]=await q('SELECT role FROM users WHERE id=? LIMIT 1',[req.session.userId]);
  const [target]=await q('SELECT role FROM users WHERE id=? LIMIT 1',[targetId]);
  if(!target[0]) return res.status(404).json({error:'User not found'});
  if((target[0].role==='SUPER_ADMIN'||role==='SUPER_ADMIN')&&actor[0]?.role!=='SUPER_ADMIN') return res.status(403).json({error:'Only Super Admin can manage Super Admin role'});
  await q('UPDATE users SET role=? WHERE id=?',[role,targetId]);
  await q('INSERT INTO security_logs(actor_user_id,action,details) VALUES(?,?,?)',[req.session.userId,'ROLE_UPDATED',JSON.stringify({target_user_id:targetId,role})]);
  await audit(req,'ROLE_UPDATED','user',targetId,{role});
  res.json({ok:true,user:await userById(targetId)});
});

app.get('/api/admin/activation-keys', requirePermission('MANAGE_KEYS'), async (req, res) => {
  const [keys] = await q(`
    SELECT ak.id,ak.key_preview,ak.status,ak.created_at,ak.expires_at,
           COALESCE(s.display_name,t.display_name) person_name,ak.person_type
    FROM activation_keys ak
    LEFT JOIN students s ON s.id=ak.student_id
    LEFT JOIN teachers t ON t.id=ak.teacher_id
    WHERE ak.status='ACTIVE' ORDER BY ak.created_at DESC
  `);
  res.json({ keys });
});

app.post('/api/admin/activation-keys', requirePermission('MANAGE_KEYS'), async (req, res) => {
  const { personType, personId } = req.body || {};
  if (!['STUDENT', 'TEACHER'].includes(personType)) {
    return res.status(400).json({ error: 'Invalid person type' });
  }
  const table = personType === 'STUDENT' ? 'students' : 'teachers';
  const [p] = await q(`SELECT id,official_name,display_name FROM ${table} WHERE id=? LIMIT 1`, [personId]);
  if (!p[0]) return res.status(404).json({ error: 'Person not found' });

  const raw = `B4-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  await q(`
    INSERT INTO activation_keys(key_hash,key_preview,person_type,student_id,teacher_id,official_name,created_by)
    VALUES(?,?,?,?,?,?,?)
  `, [
    hash,
    raw.slice(0, 11) + '…',
    personType,
    personType === 'STUDENT' ? personId : null,
    personType === 'TEACHER' ? personId : null,
    p[0].official_name,
    req.session.userId
  ]);
  await q(`INSERT INTO security_logs(actor_user_id,action,details) VALUES(?,?,?)`,[req.session.userId,'ACTIVATION_CREATED',`${personType} ${personId}`]);
  await audit(req,'ACTIVATION_CREATED',personType.toLowerCase(),personId);
  res.json({ ok: true, key: raw });
});

app.post('/api/admin/teachers',requirePermission('MANAGE_TEACHERS'),async(req,res)=>{
  const {teacherCode,officialName,displayName}=req.body||{};if(!teacherCode||!officialName||!displayName)return res.status(400).json({error:'Teacher code, official name and display name are required'});
  try{const [r]=await q("INSERT INTO teachers(teacher_code,official_name,display_name,class_name) VALUES(?,?,?,'B4')",[teacherCode.trim(),officialName.trim(),displayName.trim()]);await audit(req,'TEACHER_CREATED','teacher',r.insertId,{teacherCode:teacherCode.trim()});res.json({ok:true,id:r.insertId});}catch(e){res.status(400).json({error:e.code==='ER_DUP_ENTRY'?'Teacher code already exists':e.message});}
});
app.post('/api/admin/subjects',requirePermission('MANAGE_SUBJECTS'),async(req,res)=>{
  const {name,teacherName='',progress=0}=req.body||{};if(!name?.trim())return res.status(400).json({error:'Subject name is required'});
  try{const [r]=await q("INSERT INTO subjects(name,class_name,teacher_name,progress) VALUES(?,'B4',?,?)",[name.trim(),String(teacherName||'').trim()||null,Math.max(0,Math.min(100,Number(progress)||0))]);await audit(req,'SUBJECT_CREATED','subject',r.insertId,{name:name.trim()});res.json({ok:true,id:r.insertId});}catch(e){res.status(400).json({error:e.code==='ER_DUP_ENTRY'?'Subject already exists':e.message});}
});
app.patch('/api/admin/subjects/:id',requirePermission('MANAGE_SUBJECTS'),async(req,res)=>{const id=Number(req.params.id),{name,teacherName='',progress=0}=req.body||{};const [r]=await q("UPDATE subjects SET name=?,teacher_name=?,progress=? WHERE id=? AND class_name='B4'",[String(name||'').trim(),String(teacherName||'').trim()||null,Math.max(0,Math.min(100,Number(progress)||0)),id]);if(!r.affectedRows)return res.status(404).json({error:'Subject not found'});await audit(req,'SUBJECT_UPDATED','subject',id);res.json({ok:true});});
app.delete('/api/admin/subjects/:id',requirePermission('MANAGE_SUBJECTS'),async(req,res)=>{const id=Number(req.params.id),[r]=await q("DELETE FROM subjects WHERE id=? AND class_name='B4'",[id]);if(!r.affectedRows)return res.status(404).json({error:'Subject not found'});await audit(req,'SUBJECT_DELETED','subject',id);res.json({ok:true});});

app.get('/api/admin/people', requireAnyPermission(['MANAGE_ACCOUNTS','MANAGE_ADMINS','MANAGE_STUDENTS','MANAGE_TEACHERS','MANAGE_KEYS']), async (req,res) => {
  const [students] = await q(`SELECT id,student_code,official_name,display_name FROM students WHERE class_name='B4' ORDER BY display_name`);
  const [teachers] = await q(`SELECT id,teacher_code,official_name,display_name FROM teachers WHERE class_name='B4' ORDER BY display_name`);
  res.json({ students, teachers });
});

app.post('/api/admin/students', requirePermission('MANAGE_STUDENTS'), async (req,res) => {
  const { studentCode, officialName, displayName, specialization='Telecommunication' } = req.body || {};
  if (!studentCode || !officialName || !displayName) return res.status(400).json({error:'Student code, official name and display name are required'});
  try {
    const [r] = await q(`INSERT INTO students(student_code,official_name,display_name,class_name,specialization) VALUES(?,?,?,'B4',?)`,
      [studentCode.trim(),officialName.trim(),displayName.trim(),specialization.trim()]);
    await q(`INSERT INTO activity_logs(actor_user_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)`,
      [req.session.userId,'STUDENT_CREATED','student',r.insertId,studentCode.trim()]);
    res.json({ok:true});
  } catch(e) {
    res.status(400).json({error:e.code==='ER_DUP_ENTRY'?'Student code already exists':e.message});
  }
});

app.post('/api/admin/assignments', requirePermission('MANAGE_ASSIGNMENTS'), async (req,res) => {
  const {title,description='',subjectId=null,dueAt=null} = req.body || {};
  if(!title?.trim()) return res.status(400).json({error:'Assignment title is required'});
  const [r]=await q(`INSERT INTO assignments(title,description,subject_id,class_name,due_at,created_by) VALUES(?,?,?,'B4',?,?)`,
    [title.trim(),description.trim(),subjectId||null,dueAt||null,req.session.userId]);
  await audit(req,'ASSIGNMENT_CREATED','assignment',r.insertId,{title:title.trim()});res.json({ok:true,id:r.insertId});
});

app.post('/api/admin/announcements', requirePermission('MANAGE_ANNOUNCEMENTS'), async (req,res) => {
  const {title,body,category='General'} = req.body || {};
  if(!title?.trim() || !body?.trim()) return res.status(400).json({error:'Title and body are required'});
  const [r]=await q(`INSERT INTO announcements(title,body,category,class_name,created_by) VALUES(?,?,?,'B4',?)`,
    [title.trim(),body.trim(),category.trim(),req.session.userId]);
  res.json({ok:true,id:r.insertId});
});

app.patch('/api/admin/assignments/:id',requirePermission('MANAGE_ASSIGNMENTS'),async(req,res)=>{const id=Number(req.params.id);try{await assertTeacherOwner(req,'assignments',id)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}const {title,description='',subjectId=null,dueAt=null,status='OPEN'}=req.body||{};const [r]=await q("UPDATE assignments SET title=?,description=?,subject_id=?,due_at=?,status=? WHERE id=? AND class_name='B4'",[String(title||'').trim(),String(description||'').trim(),subjectId||null,dueAt||null,['OPEN','DONE','CLOSED'].includes(status)?status:'OPEN',id]);if(!r.affectedRows)return res.status(404).json({error:'Assignment not found'});await audit(req,'ASSIGNMENT_UPDATED','assignment',id);res.json({ok:true});});
app.delete('/api/admin/assignments/:id',requirePermission('MANAGE_ASSIGNMENTS'),async(req,res)=>{const id=Number(req.params.id);try{await assertTeacherOwner(req,'assignments',id)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}const [r]=await q("DELETE FROM assignments WHERE id=? AND class_name='B4'",[id]);if(!r.affectedRows)return res.status(404).json({error:'Assignment not found'});await audit(req,'ASSIGNMENT_DELETED','assignment',id);res.json({ok:true});});
app.patch('/api/admin/resources/:id',requirePermission('MANAGE_RESOURCES'),async(req,res)=>{const id=Number(req.params.id);try{await assertTeacherOwner(req,'resources',id)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}const {title,description='',url='',subjectId=null}=req.body||{};const [r]=await q("UPDATE resources SET title=?,description=?,url=?,subject_id=? WHERE id=? AND class_name='B4'",[String(title||'').trim(),String(description||'').trim(),String(url||'').trim()||null,subjectId||null,id]);if(!r.affectedRows)return res.status(404).json({error:'Resource not found'});await audit(req,'RESOURCE_UPDATED','resource',id);res.json({ok:true});});
app.delete('/api/admin/resources/:id',requirePermission('MANAGE_RESOURCES'),async(req,res)=>{const id=Number(req.params.id);try{await assertTeacherOwner(req,'resources',id)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}const [r]=await q("DELETE FROM resources WHERE id=? AND class_name='B4'",[id]);if(!r.affectedRows)return res.status(404).json({error:'Resource not found'});await audit(req,'RESOURCE_DELETED','resource',id);res.json({ok:true});});
app.patch('/api/admin/exams/:id',requirePermission('MANAGE_EXAMS'),async(req,res)=>{const id=Number(req.params.id);try{await assertTeacherOwner(req,'exams',id)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}const {title,description='',subjectId=null,startsAt=null,endsAt=null,durationMinutes=null,questions=[]}=req.body||{};if(!title?.trim()||!Array.isArray(questions)||!questions.length)return res.status(400).json({error:'Exam title and questions are required'});if(startsAt&&endsAt&&new Date(endsAt)<=new Date(startsAt))return res.status(400).json({error:'Deadline must be after start time'});const conn=await pool.getConnection();try{await conn.beginTransaction();const [r]=await conn.execute("UPDATE exams SET title=?,description=?,subject_id=?,starts_at=?,ends_at=?,duration_minutes=? WHERE id=? AND class_name='B4'",[title.trim(),String(description||'').trim(),subjectId||null,startsAt||null,endsAt||null,durationMinutes?Number(durationMinutes):null,id]);if(!r.affectedRows)throw new Error('Exam not found');await conn.execute('DELETE FROM exam_questions WHERE exam_id=?',[id]);for(let i=0;i<questions.length;i++){const qn=questions[i];if(!String(qn.questionText||'').trim())continue;const type=['MCQ','TRUE_FALSE','SHORT'].includes(qn.questionType)?qn.questionType:'MCQ';const opts=type==='MCQ'?(Array.isArray(qn.options)?qn.options.filter(Boolean).slice(0,8):[]):null;const correct=type==='MCQ'?String(qn.correctAnswer||'').trim():(type==='TRUE_FALSE'?(String(qn.correctAnswer||'TRUE').toUpperCase()==='TRUE'?'TRUE':'FALSE'):null);await conn.execute('INSERT INTO exam_questions(exam_id,question_text,question_type,options_json,correct_answer,points,sort_order) VALUES(?,?,?,?,?,?,?)',[id,String(qn.questionText).trim(),type,opts?JSON.stringify(opts):null,correct,Number(qn.points)||1,i]);}await conn.commit();await audit(req,'EXAM_UPDATED','exam',id);res.json({ok:true});}catch(e){await conn.rollback();res.status(400).json({error:e.message})}finally{conn.release()}});
app.delete('/api/admin/exams/:id',requirePermission('MANAGE_EXAMS'),async(req,res)=>{const id=Number(req.params.id);try{await assertTeacherOwner(req,'exams',id)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}const [r]=await q("DELETE FROM exams WHERE id=? AND class_name='B4'",[id]);if(!r.affectedRows)return res.status(404).json({error:'Exam not found'});await audit(req,'EXAM_DELETED','exam',id);res.json({ok:true});});
app.patch('/api/admin/announcements/:id',requirePermission('MANAGE_ANNOUNCEMENTS'),async(req,res)=>{const id=Number(req.params.id),{title,body,category='General'}=req.body||{};const [r]=await q("UPDATE announcements SET title=?,body=?,category=? WHERE id=? AND class_name='B4'",[String(title||'').trim(),String(body||'').trim(),String(category||'General').trim(),id]);if(!r.affectedRows)return res.status(404).json({error:'Announcement not found'});await audit(req,'ANNOUNCEMENT_UPDATED','announcement',id);res.json({ok:true});});
app.delete('/api/admin/announcements/:id',requirePermission('MANAGE_ANNOUNCEMENTS'),async(req,res)=>{const id=Number(req.params.id),[r]=await q("DELETE FROM announcements WHERE id=? AND class_name='B4'",[id]);if(!r.affectedRows)return res.status(404).json({error:'Announcement not found'});await audit(req,'ANNOUNCEMENT_DELETED','announcement',id);res.json({ok:true});});
app.put('/api/admin/schedule',requirePermission('MANAGE_SCHEDULE'),async(req,res)=>{const rows=Array.isArray(req.body?.schedule)?req.body.schedule:[],conn=await pool.getConnection();try{await conn.beginTransaction();await conn.execute("DELETE FROM schedule WHERE class_name='B4'");for(const [i,row] of rows.entries())await conn.execute("INSERT INTO schedule(class_name,day_order,day_name,p1,p2,p3,p4) VALUES('B4',?,?,?,?,?,?)",[i+1,String(row.day_name||'Day '+(i+1)),String(row.p1||''),String(row.p2||''),String(row.p3||''),String(row.p4||'')]);await conn.commit();await audit(req,'SCHEDULE_UPDATED','schedule',null,{rows:rows.length});res.json({ok:true});}catch(e){await conn.rollback();res.status(400).json({error:e.message})}finally{conn.release()}});
app.get('/api/admin/logs',requirePermission('VIEW_LOGS'),async(req,res)=>{const [activity]=await q('SELECT l.id,l.action,l.entity_type,l.entity_id,l.details,l.created_at,u.display_name actor_name FROM activity_logs l LEFT JOIN users u ON u.id=l.actor_user_id ORDER BY l.created_at DESC LIMIT 500');const [security]=await q('SELECT l.id,l.action,l.details,l.created_at,u.display_name actor_name FROM security_logs l LEFT JOIN users u ON u.id=l.actor_user_id ORDER BY l.created_at DESC LIMIT 500');res.json({activity,security});});
app.get('/api/exams/:id/edit',requirePermission('MANAGE_EXAMS'),async(req,res)=>{const id=Number(req.params.id);try{await assertTeacherOwner(req,'exams',id)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}const [rows]=await q("SELECT id,title,description,subject_id,starts_at,ends_at,duration_minutes,status,created_by FROM exams WHERE id=? AND class_name='B4' LIMIT 1",[id]);if(!rows[0])return res.status(404).json({error:'Exam not found'});const [questions]=await q('SELECT id,question_text,question_type,options_json,correct_answer,points,sort_order FROM exam_questions WHERE exam_id=? ORDER BY sort_order',[id]);res.json({exam:rows[0],questions:questions.map(x=>({...x,options_json:typeof x.options_json==='string'?(JSON.parse(x.options_json||'[]')):(x.options_json||[])}))});});
app.get('/api/exams/:id/result',requireAuth,async(req,res)=>{const id=Number(req.params.id),[r]=await q('SELECT a.id,a.status,a.score,a.started_at,a.submitted_at,e.title,e.ends_at,e.duration_minutes FROM exam_attempts a JOIN exams e ON e.id=a.exam_id WHERE a.exam_id=? AND a.user_id=? LIMIT 1',[id,req.session.userId]);if(!r[0])return res.status(404).json({error:'No exam submission yet'});const [tot]=await q('SELECT COALESCE(SUM(points),0) total FROM exam_questions WHERE exam_id=?',[id]);const total=Number(tot[0]?.total||0),score=Number(r[0].score||0);res.json({attempt:r[0],percent:total?Math.round(score/total*100):0,total});});

app.post('/api/chat/messages',requireAuth,async(req,res)=>{
  const body=String(req.body?.body||'').trim();
  const replyToId=req.body?.replyToId?Number(req.body.replyToId):null;
  if(!body||body.length>4000)return res.status(400).json({error:'Message is empty or too long'});
  if(replyToId){const [reply]=await q('SELECT id FROM chat_messages WHERE id=? AND deleted_at IS NULL LIMIT 1',[replyToId]);if(!reply[0])return res.status(400).json({error:'Reply target not found'});}
  const [r]=await q('INSERT INTO chat_messages(user_id,body,reply_to_id) VALUES(?,?,?)',[req.session.userId,body,replyToId||null]);
  const [rows]=await q(`SELECT m.id,m.body,m.created_at,m.edited_at,m.user_id,m.reply_to_id,u.display_name,u.avatar_url,rm.body reply_body,ru.display_name reply_display_name FROM chat_messages m JOIN users u ON u.id=m.user_id LEFT JOIN chat_messages rm ON rm.id=m.reply_to_id LEFT JOIN users ru ON ru.id=rm.user_id WHERE m.id=?`,[r.insertId]);
  res.json({message:rows[0]});
});
app.patch('/api/chat/messages/:id',requireAuth,async(req,res)=>{
  const id=Number(req.params.id),body=String(req.body?.body||'').trim();
  if(!Number.isSafeInteger(id)||!body||body.length>4000)return res.status(400).json({error:'Invalid message'});
  const [rows]=await q('SELECT id,user_id,body,deleted_at FROM chat_messages WHERE id=? LIMIT 1',[id]);const m=rows[0];
  if(!m)return res.status(404).json({error:'Message not found'});
  if(m.deleted_at)return res.status(400).json({error:'Deleted message cannot be edited'});
  if(Number(m.user_id)!==Number(req.session.userId))return res.status(403).json({error:'You can edit only your own messages'});
  if(body===m.body)return res.status(400).json({error:'No changes made'});
  await q('INSERT INTO chat_message_edits(message_id,editor_user_id,old_body,new_body) VALUES(?,?,?,?)',[id,req.session.userId,m.body,body]);
  await q('UPDATE chat_messages SET body=?,edited_at=NOW() WHERE id=?',[body,id]);
  await q('INSERT INTO activity_logs(actor_user_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)',[req.session.userId,'CHAT_MESSAGE_EDITED','chat_message',id,JSON.stringify({old_body:m.body,new_body:body})]);
  const [updated]=await q('SELECT m.id,m.body,m.created_at,m.edited_at,m.user_id,u.display_name,u.avatar_url FROM chat_messages m JOIN users u ON u.id=m.user_id WHERE m.id=?',[id]);
  res.json({message:updated[0]});
});
app.delete('/api/chat/messages/:id',requireAuth,async(req,res)=>{
  const id=Number(req.params.id);
  const [rows]=await q('SELECT id,user_id,deleted_at FROM chat_messages WHERE id=? LIMIT 1',[id]);const m=rows[0];
  if(!m)return res.status(404).json({error:'Message not found'});
  const permissions=await getPermissionCodes(req.session.userId);
  const canDelete=Number(m.user_id)===Number(req.session.userId)||permissions.includes('MANAGE_CHAT');
  if(!canDelete)return res.status(403).json({error:'Permission denied'});
  if(m.deleted_at)return res.json({ok:true});
  await q('UPDATE chat_messages SET deleted_at=NOW(),deleted_by=? WHERE id=?',[req.session.userId,id]);
  await q('INSERT INTO activity_logs(actor_user_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)',[req.session.userId,'CHAT_MESSAGE_DELETED','chat_message',id,'Message deleted']);
  res.json({ok:true});
});
app.get('/api/admin/chat/edit-logs',requirePermission('VIEW_LOGS'),async(req,res)=>{
  const [logs]=await q('SELECT e.id,e.message_id,e.old_body,e.new_body,e.created_at,u.display_name editor_name FROM chat_message_edits e LEFT JOIN users u ON u.id=e.editor_user_id ORDER BY e.created_at DESC LIMIT 200');
  res.json({logs});
});

app.post('/api/ai', requirePermission('USE_AI'), async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message required' });
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Gemini AI is not configured on the backend yet' });
  try {
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      input: [
        { type: 'user_input', content: [{ type: 'text', text: 'You are B4 AI Assistant for a secondary-school Telecommunication class. Explain academic topics clearly and safely. Do not invent private class data. Prefer Egyptian Arabic when the student asks in Arabic and English when asked in English.' }] },
        { type: 'user_input', content: [{ type: 'text', text: message }] }
      ]
    });
    res.json({ answer: interaction.output_text || 'No answer returned.' });
  } catch (e) {
    console.error('Gemini request failed:', e.message);
    res.status(502).json({ error: 'AI request failed' });
  }
});


app.get('/api/auth/linked', requireAuth, async (req,res)=>{
  const [rows]=await q('SELECT provider,provider_email,created_at FROM linked_accounts WHERE user_id=? ORDER BY provider',[req.session.userId]);
  res.json({linked:rows});
});

async function startGoogleOAuth(req,res,mode){
  const clientId=process.env.GOOGLE_CLIENT_ID,redirectUri=process.env.GOOGLE_REDIRECT_URI;
  if(!clientId||!redirectUri)return res.status(503).json({error:'Google linking is not configured'});
  const state=crypto.randomBytes(32).toString('hex');req.session.googleOAuthState=state;req.session.googleOAuthMode=mode;
  const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');u.searchParams.set('client_id',clientId);u.searchParams.set('redirect_uri',redirectUri);u.searchParams.set('response_type','code');u.searchParams.set('scope','openid email profile');u.searchParams.set('state',state);u.searchParams.set('access_type','online');u.searchParams.set('prompt','select_account');res.redirect(u.toString());
}
app.get('/api/auth/google/start',requireAuth,(req,res)=>startGoogleOAuth(req,res,'link'));
app.get('/api/auth/google/login',(req,res)=>startGoogleOAuth(req,res,'login'));
app.get('/api/auth/google/callback',async(req,res)=>{
  try{
    const mode=req.session.googleOAuthMode||'link';
    if(req.query.error)return res.redirect('/?google=cancelled');
    if(!req.query.code||req.query.state!==req.session.googleOAuthState)return res.status(400).send('Google OAuth state mismatch.');
    const clientId=process.env.GOOGLE_CLIENT_ID,clientSecret=process.env.GOOGLE_CLIENT_SECRET,redirectUri=process.env.GOOGLE_REDIRECT_URI;
    if(!clientId||!clientSecret||!redirectUri)return res.status(503).send('Google linking is not configured.');
    const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:String(req.query.code),client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code'})});
    const tokens=await tokenRes.json();if(!tokenRes.ok||!tokens.access_token)throw new Error('Google token exchange failed');
    const infoRes=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokens.access_token}});
    const info=await infoRes.json();if(!infoRes.ok||!info.sub)throw new Error('Google user info failed');
    const [owner]=await q("SELECT user_id FROM linked_accounts WHERE provider='GOOGLE' AND provider_user_id=? LIMIT 1",[String(info.sub)]);
    if(mode==='login'){
      if(!owner[0])return res.redirect('/?google=not-linked');
      const [u]=await q('SELECT id,role,status FROM users WHERE id=? LIMIT 1',[owner[0].user_id]);
      if(!u[0]||u[0].status!=='ACTIVE')return res.redirect('/?google=disabled');
      req.session.userId=u[0].id;req.session.role=u[0].role;await audit(req,'GOOGLE_LOGIN','user',u[0].id,{email:info.email||null});
      delete req.session.googleOAuthState;delete req.session.googleOAuthMode;return res.redirect('/?google=login');
    }
    if(!req.session.userId)return res.redirect('/?google=login-required');
    if(owner[0]&&Number(owner[0].user_id)!==Number(req.session.userId))return res.redirect('/?google=already-linked');
    if(!owner[0]){await q("INSERT INTO linked_accounts(user_id,provider,provider_user_id,provider_email) VALUES(?,'GOOGLE',?,?)",[req.session.userId,String(info.sub),info.email||null]);await audit(req,'GOOGLE_LINKED','user',req.session.userId,{email:info.email||null});}
    delete req.session.googleOAuthState;delete req.session.googleOAuthMode;res.redirect('/?google=linked');
  }catch(e){console.error('Google OAuth failed:',e.message);res.redirect('/?google=error');}
});
app.delete('/api/auth/linked/GOOGLE',requireAuth,async(req,res)=>{const [r]=await q("DELETE FROM linked_accounts WHERE user_id=? AND provider='GOOGLE'",[req.session.userId]);if(r.affectedRows)await audit(req,'GOOGLE_UNLINKED','user',req.session.userId);res.json({ok:true});});

app.post('/api/admin/resources', requirePermission('MANAGE_RESOURCES'), async(req,res)=>{
  const {title,description='',url='',subjectId=null,resourceType='LINK'}=req.body||{};
  if(!title?.trim()) return res.status(400).json({error:'Resource title is required'});
  const [r]=await q('INSERT INTO resources(title,description,url,resource_type,subject_id,class_name,created_by) VALUES(?,?,?,?,\'B4\',?,?)',[title.trim(),description.trim(),url.trim()||null,resourceType,subjectId||null,req.session.userId]);
  await audit(req,'RESOURCE_CREATED','resource',r.insertId,{type:resourceType});res.json({ok:true,id:r.insertId});
});

app.post('/api/admin/resources/pdf', requirePermission('MANAGE_RESOURCES'), pdfUpload.single('file'), async(req,res)=>{
  if(!req.file) return res.status(400).json({error:'PDF file is required'});
  const title=String(req.body?.title||req.file.originalname).trim();
  const description=String(req.body?.description||'').trim();
  const subjectId=req.body?.subjectId?Number(req.body.subjectId):null;
  const [r]=await q('INSERT INTO resources(title,description,resource_type,subject_id,class_name,created_by) VALUES(?,?,\'FILE\',?,\'B4\',?)',[title,description,subjectId||null,req.session.userId]);
  await q('INSERT INTO resource_files(resource_id,filename,mime_type,data) VALUES(?,?,?,?)',[r.insertId,req.file.originalname,'application/pdf',req.file.buffer]);
  await audit(req,'PDF_UPLOADED','resource',r.insertId,{filename:req.file.originalname});res.json({ok:true,id:r.insertId,fileUrl:'/api/resources/files/'+r.insertId});
});

app.get('/api/resources/files/:id', requireAuth, async(req,res)=>{
  const id=Number(req.params.id); if(!Number.isSafeInteger(id)) return res.status(400).end();
  const [rows]=await q('SELECT rf.filename,rf.mime_type,rf.data FROM resource_files rf JOIN resources r ON r.id=rf.resource_id WHERE rf.id=? AND r.class_name=\'B4\' LIMIT 1',[id]);
  if(!rows[0]) return res.status(404).end();
  res.setHeader('Content-Type',rows[0].mime_type);
  res.setHeader('Content-Disposition','inline; filename*=UTF-8\'\''+encodeURIComponent(rows[0].filename));
  res.send(rows[0].data);
});

app.post('/api/admin/exams', requirePermission('MANAGE_EXAMS'), async(req,res)=>{
  const {title,description='',subjectId=null,startsAt=null,endsAt=null,durationMinutes=null,questions=[]}=req.body||{};
  if(!title?.trim()) return res.status(400).json({error:'Exam title is required'});
  if(!Array.isArray(questions)||!questions.length) return res.status(400).json({error:'Add at least one question'});
  if(startsAt&&endsAt&&new Date(endsAt)<=new Date(startsAt)) return res.status(400).json({error:'Deadline must be after start time'});
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    const [e]=await conn.execute('INSERT INTO exams(title,description,subject_id,class_name,starts_at,ends_at,duration_minutes,status,created_by) VALUES(?,?,?,?,?,?,?,\'SCHEDULED\',?)',[title.trim(),description.trim(),subjectId||null,'B4',startsAt||null,endsAt||null,durationMinutes?Number(durationMinutes):null,req.session.userId]);
    for(let i=0;i<questions.length;i++){
      const qn=questions[i]; if(!String(qn.questionText||'').trim()) continue;
      const type=['MCQ','TRUE_FALSE','SHORT'].includes(qn.questionType)?qn.questionType:'MCQ';
      const opts=type==='MCQ'?(Array.isArray(qn.options)?qn.options.filter(Boolean).slice(0,8):[]):null;
      const correct=type==='MCQ'?String(qn.correctAnswer||'').trim():(type==='TRUE_FALSE'?(String(qn.correctAnswer||'TRUE').toUpperCase()==='TRUE'?'TRUE':'FALSE'):null);
      await conn.execute('INSERT INTO exam_questions(exam_id,question_text,question_type,options_json,correct_answer,points,sort_order) VALUES(?,?,?,?,?,?,?)',[e.insertId,String(qn.questionText).trim(),type,opts?JSON.stringify(opts):null,correct,Number(qn.points)||1,i]);
    }
    await conn.commit();await audit(req,'EXAM_CREATED','exam',e.insertId,{title:title.trim()});res.json({ok:true,id:e.insertId});
  }catch(e){await conn.rollback();res.status(400).json({error:e.message})}finally{conn.release();}
});

app.get('/api/exams/:id', requireAuth, async(req,res)=>{
  const id=Number(req.params.id); if(!Number.isSafeInteger(id)) return res.status(400).json({error:'Invalid exam'});
  const [ex]=await q('SELECT e.*,s.name subject_name FROM exams e LEFT JOIN subjects s ON s.id=e.subject_id WHERE e.id=? AND e.class_name=\'B4\' LIMIT 1',[id]);
  if(!ex[0]) return res.status(404).json({error:'Exam not found'});
  const [attempt]=await q('SELECT id,status,started_at,submitted_at,score FROM exam_attempts WHERE exam_id=? AND user_id=? LIMIT 1',[id,req.session.userId]);
  res.json({exam:ex[0],attempt:attempt[0]||null});
});

app.post('/api/exams/:id/start', requireAuth, async(req,res)=>{
  const id=Number(req.params.id); const now=new Date();
  const [ex]=await q('SELECT * FROM exams WHERE id=? AND class_name=\'B4\' LIMIT 1',[id]); const exam=ex[0];
  if(!exam) return res.status(404).json({error:'Exam not found'});
  if(exam.starts_at&&now<new Date(exam.starts_at)) return res.status(403).json({error:'Exam has not started yet'});
  if(exam.ends_at&&now>=new Date(exam.ends_at)) return res.status(403).json({error:'Exam deadline has passed'});
  const [existing]=await q('SELECT * FROM exam_attempts WHERE exam_id=? AND user_id=? LIMIT 1',[id,req.session.userId]);
  if(existing[0]){if(existing[0].status!=='STARTED')return res.status(403).json({error:'You have already submitted this exam'});return sendExamStart(res,exam,existing[0]);}
  const [r]=await q('INSERT INTO exam_attempts(exam_id,user_id,status) VALUES(?,?,\'STARTED\')',[id,req.session.userId]);
  const [a]=await q('SELECT * FROM exam_attempts WHERE id=?',[r.insertId]);
  return sendExamStart(res,exam,a[0]);
});

async function sendExamStart(res,exam,attempt){
  const [questions]=await q('SELECT id,question_text,question_type,options_json,points,sort_order FROM exam_questions WHERE exam_id=? ORDER BY sort_order',[exam.id]);
  const start=new Date(attempt.started_at).getTime();
  const durationDeadline=exam.duration_minutes?start+Number(exam.duration_minutes)*60000:null;
  const endDeadline=exam.ends_at?new Date(exam.ends_at).getTime():null;
  const deadlines=[durationDeadline,endDeadline].filter(Boolean);
  const deadline=deadlines.length?new Date(Math.min(...deadlines)).toISOString():null;
  res.json({exam,attempt:{id:attempt.id,started_at:attempt.started_at,deadline},questions:questions.map(q=>({...q,options_json:typeof q.options_json==='string'?(JSON.parse(q.options_json||'[]')):(q.options_json||[])}))});
}

app.post('/api/exams/:id/submit', requireAuth, async(req,res)=>{
  const id=Number(req.params.id),answers=req.body?.answers||{};
  const [rows]=await q('SELECT a.*,e.ends_at,e.duration_minutes FROM exam_attempts a JOIN exams e ON e.id=a.exam_id WHERE a.exam_id=? AND a.user_id=? LIMIT 1',[id,req.session.userId]);
  const attempt=rows[0]; if(!attempt)return res.status(404).json({error:'Exam attempt not found'});
  if(attempt.status!=='STARTED')return res.status(400).json({error:'Exam already submitted'});
  const started=new Date(attempt.started_at).getTime(),deadline=Math.min(...[attempt.ends_at?new Date(attempt.ends_at).getTime():Infinity,attempt.duration_minutes?started+Number(attempt.duration_minutes)*60000:Infinity]);
  if(Date.now()>deadline){await q('UPDATE exam_attempts SET status=\'SUBMITTED\',submitted_at=NOW() WHERE id=?',[attempt.id]);return res.status(403).json({error:'Time is over. The exam was closed automatically.'});}
  const [questions]=await q('SELECT * FROM exam_questions WHERE exam_id=? ORDER BY sort_order',[id]);
  let score=0;
  for(const qn of questions){
    const answer=String(answers[String(qn.id)]??'').trim(); let correct=null,awarded=0;
    if(qn.correct_answer!==null){correct=answer.toLowerCase()===String(qn.correct_answer).trim().toLowerCase();awarded=correct?Number(qn.points):0;}
    await q('INSERT INTO exam_answers(attempt_id,question_id,answer_text,is_correct,points_awarded) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE answer_text=VALUES(answer_text),is_correct=VALUES(is_correct),points_awarded=VALUES(points_awarded)',[attempt.id,qn.id,answer,correct,awarded]); score+=awarded;
  }
  await q('UPDATE exam_attempts SET status=\'SUBMITTED\',score=?,submitted_at=NOW() WHERE id=?',[score,attempt.id]);const total=questions.reduce((n,x)=>n+Number(x.points||0),0);const percent=total?Math.round(score/total*100):0;await audit(req,'EXAM_SUBMITTED','exam',id,{score,total,percent});res.json({ok:true,score,total,percent});
});

// Serve frontend assets explicitly before the SPA fallback.
// This supports both the normal root paths (/app.js, /style.css) and the
// older /frontend/* paths that may still exist in a local browser cache.
const frontendPath = path.resolve(__dirname, '../../frontend');
app.use('/frontend', express.static(frontendPath, { extensions: ['html'] }));
app.use(express.static(frontendPath, { extensions: ['html'] }));

app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

ensurePermissionSchema().then(()=>app.listen(PORT,()=>console.log('B4 backend + frontend listening on '+PORT))).catch(e=>{console.error('Permission schema bootstrap failed:',e);process.exit(1)});