import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import OpenAI from 'openai';
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
  ? mysql.createPool(mysqlUrl)
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
const requireAuth = (req, res, next) => req.session.userId
  ? next()
  : res.status(401).json({ error: 'Login required' });
const requireRole = roles => (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
  if (!roles.includes(req.session.role)) return res.status(403).json({ error: 'Permission denied' });
  next();
};

async function userById(id) {
  const [r] = await q(
    `SELECT id,display_name,official_name,role,status,student_id,teacher_id,avatar_url
     FROM users WHERE id=? LIMIT 1`,
    [id]
  );
  return r[0] || null;
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
    SELECT a.id,a.title,a.description,a.status,a.due_at,s.name subject_name
    FROM assignments a LEFT JOIN subjects s ON s.id=a.subject_id
    WHERE a.class_name='B4' ORDER BY a.due_at IS NULL,a.due_at
  `);
  const [announcements] = await q(`
    SELECT id,title,body,category,created_at FROM announcements
    WHERE class_name='B4' ORDER BY created_at DESC LIMIT 20
  `);
  const [schedule] = await q(`SELECT day_name,p1,p2,p3,p4 FROM schedule WHERE class_name='B4' ORDER BY day_order`);
  const [resources] = await q(`
    SELECT r.id,r.title,r.description,r.url,r.file_url,r.resource_type,r.subject_id,s.name subject_name
    FROM resources r LEFT JOIN subjects s ON s.id=r.subject_id
    WHERE r.class_name='B4' ORDER BY r.created_at DESC LIMIT 100
  `);
  const [exams] = await q(`
    SELECT e.id,e.title,e.description,e.subject_id,s.name subject_name,e.starts_at,e.ends_at,e.duration_minutes,e.status
    FROM exams e LEFT JOIN subjects s ON s.id=e.subject_id
    WHERE e.class_name='B4' ORDER BY e.starts_at IS NULL,e.starts_at
  `);
  let attendance=[],messages=[],notifications=[];
  if(req.session.userId) {
    [attendance]=await q(`SELECT date,status FROM attendance WHERE user_id=? ORDER BY date DESC LIMIT 60`,[req.session.userId]);
  }
  [messages]=await q(`
    SELECT m.id,m.body,m.created_at,m.edited_at,m.user_id,
           COALESCE(u.display_name,'Deleted user') display_name,u.avatar_url
    FROM chat_messages m LEFT JOIN users u ON u.id=m.user_id
    WHERE m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 100
  `);
  messages.reverse();
  if(req.session.userId) {
    [notifications]=await q(`
      SELECT id,title,body,read_at,created_at FROM notifications
      WHERE user_id=? OR user_id IS NULL ORDER BY created_at DESC LIMIT 30
    `,[req.session.userId]);
  }
  return {students,subjects,assignments,announcements,schedule,resources,exams,attendance,messages,notifications};
}

app.get('/api/bootstrap', async (req, res) =>
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
    await conn.execute(
      `INSERT INTO security_logs(actor_user_id,action,details) VALUES(NULL,'ACTIVATION_USED',?)`,
      [`Account ${u.insertId} activated`]
    );
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
  res.json({ ok: true, user: await userById(u.id) });
});

app.post('/api/auth/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

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
  await q(`INSERT INTO security_logs(actor_user_id,action,details) VALUES(?,?,?)`, [
    req.session.userId, 'PASSWORD_CHANGED', 'User changed their password'
  ]);
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
  res.json({ ok: true, user: await userById(req.session.userId) });
});

app.get('/api/admin/activation-keys', requireRole(['SUPER_ADMIN']), async (req, res) => {
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

app.post('/api/admin/activation-keys', requireRole(['SUPER_ADMIN']), async (req, res) => {
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
  await q(`INSERT INTO security_logs(actor_user_id,action,details) VALUES(?,?,?)`, [
    req.session.userId, 'ACTIVATION_CREATED', `${personType} ${personId}`
  ]);
  res.json({ ok: true, key: raw });
});

app.get('/api/admin/people', requireRole(['SUPER_ADMIN']), async (req,res) => {
  const [students] = await q(`SELECT id,student_code,official_name,display_name FROM students WHERE class_name='B4' ORDER BY display_name`);
  const [teachers] = await q(`SELECT id,teacher_code,official_name,display_name FROM teachers WHERE class_name='B4' ORDER BY display_name`);
  res.json({ students, teachers });
});

app.post('/api/admin/students', requireRole(['SUPER_ADMIN','ADMIN']), async (req,res) => {
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

app.post('/api/admin/assignments', requireRole(['SUPER_ADMIN','ADMIN','TEACHER']), async (req,res) => {
  const {title,description='',subjectId=null,dueAt=null} = req.body || {};
  if(!title?.trim()) return res.status(400).json({error:'Assignment title is required'});
  const [r]=await q(`INSERT INTO assignments(title,description,subject_id,class_name,due_at,created_by) VALUES(?,?,?,'B4',?,?)`,
    [title.trim(),description.trim(),subjectId||null,dueAt||null,req.session.userId]);
  res.json({ok:true,id:r.insertId});
});

app.post('/api/admin/announcements', requireRole(['SUPER_ADMIN','ADMIN','TEACHER']), async (req,res) => {
  const {title,body,category='General'} = req.body || {};
  if(!title?.trim() || !body?.trim()) return res.status(400).json({error:'Title and body are required'});
  const [r]=await q(`INSERT INTO announcements(title,body,category,class_name,created_by) VALUES(?,?,?,'B4',?)`,
    [title.trim(),body.trim(),category.trim(),req.session.userId]);
  res.json({ok:true,id:r.insertId});
});

app.post('/api/chat/messages',requireAuth,async(req,res)=>{
  const body=String(req.body?.body||'').trim();
  if(!body||body.length>4000)return res.status(400).json({error:'Message is empty or too long'});
  const [r]=await q('INSERT INTO chat_messages(user_id,body) VALUES(?,?)',[req.session.userId,body]);
  const [rows]=await q('SELECT m.id,m.body,m.created_at,m.edited_at,m.user_id,u.display_name,u.avatar_url FROM chat_messages m JOIN users u ON u.id=m.user_id WHERE m.id=?',[r.insertId]);
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
  const canDelete=Number(m.user_id)===Number(req.session.userId)||['SUPER_ADMIN','ADMIN','TEACHER'].includes(req.session.role);
  if(!canDelete)return res.status(403).json({error:'Permission denied'});
  if(m.deleted_at)return res.json({ok:true});
  await q('UPDATE chat_messages SET deleted_at=NOW(),deleted_by=? WHERE id=?',[req.session.userId,id]);
  await q('INSERT INTO activity_logs(actor_user_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)',[req.session.userId,'CHAT_MESSAGE_DELETED','chat_message',id,'Message deleted']);
  res.json({ok:true});
});
app.get('/api/admin/chat/edit-logs',requireRole(['SUPER_ADMIN','ADMIN','TEACHER']),async(req,res)=>{
  const [logs]=await q('SELECT e.id,e.message_id,e.old_body,e.new_body,e.created_at,u.display_name editor_name FROM chat_message_edits e LEFT JOIN users u ON u.id=e.editor_user_id ORDER BY e.created_at DESC LIMIT 200');
  res.json({logs});
});

app.post('/api/ai', requireAuth, async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message required' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI is not configured on the backend yet' });
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      instructions: 'You are B4 AI Assistant for a secondary-school Telecommunication class. Explain academic topics clearly and safely. Do not pretend to know private class data unless it is provided. Prefer Arabic Egyptian explanations when the student asks in Arabic, and English when asked in English.',
      input: message
    });
    res.json({ answer: response.output_text || 'No answer returned.' });
  } catch (e) {
    console.error('OpenAI request failed:', e.message);
    res.status(502).json({ error: 'AI request failed' });
  }
});

// Serve the B4 frontend from the same Railway service.
// API routes above always win; all non-API routes fall back to index.html.
const frontendPath = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendPath, { extensions: ['html'] }));
app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => console.log('B4 backend + frontend listening on ' + PORT));
