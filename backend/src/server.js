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
const assignmentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const submissionUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: (req,file,cb) => cb(null, file.mimetype === 'application/pdf') });

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

// Exam/assignment datetime inputs are entered as Egypt local time (UTC+03:00).
// MySQL DATETIME has no timezone, so parse exam values explicitly instead of
// relying on Node's environment timezone (which is commonly UTC on Railway).
function cairoOffsetMs(epochMs=Date.now()) {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(epochMs));
  const get=t=>Number(parts.find(x=>x.type===t)?.value||0);
  const asUtc=Date.UTC(get('year'),get('month')-1,get('day'),get('hour'),get('minute'),get('second'));
  return asUtc-epochMs;
}
function cairoDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return new Date(value.getTime());
  const s = String(value).trim().replace(' ', 'T');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return new Date(value);
  const localAsUtc=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]||0));
  const offset=cairoOffsetMs(localAsUtc);
  return new Date(localAsUtc-offset);
}
function cairoEpoch(value) {
  const d=cairoDate(value);
  const ms=d?.getTime();
  return Number.isFinite(ms)?ms:null;
}
function cairoNow() {
  const now=new Date();
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const get=t=>parts.find(x=>x.type===t)?.value||'00';
  return {epoch_ms:now.getTime(),time_zone:'Africa/Cairo',utc_offset_minutes:Math.round(cairoOffsetMs(now.getTime())/60000),local_iso:get('year')+'-'+get('month')+'-'+get('day')+'T'+get('hour')+':'+get('minute')+':'+get('second')};
}


const chatStreams = new Set();
const teacherChatStreams = new Set();
function pushChatEvent(event, payload) {
  const packet = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of chatStreams) { try { client.res.write(packet); } catch { chatStreams.delete(client); } }
}
function pushTeacherChatEvent(event, payload) {
  const packet = `event: ${event}\\ndata: ${JSON.stringify(payload)}\\n\\n`;
  for (const client of teacherChatStreams) { try { client.res.write(packet); } catch { teacherChatStreams.delete(client); } }
}
setInterval(() => {
  for (const client of chatStreams) { try { client.res.write(': ping\n\n'); } catch { chatStreams.delete(client); } }
  for (const client of teacherChatStreams) { try { client.res.write(': ping\\n\\n'); } catch { teacherChatStreams.delete(client); } }
}, 25000);

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
  ['MANAGE_ROLES','Manage roles'],
  ['MANAGE_PERMISSIONS','Manage permissions'],
  ['VIEW_ADMIN_CENTER','View Admin Center'],
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
  ['VIEW_CLASS','View class'],
  ['MANAGE_BADGES','Manage badges'],
  ['MANAGE_DEVELOPERS','Manage developers'],
  ['MANAGE_TEACHER_CHAT','Teacher chat'],
  ['MANAGE_ANALYTICS','View attendance analytics'],
  ['ADMINISTRATOR','Administrator']
];

async function ensurePermissionSchema() {
  await q("CREATE TABLE IF NOT EXISTS profile_images(entity_type VARCHAR(20) NOT NULL,entity_id BIGINT UNSIGNED NOT NULL,mime_type VARCHAR(120) NOT NULL,data MEDIUMBLOB NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(entity_type,entity_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS chat_typing(user_id BIGINT UNSIGNED PRIMARY KEY,typing TINYINT(1) NOT NULL DEFAULT 0,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  // MySQL does not support ADD COLUMN IF NOT EXISTS on all supported 8.x builds.
  // Check INFORMATION_SCHEMA first so bootstrap is safe and idempotent.
  // Keep the resources enum compatible with older Railway databases that were created before NOTE resources existed.
  const [resourceTypeCol] = await q("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='resources' AND COLUMN_NAME='resource_type' LIMIT 1");
  if (resourceTypeCol[0] && !String(resourceTypeCol[0].COLUMN_TYPE || '').includes("'NOTE'")) {
    await q("ALTER TABLE resources MODIFY COLUMN resource_type ENUM('LINK','FILE','VIDEO','NOTE') NOT NULL DEFAULT 'LINK'");
  }

  const [studentAvatarCol] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='students' AND COLUMN_NAME='avatar_url' LIMIT 1");
  if (!studentAvatarCol.length) await q("ALTER TABLE students ADD COLUMN avatar_url VARCHAR(500) NULL");

  const [teacherAvatarCol] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teachers' AND COLUMN_NAME='avatar_url' LIMIT 1");
  if (!teacherAvatarCol.length) await q("ALTER TABLE teachers ADD COLUMN avatar_url VARCHAR(500) NULL");

  const [sessionVersionCol] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='session_version' LIMIT 1");
  if (!sessionVersionCol.length) await q("ALTER TABLE users ADD COLUMN session_version INT NOT NULL DEFAULT 1");
  const [superFlagCol] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='is_super_admin' LIMIT 1");
  if (!superFlagCol.length) await q("ALTER TABLE users ADD COLUMN is_super_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER role");
  await q("UPDATE users SET is_super_admin=1, role='STUDENT' WHERE role='SUPER_ADMIN'");
  await q("UPDATE users SET role='STUDENT' WHERE role='ADMIN'");
  try {
    await q("DELETE FROM role_permissions WHERE role IN ('ADMIN','SUPER_ADMIN')");
    await q("ALTER TABLE role_permissions MODIFY role ENUM('STUDENT','TEACHER') NOT NULL");
  } catch(e) { /* Existing installations may already have the reduced enum. */ }
  try {
    await q("ALTER TABLE users MODIFY role ENUM('STUDENT','TEACHER') NOT NULL DEFAULT 'STUDENT'");
  } catch(e) { /* Existing installations can keep the legacy enum until their next schema migration. */ }
  await q("CREATE TABLE IF NOT EXISTS b4_attendance(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,attendance_date DATE NOT NULL,status ENUM('PRESENT','ABSENT') NOT NULL DEFAULT 'PRESENT',marked_by BIGINT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uq_attendance(user_id,attendance_date),INDEX idx_attendance_date(attendance_date)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS b4_badges(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,name VARCHAR(120) NOT NULL,description VARCHAR(500) NULL,icon_mime VARCHAR(120) NULL,icon_data MEDIUMBLOB NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS b4_user_badges(user_id BIGINT UNSIGNED NOT NULL,badge_id BIGINT UNSIGNED NOT NULL,assigned_by BIGINT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,badge_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS b4_developers(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,name VARCHAR(120) NOT NULL,title VARCHAR(120) NULL,link_url VARCHAR(500) NULL,image_mime VARCHAR(120) NULL,image_data MEDIUMBLOB NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  const [devTitleCol] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='b4_developers' AND COLUMN_NAME='title' LIMIT 1");
  if (!devTitleCol.length) await q("ALTER TABLE b4_developers ADD COLUMN title VARCHAR(120) NULL AFTER name");
  const [devLinkCol] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='b4_developers' AND COLUMN_NAME='link_url' LIMIT 1");
  if (!devLinkCol.length) await q("ALTER TABLE b4_developers ADD COLUMN link_url VARCHAR(500) NULL AFTER title");
  const [devTitle2Col] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='b4_developers' AND COLUMN_NAME='title2' LIMIT 1");
  if (!devTitle2Col.length) await q("ALTER TABLE b4_developers ADD COLUMN title2 VARCHAR(120) NULL AFTER title");
  await q("CREATE TABLE IF NOT EXISTS b4_teacher_messages(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,body TEXT NOT NULL,reply_to_id BIGINT UNSIGNED NULL,deleted_at DATETIME NULL,deleted_by BIGINT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,edited_at DATETIME NULL,INDEX idx_teacher_chat(created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  const [tmReply] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='b4_teacher_messages' AND COLUMN_NAME='reply_to_id' LIMIT 1"); if(!tmReply.length) await q("ALTER TABLE b4_teacher_messages ADD COLUMN reply_to_id BIGINT UNSIGNED NULL AFTER body");
  const [tmDeleted] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='b4_teacher_messages' AND COLUMN_NAME='deleted_at' LIMIT 1"); if(!tmDeleted.length) await q("ALTER TABLE b4_teacher_messages ADD COLUMN deleted_at DATETIME NULL AFTER reply_to_id");
  const [tmDeletedBy] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='b4_teacher_messages' AND COLUMN_NAME='deleted_by' LIMIT 1"); if(!tmDeletedBy.length) await q("ALTER TABLE b4_teacher_messages ADD COLUMN deleted_by BIGINT UNSIGNED NULL AFTER deleted_at");
  const [tmEdited] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='b4_teacher_messages' AND COLUMN_NAME='edited_at' LIMIT 1"); if(!tmEdited.length) await q("ALTER TABLE b4_teacher_messages ADD COLUMN edited_at DATETIME NULL AFTER created_at");
  await q("CREATE TABLE IF NOT EXISTS b4_teacher_message_edits(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,message_id BIGINT UNSIGNED NOT NULL,editor_user_id BIGINT UNSIGNED NULL,old_body TEXT NOT NULL,new_body TEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_teacher_message_edits(message_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS b4_teacher_typing(user_id BIGINT UNSIGNED PRIMARY KEY,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
await q('CREATE TABLE IF NOT EXISTS resource_files( id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, resource_id BIGINT UNSIGNED NOT NULL, filename VARCHAR(255) NOT NULL, mime_type VARCHAR(120) NOT NULL DEFAULT \'application/pdf\', data MEDIUMBLOB NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE, INDEX idx_resource_files_resource(resource_id) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
  await q('CREATE TABLE IF NOT EXISTS assignment_files( id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, assignment_id BIGINT UNSIGNED NOT NULL, filename VARCHAR(255) NOT NULL, mime_type VARCHAR(120) NOT NULL, data LONGBLOB NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(assignment_id) REFERENCES assignments(id) ON DELETE CASCADE, UNIQUE KEY uq_assignment_file(assignment_id) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
  const [assignmentTimerCol] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='assignments' AND COLUMN_NAME='timer_started_at' LIMIT 1");
  if (!assignmentTimerCol.length) await q("ALTER TABLE assignments ADD COLUMN timer_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER due_at");
  const [examTimerCol] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='exams' AND COLUMN_NAME='timer_started_at' LIMIT 1");
  if (!examTimerCol.length) await q("ALTER TABLE exams ADD COLUMN timer_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER ends_at");
  const [assignmentStartMsCol] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='assignments' AND COLUMN_NAME='timer_started_ms' LIMIT 1");
  if (!assignmentStartMsCol.length) await q("ALTER TABLE assignments ADD COLUMN timer_started_ms BIGINT UNSIGNED NULL AFTER timer_started_at");
  const [assignmentDueMsCol] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='assignments' AND COLUMN_NAME='due_at_ms' LIMIT 1");
  if (!assignmentDueMsCol.length) await q("ALTER TABLE assignments ADD COLUMN due_at_ms BIGINT UNSIGNED NULL AFTER timer_started_ms");
  const [examStartMsCol] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='exams' AND COLUMN_NAME='timer_started_ms' LIMIT 1");
  if (!examStartMsCol.length) await q("ALTER TABLE exams ADD COLUMN timer_started_ms BIGINT UNSIGNED NULL AFTER timer_started_at");
  const [examEndMsCol] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='exams' AND COLUMN_NAME='ends_at_ms' LIMIT 1");
  if (!examEndMsCol.length) await q("ALTER TABLE exams ADD COLUMN ends_at_ms BIGINT UNSIGNED NULL AFTER timer_started_ms");
  // Backfill legacy rows once. created_at is a TIMESTAMP, so UNIX_TIMESTAMP gives its real UTC epoch.
  const [legacyAssignments] = await q("SELECT id,UNIX_TIMESTAMP(created_at)*1000 created_ms,due_at FROM assignments WHERE timer_started_ms IS NULL OR due_at_ms IS NULL");
  for (const row of legacyAssignments) {
    const startMs=Number(row.created_ms)||Date.now();
    const dueMs=cairoEpoch(row.due_at);
    await q("UPDATE assignments SET timer_started_ms=COALESCE(timer_started_ms,?),due_at_ms=COALESCE(due_at_ms,?) WHERE id=?",[startMs,dueMs,row.id]);
  }
  const [legacyExams] = await q("SELECT id,UNIX_TIMESTAMP(created_at)*1000 created_ms,ends_at FROM exams WHERE timer_started_ms IS NULL OR ends_at_ms IS NULL");
  for (const row of legacyExams) {
    const startMs=Number(row.created_ms)||Date.now();
    const endMs=cairoEpoch(row.ends_at);
    await q("UPDATE exams SET timer_started_ms=COALESCE(timer_started_ms,?),ends_at_ms=COALESCE(ends_at_ms,?) WHERE id=?",[startMs,endMs,row.id]);
  }
  await q('CREATE TABLE IF NOT EXISTS assignment_submission_files( id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, submission_id BIGINT UNSIGNED NOT NULL, filename VARCHAR(255) NOT NULL, mime_type VARCHAR(120) NOT NULL, data LONGBLOB NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(submission_id) REFERENCES assignment_submissions(id) ON DELETE CASCADE, UNIQUE KEY uq_submission_file(submission_id) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
  const [assignmentFileType] = await q("SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='assignment_files' AND COLUMN_NAME='data' LIMIT 1");
  if(assignmentFileType[0] && String(assignmentFileType[0].DATA_TYPE).toLowerCase()==='mediumblob') await q("ALTER TABLE assignment_files MODIFY data LONGBLOB NOT NULL");
  const [activationKeyValueCol] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='activation_keys' AND COLUMN_NAME='key_value' LIMIT 1");
  if (!activationKeyValueCol.length) await q("ALTER TABLE activation_keys ADD COLUMN key_value VARCHAR(80) NULL AFTER key_preview");
  const [developerLinkCol] = await q("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='b4_developers' AND COLUMN_NAME='link_url' LIMIT 1");
  if (!developerLinkCol.length) await q("ALTER TABLE b4_developers ADD COLUMN link_url VARCHAR(500) NULL AFTER name");
  await q('CREATE TABLE IF NOT EXISTS user_permissions( user_id BIGINT UNSIGNED NOT NULL, permission_id INT UNSIGNED NOT NULL, granted_by BIGINT UNSIGNED NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,permission_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE, FOREIGN KEY(granted_by) REFERENCES users(id) ON DELETE SET NULL ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
  for (const [code,label] of PERMISSION_DEFS) await q('INSERT IGNORE INTO permissions(code,label) VALUES(?,?)',[code,label]);

  const teacherPerms=['VIEW_CLASS','MANAGE_ASSIGNMENTS','MANAGE_RESOURCES','MANAGE_EXAMS','MANAGE_ANNOUNCEMENTS','MANAGE_SUBJECTS','MANAGE_ATTENDANCE','MANAGE_ANALYTICS','MANAGE_TEACHER_CHAT','USE_AI'];
  for(const code of teacherPerms) await q("INSERT IGNORE INTO role_permissions(role,permission_id) SELECT 'TEACHER',id FROM permissions WHERE code=?",[code]);

  for(const code of ['VIEW_CLASS','USE_AI']) await q("INSERT IGNORE INTO role_permissions(role,permission_id) SELECT 'STUDENT',id FROM permissions WHERE code=?",[code]);
}

async function getPermissionCodes(userId) {
  const [users] = await q('SELECT role,status,is_super_admin FROM users WHERE id=? LIMIT 1',[userId]);
  const user = users[0];
  if (!user || user.status !== 'ACTIVE') return [];
  const [adminFlag] = await q("SELECT 1 FROM user_permissions up JOIN permissions p ON p.id=up.permission_id WHERE up.user_id=? AND p.code='ADMINISTRATOR' LIMIT 1",[userId]);
  if (Number(user.is_super_admin)===1 || adminFlag[0]) {
    const [all] = await q('SELECT code FROM permissions ORDER BY code');
    return all.map(x=>x.code);
  }
  const [rows] = await q('SELECT DISTINCT p.code FROM permissions p LEFT JOIN role_permissions rp ON rp.permission_id=p.id AND rp.role=? LEFT JOIN user_permissions up ON up.permission_id=p.id AND up.user_id=? WHERE rp.permission_id IS NOT NULL OR up.permission_id IS NOT NULL ORDER BY p.code',[user.role,userId]);
  return rows.map(x=>x.code);
}

const requireAuth = async (req,res,next) => { if(!req.session.userId) return res.status(401).json({error:'Login required'}); try { const [r]=await q('SELECT session_version,status FROM users WHERE id=? LIMIT 1',[req.session.userId]); if(!r[0]||r[0].status!=='ACTIVE'||Number(r[0].session_version)!==Number(req.session.sessionVersion||0)){req.session.destroy(()=>{});return res.status(401).json({error:'Session expired. Please log in again'});} next(); } catch(e){res.status(500).json({error:'Authentication check failed'});} };
const requirePermission = permission => async (req,res,next) => {
  if (!req.session.userId) return res.status(401).json({error:'Login required'});
  const [sv]=await q('SELECT session_version,status FROM users WHERE id=? LIMIT 1',[req.session.userId]); if(!sv[0]||sv[0].status!=='ACTIVE'||Number(sv[0].session_version)!==Number(req.session.sessionVersion||0)){req.session.destroy(()=>{});return res.status(401).json({error:'Session expired. Please log in again'});}
  try {
    const permissions=await getPermissionCodes(req.session.userId);
    if(!permissions.includes(permission)) return res.status(403).json({error:'Permission denied',permission});
    req.permissions=permissions; next();
  } catch(e) { console.error('Permission check failed:',e.message); res.status(500).json({error:'Permission check failed'}); }
};
const requireAnyPermission = permissions => async (req,res,next) => {
  if (!req.session.userId) return res.status(401).json({error:'Login required'});
  const [sv]=await q('SELECT session_version,status FROM users WHERE id=? LIMIT 1',[req.session.userId]); if(!sv[0]||sv[0].status!=='ACTIVE'||Number(sv[0].session_version)!==Number(req.session.sessionVersion||0)){req.session.destroy(()=>{});return res.status(401).json({error:'Session expired. Please log in again'});}
  try {
    const granted=await getPermissionCodes(req.session.userId);
    if(!permissions.some(p=>granted.includes(p))) return res.status(403).json({error:'Permission denied'});
    req.permissions=granted; next();
  } catch(e) { console.error('Permission check failed:',e.message); res.status(500).json({error:'Permission check failed'}); }
};

async function userById(id) {
  const [r] = await q(
    `SELECT id,display_name,official_name,role,is_super_admin,status,student_id,teacher_id,avatar_url
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
    SELECT s.id,s.student_code,s.official_name,u.id user_id,
           COALESCE(u.display_name,s.display_name) display_name,COALESCE(u.avatar_url,s.avatar_url) avatar_url
    FROM students s
    LEFT JOIN users u ON u.student_id=s.id AND u.status='ACTIVE'
    WHERE s.class_name='B4'
    ORDER BY s.display_name
  `);
  const [teachers] = await q(`SELECT t.id,t.teacher_code,t.official_name,u.id user_id,COALESCE(u.display_name,t.display_name) display_name,COALESCE(u.avatar_url,t.avatar_url) avatar_url FROM teachers t LEFT JOIN users u ON u.teacher_id=t.id AND u.status='ACTIVE' WHERE t.class_name='B4' ORDER BY t.display_name`);
  const [subjects] = await q(`SELECT id,name,teacher_name,progress FROM subjects WHERE class_name='B4' ORDER BY name`);
  const [assignments] = await q(`
    SELECT a.id,a.title,a.description,a.status,a.subject_id,DATE_FORMAT(a.due_at,'%Y-%m-%d %H:%i:%s') due_at,a.created_by,DATE_FORMAT(a.created_at,'%Y-%m-%d %H:%i:%s') created_at,a.timer_started_ms,a.due_at_ms,s.name subject_name,af.id attachment_id,af.filename attachment_name,af.mime_type attachment_mime
    FROM assignments a LEFT JOIN subjects s ON s.id=a.subject_id LEFT JOIN assignment_files af ON af.assignment_id=a.id
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
    SELECT e.id,e.title,e.description,e.subject_id,e.created_by,DATE_FORMAT(e.created_at,'%Y-%m-%d %H:%i:%s') created_at,e.timer_started_ms,e.ends_at_ms,s.name subject_name,DATE_FORMAT(e.starts_at,'%Y-%m-%d %H:%i:%s') starts_at,DATE_FORMAT(e.ends_at,'%Y-%m-%d %H:%i:%s') ends_at,e.duration_minutes
    FROM exams e LEFT JOIN subjects s ON s.id=e.subject_id
    WHERE e.class_name='B4' ORDER BY e.starts_at IS NULL,e.starts_at
  `);
  const nowMs = Date.now();
  for (const assignment of assignments) {
    assignment.assignment_start_ms = Number(assignment.timer_started_ms) || cairoEpoch(assignment.timer_started_at || assignment.created_at);
    assignment.assignment_due_ms = Number(assignment.due_at_ms) || cairoEpoch(assignment.due_at);
  }
  for (const exam of exams) {
    const startMs = Number(exam.timer_started_ms) || cairoEpoch(exam.timer_started_at || exam.created_at);
    const endMs = Number(exam.ends_at_ms) || cairoEpoch(exam.ends_at);
    exam.exam_start_ms = startMs;
    exam.start_ms = startMs;
    exam.end_ms = endMs;
    exam.status = endMs !== null && nowMs >= endMs ? 'CLOSED' : 'OPEN';
  }
  let attendance=[],messages=[],notifications=[];
  if(req.session.userId) {
    [attendance]=await q(`SELECT attendance_date AS date,status FROM b4_attendance WHERE user_id=? ORDER BY attendance_date DESC LIMIT 60`,[req.session.userId]);
    const [submissions]=await q(`SELECT s.assignment_id,s.id submission_id,s.submitted_at,s.status,s.score,sf.id submission_file_id,sf.filename submission_name FROM assignment_submissions s LEFT JOIN assignment_submission_files sf ON sf.submission_id=s.id WHERE s.user_id=?`,[req.session.userId]);
    const byAssignment=new Map(submissions.map(x=>[Number(x.assignment_id),x]));
    for(const a of assignments){const sub=byAssignment.get(Number(a.id));if(sub)Object.assign(a,sub);}
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
  if(!req.session.userId) return {students,teachers,subjects,schedule,assignments:[],announcements:[],resources:[],exams:[],attendance:[],messages:[],notifications:[]};
  return {server_now_ms:Date.now(),students,teachers,subjects,schedule,assignments,announcements,resources,exams,attendance,messages,notifications};
}

app.get('/api/time',(req,res)=>res.json(cairoNow()));
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
  req.session.sessionVersion = Number(u.session_version||1);
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

app.get('/api/admin/permissions', requireAnyPermission(['MANAGE_PERMISSIONS','MANAGE_ROLES','MANAGE_ADMINS']), async (req,res)=>{
  const [permissions]=await q('SELECT id,code,label FROM permissions ORDER BY code');
  res.json({permissions});
});

app.get('/api/admin/users', requireAnyPermission(['MANAGE_ROLES','MANAGE_ADMINS']), async (req,res)=>{
  const [users]=await q('SELECT u.id,u.display_name,u.official_name,u.role,u.is_super_admin,u.status,u.student_id,u.teacher_id,s.student_code,t.teacher_code FROM users u LEFT JOIN students s ON s.id=u.student_id LEFT JOIN teachers t ON t.id=u.teacher_id ORDER BY u.display_name');
  const result=[];
  for(const u of users){
    const [direct]=await q('SELECT p.code FROM user_permissions up JOIN permissions p ON p.id=up.permission_id WHERE up.user_id=? ORDER BY p.code',[u.id]);
    result.push({...u,direct_permissions:direct.map(x=>x.code),effective_permissions:await getPermissionCodes(u.id)});
  }
  res.json({users:result});
});

app.put('/api/admin/users/:id/permissions', requireAnyPermission(['MANAGE_PERMISSIONS','MANAGE_ROLES','MANAGE_ADMINS']), async (req,res)=>{
  const targetId=Number(req.params.id);
  const codes=Array.isArray(req.body?.permissionCodes)
    ? [...new Set(req.body.permissionCodes.map(x=>String(x).trim()).filter(Boolean))]
    : [];
  if(!Number.isSafeInteger(targetId)) return res.status(400).json({error:'Invalid user id'});
  const [targetRows]=await q('SELECT id,role,is_super_admin,status FROM users WHERE id=? LIMIT 1',[targetId]);
  const target=targetRows[0];
  if(!target) return res.status(404).json({error:'User not found'});
  if(Number(target.is_super_admin)===1) return res.status(403).json({error:'Super Admin always has every permission'});

  // Validate against the canonical server-side permission catalog.
  const invalid=codes.filter(code=>!PERMISSION_DEFS.some(def=>def[0]===code));
  if(invalid.length) return res.status(400).json({error:'One or more permissions are invalid',invalid});

  // Self-heal older databases so every current permission exists.
  for(const [code,label] of PERMISSION_DEFS){
    await q('INSERT IGNORE INTO permissions(code,label) VALUES(?,?)',[code,label]);
  }

  // mysql2 does not expand an array passed to a single IN (?) placeholder.
  // Use one placeholder per code so the validation works correctly.
  const [valid]=codes.length
    ? await q('SELECT id,code FROM permissions WHERE code IN ('+codes.map(()=>'?').join(',')+')',[...codes])
    : [[]];
  const validCodes=new Set(valid.map(x=>x.code));
  if(valid.length!==codes.length || codes.some(code=>!validCodes.has(code))){
    return res.status(400).json({error:'One or more permissions are invalid',invalid:codes.filter(code=>!validCodes.has(code))});
  }
  await q('DELETE FROM user_permissions WHERE user_id=?',[targetId]);
  for(const p of valid) await q('INSERT INTO user_permissions(user_id,permission_id,granted_by) VALUES(?,?,?)',[targetId,p.id,req.session.userId]);
  await q('INSERT INTO security_logs(actor_user_id,action,details) VALUES(?,?,?)',[req.session.userId,'PERMISSIONS_UPDATED',JSON.stringify({target_user_id:targetId,permissions:codes})]);
  await audit(req,'PERMISSIONS_UPDATED','user',targetId,{permissions:codes});
  res.json({ok:true,permissions:await getPermissionCodes(targetId)});
});

app.patch('/api/admin/users/:id/role', requireAnyPermission(['MANAGE_ROLES','MANAGE_ACCOUNTS','MANAGE_ADMINS']), async (req,res)=>{
  const targetId=Number(req.params.id), role=String(req.body?.role||'').toUpperCase();
  const studentId=req.body?.studentId?Number(req.body.studentId):null;
  const teacherId=req.body?.teacherId?Number(req.body.teacherId):null;
  if(!Number.isSafeInteger(targetId)||!['STUDENT','TEACHER'].includes(role)) return res.status(400).json({error:'Role must be STUDENT or TEACHER'});
  const [target]=await q('SELECT id,role,is_super_admin FROM users WHERE id=? LIMIT 1',[targetId]);
  if(!target[0]) return res.status(404).json({error:'User not found'});
  if(Number(target[0].is_super_admin)===1) return res.status(403).json({error:'Super Admin is a system flag, not an assignable role'});
  if(role==='TEACHER'){
    if(!Number.isSafeInteger(teacherId)) return res.status(400).json({error:'Select the teacher profile to link to this account'});
    const [p]=await q("SELECT id FROM teachers WHERE id=? AND class_name='B4' LIMIT 1",[teacherId]);
    if(!p[0]) return res.status(400).json({error:'Teacher profile not found'});
    const [used]=await q('SELECT id FROM users WHERE teacher_id=? AND id<>? LIMIT 1',[teacherId,targetId]);
    if(used[0]) return res.status(400).json({error:'That teacher profile is already linked to another account'});
    await q('UPDATE users SET role=?,teacher_id=?,student_id=NULL WHERE id=?',['TEACHER',teacherId,targetId]);
  }else{
    if(!Number.isSafeInteger(studentId)) return res.status(400).json({error:'Select the student profile to link to this account'});
    const [p]=await q("SELECT id FROM students WHERE id=? AND class_name='B4' LIMIT 1",[studentId]);
    if(!p[0]) return res.status(400).json({error:'Student profile not found'});
    const [used]=await q('SELECT id FROM users WHERE student_id=? AND id<>? LIMIT 1',[studentId,targetId]);
    if(used[0]) return res.status(400).json({error:'That student profile is already linked to another account'});
    await q('UPDATE users SET role=?,student_id=?,teacher_id=NULL WHERE id=?',['STUDENT',studentId,targetId]);
  }
  await audit(req,'ROLE_UPDATED','user',targetId,{role,studentId,teacherId});
  res.json({ok:true,user:await userById(targetId)});
});

app.patch('/api/admin/users/:id/identity', requireAnyPermission(['MANAGE_ACCOUNTS','MANAGE_ROLES','MANAGE_ADMINS']), async (req,res)=>{
  const targetId=Number(req.params.id), type=String(req.body?.type||'').toUpperCase();
  const identityId=Number(req.body?.identityId);
  if(!Number.isSafeInteger(targetId)||!['STUDENT','TEACHER','NONE'].includes(type)) return res.status(400).json({error:'Invalid identity type'});
  const [target]=await q('SELECT id,is_super_admin FROM users WHERE id=? LIMIT 1',[targetId]);
  if(!target[0]) return res.status(404).json({error:'User not found'});
  if(type==='NONE'){
    await q('UPDATE users SET student_id=NULL,teacher_id=NULL WHERE id=?',[targetId]);
  }else if(type==='STUDENT'){
    if(!Number.isSafeInteger(identityId))return res.status(400).json({error:'Student profile is required'});
    const [p]=await q("SELECT id FROM students WHERE id=? AND class_name='B4' LIMIT 1",[identityId]);if(!p[0])return res.status(400).json({error:'Student profile not found'});
    const [used]=await q('SELECT id FROM users WHERE student_id=? AND id<>? LIMIT 1',[identityId,targetId]);if(used[0])return res.status(400).json({error:'That student profile is already linked to another account'});
    await q('UPDATE users SET student_id=?,teacher_id=NULL WHERE id=?',[identityId,targetId]);
  }else{
    if(!Number.isSafeInteger(identityId))return res.status(400).json({error:'Teacher profile is required'});
    const [p]=await q("SELECT id FROM teachers WHERE id=? AND class_name='B4' LIMIT 1",[identityId]);if(!p[0])return res.status(400).json({error:'Teacher profile not found'});
    const [used]=await q('SELECT id FROM users WHERE teacher_id=? AND id<>? LIMIT 1',[identityId,targetId]);if(used[0])return res.status(400).json({error:'That teacher profile is already linked to another account'});
    await q('UPDATE users SET teacher_id=?,student_id=NULL WHERE id=?',[identityId,targetId]);
  }
  await audit(req,'IDENTITY_LINK_UPDATED','user',targetId,{type,identityId:type==='NONE'?null:identityId});
  res.json({ok:true,user:await userById(targetId)});
});

app.get('/api/admin/activation-keys', requirePermission('MANAGE_KEYS'), async (req, res) => {
  const [keys] = await q(`
    SELECT ak.id,ak.key_preview,ak.key_value,ak.status,ak.created_at,ak.expires_at,
           COALESCE(s.display_name,t.display_name) person_name,ak.person_type
    FROM activation_keys ak
    LEFT JOIN students s ON s.id=ak.student_id
    LEFT JOIN teachers t ON t.id=ak.teacher_id
    ORDER BY ak.created_at DESC
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
    INSERT INTO activation_keys(key_hash,key_preview,key_value,person_type,student_id,teacher_id,official_name,created_by)
    VALUES(?,?,?,?,?,?,?,?)
  `, [
    hash,
    raw.slice(0, 11) + '…',
    raw,
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

app.post('/api/admin/activation-keys/:id/delete', requirePermission('MANAGE_KEYS'), async (req,res)=>{
  try {
    const id=String(req.params.id||'').trim();
    if(!/^\\d+$/.test(id)) return res.status(400).json({error:'Invalid activation key'});
    const [r]=await q('DELETE FROM activation_keys WHERE id=?',[id]);
    if(!r.affectedRows) return res.status(404).json({error:'Activation key not found'});
    try { await q("INSERT INTO security_logs(actor_user_id,action,details) VALUES(?,?,?)",[req.session.userId,'ACTIVATION_DELETED',id]); } catch(e) { console.error('Security log failed:',e.message); }
    await audit(req,'ACTIVATION_DELETED','activation_key',Number(id));
    res.json({ok:true});
  } catch(e) {
    console.error('Activation key delete failed:',e);
    res.status(500).json({error:e?.message||'Failed to delete activation key'});
  }
});

app.post('/api/admin/activation-keys/:id/revoke', requirePermission('MANAGE_KEYS'), async (req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)) return res.status(400).json({error:'Invalid activation key'});
  const [r]=await q("UPDATE activation_keys SET status='REVOKED' WHERE id=? AND status='ACTIVE'",[id]);
  if(!r.affectedRows) return res.status(404).json({error:'Active activation key not found'});
  await q("INSERT INTO security_logs(actor_user_id,action,details) VALUES(?,?,?)",[req.session.userId,'ACTIVATION_REVOKED',String(id)]);
  await audit(req,'ACTIVATION_REVOKED','activation_key',id);
  res.json({ok:true});
});

app.delete('/api/admin/activation-keys/:id', requirePermission('MANAGE_KEYS'), async (req,res)=>{
  const id=String(req.params.id||'').trim();
  if(!id) return res.status(400).json({error:'Invalid activation key'});
  const [r]=await q('DELETE FROM activation_keys WHERE id=?',[id]);
  if(!r.affectedRows) return res.status(404).json({error:'Activation key not found'});
  await q("INSERT INTO security_logs(actor_user_id,action,details) VALUES(?,?,?)",[req.session.userId,'ACTIVATION_DELETED',id]);
  await audit(req,'ACTIVATION_DELETED','activation_key',id);
  res.json({ok:true});
});

app.post('/api/admin/teachers',requirePermission('MANAGE_TEACHERS'),async(req,res)=>{
  const {teacherCode,officialName,displayName}=req.body||{};if(!teacherCode||!officialName||!displayName)return res.status(400).json({error:'Teacher code, official name and display name are required'});
  try{const [r]=await q("INSERT INTO teachers(teacher_code,official_name,display_name,class_name) VALUES(?,?,?,'B4')",[teacherCode.trim(),officialName.trim(),displayName.trim()]);await audit(req,'TEACHER_CREATED','teacher',r.insertId,{teacherCode:teacherCode.trim()});res.json({ok:true,id:r.insertId});}catch(e){res.status(400).json({error:e.code==='ER_DUP_ENTRY'?'Teacher code already exists':e.message});}
});
app.patch('/api/admin/teachers/:id',requirePermission('MANAGE_TEACHERS'),async(req,res)=>{const id=Number(req.params.id),{teacherCode,officialName,displayName}=req.body||{};if(!teacherCode||!officialName||!displayName)return res.status(400).json({error:'Teacher code, official name and display name are required'});try{const [r]=await q("UPDATE teachers SET teacher_code=?,official_name=?,display_name=? WHERE id=? AND class_name='B4'",[String(teacherCode).trim(),String(officialName).trim(),String(displayName).trim(),id]);if(!r.affectedRows)return res.status(404).json({error:'Teacher not found'});await audit(req,'TEACHER_UPDATED','teacher',id);res.json({ok:true});}catch(e){res.status(400).json({error:e.code==='ER_DUP_ENTRY'?'Teacher code already exists':e.message})}});
app.delete('/api/admin/teachers/:id',requirePermission('MANAGE_TEACHERS'),async(req,res)=>{const id=Number(req.params.id);const [r]=await q("DELETE FROM teachers WHERE id=? AND class_name='B4'",[id]);if(!r.affectedRows)return res.status(404).json({error:'Teacher not found'});await audit(req,'TEACHER_DELETED','teacher',id);res.json({ok:true});});
app.post('/api/admin/subjects',requirePermission('MANAGE_SUBJECTS'),async(req,res)=>{
  const {name,teacherName='',progress=0}=req.body||{};if(!name?.trim())return res.status(400).json({error:'Subject name is required'});
  try{const [r]=await q("INSERT INTO subjects(name,class_name,teacher_name,progress) VALUES(?,'B4',?,?)",[name.trim(),String(teacherName||'').trim()||null,Math.max(0,Math.min(100,Number(progress)||0))]);await audit(req,'SUBJECT_CREATED','subject',r.insertId,{name:name.trim()});res.json({ok:true,id:r.insertId});}catch(e){res.status(400).json({error:e.code==='ER_DUP_ENTRY'?'Subject already exists':e.message});}
});
app.patch('/api/admin/subjects/:id',requirePermission('MANAGE_SUBJECTS'),async(req,res)=>{const id=Number(req.params.id),{name,teacherName='',progress=0}=req.body||{};const [r]=await q("UPDATE subjects SET name=?,teacher_name=?,progress=? WHERE id=? AND class_name='B4'",[String(name||'').trim(),String(teacherName||'').trim()||null,Math.max(0,Math.min(100,Number(progress)||0)),id]);if(!r.affectedRows)return res.status(404).json({error:'Subject not found'});await audit(req,'SUBJECT_UPDATED','subject',id);res.json({ok:true});});
app.delete('/api/admin/subjects/:id',requirePermission('MANAGE_SUBJECTS'),async(req,res)=>{const id=Number(req.params.id),[r]=await q("DELETE FROM subjects WHERE id=? AND class_name='B4'",[id]);if(!r.affectedRows)return res.status(404).json({error:'Subject not found'});await audit(req,'SUBJECT_DELETED','subject',id);res.json({ok:true});});

app.get('/api/admin/people', requireAnyPermission(['MANAGE_ACCOUNTS','MANAGE_ADMINS','MANAGE_STUDENTS','MANAGE_TEACHERS','MANAGE_KEYS']), async (req,res) => {
  const [students] = await q(`SELECT id,student_code,official_name,display_name,avatar_url FROM students WHERE class_name='B4' ORDER BY display_name`);
  const [teachers] = await q(`SELECT id,teacher_code,official_name,display_name,avatar_url FROM teachers WHERE class_name='B4' ORDER BY display_name`);
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
    res.json({ok:true,id:r.insertId});
  } catch(e) {
    res.status(400).json({error:e.code==='ER_DUP_ENTRY'?'Student code already exists':e.message});
  }
});
app.patch('/api/admin/students/:id',requirePermission('MANAGE_STUDENTS'),async(req,res)=>{const id=Number(req.params.id),{studentCode,officialName,displayName}=req.body||{};if(!studentCode||!officialName||!displayName)return res.status(400).json({error:'Student code, official name and display name are required'});try{const [r]=await q("UPDATE students SET student_code=?,official_name=?,display_name=? WHERE id=? AND class_name='B4'",[String(studentCode).trim(),String(officialName).trim(),String(displayName).trim(),id]);if(!r.affectedRows)return res.status(404).json({error:'Student not found'});await audit(req,'STUDENT_UPDATED','student',id);res.json({ok:true});}catch(e){res.status(400).json({error:e.code==='ER_DUP_ENTRY'?'Student code already exists':e.message})}});

const imageUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024},fileFilter:(req,file,cb)=>cb(null,['image/png','image/jpeg','image/webp'].includes(file.mimetype))});
app.delete('/api/admin/students/:id',requirePermission('MANAGE_STUDENTS'),async(req,res)=>{const id=Number(req.params.id);const [r]=await q("DELETE FROM students WHERE id=? AND class_name='B4'",[id]);if(!r.affectedRows)return res.status(404).json({error:'Student not found'});await audit(req,'STUDENT_DELETED','student',id);res.json({ok:true});});
async function saveAvatar(type,id,file){await q('INSERT INTO profile_images(entity_type,entity_id,mime_type,data) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE mime_type=VALUES(mime_type),data=VALUES(data)',[type,id,file.mimetype,file.buffer]);return '/api/profile-images/'+type+'/'+id;}
app.get('/api/profile-images/:type/:id',async(req,res)=>{const type=String(req.params.type),id=Number(req.params.id);if(!['user','student','teacher'].includes(type)||!Number.isSafeInteger(id))return res.status(400).end();const [r]=await q('SELECT mime_type,data FROM profile_images WHERE entity_type=? AND entity_id=? LIMIT 1',[type,id]);if(!r[0])return res.status(404).end();res.setHeader('Content-Type',r[0].mime_type);res.setHeader('Cache-Control','public,max-age=300');res.send(r[0].data);});
app.post('/api/auth/avatar',requireAuth,imageUpload.single('file'),async(req,res)=>{
  if(!req.file)return res.status(400).json({error:'PNG, JPG or WEBP image required'});
  const url=await saveAvatar('user',req.session.userId,req.file);
  await q('UPDATE users SET avatar_url=? WHERE id=?',[url,req.session.userId]);
  await audit(req,'AVATAR_UPDATED','user',req.session.userId);
  const avatar=url+'?v='+Date.now();
  pushChatEvent('profile',{type:'profile',userId:req.session.userId,avatar_url:avatar});pushTeacherChatEvent('profile',{type:'profile',userId:req.session.userId,avatar_url:avatar});
  res.json({ok:true,avatar_url:avatar,user:await userById(req.session.userId)});
});
app.post('/api/admin/students/:id/avatar',requirePermission('MANAGE_STUDENTS'),imageUpload.single('file'),async(req,res)=>{const id=Number(req.params.id);if(!req.file)return res.status(400).json({error:'PNG, JPG or WEBP image required'});const [r]=await q("SELECT id FROM students WHERE id=? AND class_name='B4' LIMIT 1",[id]);if(!r[0])return res.status(404).json({error:'Student not found'});const url=await saveAvatar('student',id,req.file);await q('UPDATE students SET avatar_url=? WHERE id=?',[url,id]);const [linked]=await q('SELECT id FROM users WHERE student_id=? AND status=\'ACTIVE\'',[id]);for(const u of linked)await q('UPDATE users SET avatar_url=? WHERE id=?',[url,u.id]);await audit(req,'AVATAR_UPDATED','student',id);for(const u of linked){pushChatEvent('profile',{type:'profile',userId:u.id,avatar_url:url+'?v='+Date.now()});pushTeacherChatEvent('profile',{type:'profile',userId:u.id,avatar_url:url+'?v='+Date.now()});}res.json({ok:true,avatar_url:url+'?v='+Date.now()});});
app.post('/api/admin/teachers/:id/avatar',requirePermission('MANAGE_TEACHERS'),imageUpload.single('file'),async(req,res)=>{const id=Number(req.params.id);if(!req.file)return res.status(400).json({error:'PNG, JPG or WEBP image required'});const [r]=await q("SELECT id FROM teachers WHERE id=? AND class_name='B4' LIMIT 1",[id]);if(!r[0])return res.status(404).json({error:'Teacher not found'});const url=await saveAvatar('teacher',id,req.file);await q('UPDATE teachers SET avatar_url=? WHERE id=?',[url,id]);const [linked]=await q('SELECT id FROM users WHERE teacher_id=? AND status=\'ACTIVE\'',[id]);for(const u of linked)await q('UPDATE users SET avatar_url=? WHERE id=?',[url,u.id]);await audit(req,'AVATAR_UPDATED','teacher',id);for(const u of linked)pushChatEvent('profile',{type:'profile',userId:u.id,avatar_url:url+'?v='+Date.now()});res.json({ok:true,avatar_url:url+'?v='+Date.now()});});
app.post('/api/admin/assignments', requirePermission('MANAGE_ASSIGNMENTS'), async (req,res) => {
  const {title,description='',subjectId=null,dueAt=null} = req.body || {};
  if(!title?.trim()) return res.status(400).json({error:'Assignment title is required'});
  const startMs=Date.now(), dueMs=cairoEpoch(dueAt);
  if(dueAt && !Number.isFinite(dueMs)) return res.status(400).json({error:'Invalid deadline'});
  if(dueMs!==null && dueMs<=startMs) return res.status(400).json({error:'Deadline must be after the current time'});
  const [r]=await q(`INSERT INTO assignments(title,description,subject_id,class_name,due_at,timer_started_ms,due_at_ms,created_by) VALUES(?,?,?,'B4',?,?,?,?)`,
    [title.trim(),description.trim(),subjectId||null,dueAt||null,startMs,dueMs,req.session.userId]);
  await audit(req,'ASSIGNMENT_CREATED','assignment',r.insertId,{title:title.trim()});res.json({ok:true,id:r.insertId});
});
app.post('/api/admin/assignments/:id/file', requirePermission('MANAGE_ASSIGNMENTS'), assignmentUpload.single('file'), async(req,res)=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||!req.file)return res.status(400).json({error:'Valid assignment id and image/PDF file are required'});try{await assertTeacherOwner(req,'assignments',id)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}const [a]=await q("SELECT id FROM assignments WHERE id=? AND class_name='B4' LIMIT 1",[id]);if(!a[0])return res.status(404).json({error:'Assignment not found'});await q('DELETE FROM assignment_files WHERE assignment_id=?',[id]);const [r]=await q('INSERT INTO assignment_files(assignment_id,filename,mime_type,data) VALUES(?,?,?,?)',[id,req.file.originalname,req.file.mimetype,req.file.buffer]);await audit(req,'ASSIGNMENT_FILE_UPLOADED','assignment',id,{filename:req.file.originalname});res.json({ok:true,fileId:r.insertId})});
app.delete('/api/admin/assignments/:id/file',requirePermission('MANAGE_ASSIGNMENTS'),async(req,res)=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id))return res.status(400).json({error:'Invalid assignment id'});try{await assertTeacherOwner(req,'assignments',id);const [r]=await q('DELETE FROM assignment_files WHERE assignment_id=?',[id]);if(!r.affectedRows)return res.status(404).json({error:'Assignment file not found'});await audit(req,'ASSIGNMENT_FILE_DELETED','assignment',id,null);res.json({ok:true})}catch(e){res.status(e.statusCode||500).json({error:e.message||'Could not delete assignment file'})}});
app.get('/api/assignments/files/:id', requireAuth, async(req,res)=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id))return res.status(400).end();const [rows]=await q('SELECT af.filename,af.mime_type,af.data FROM assignment_files af JOIN assignments a ON a.id=af.assignment_id WHERE af.id=? AND a.class_name=\'B4\' LIMIT 1',[id]);if(!rows[0])return res.status(404).end();res.setHeader('Content-Type',rows[0].mime_type);res.setHeader('Content-Disposition','inline; filename*=UTF-8\'\''+encodeURIComponent(rows[0].filename));res.send(rows[0].data)});
app.post('/api/assignments/:id/submission', requireAuth, submissionUpload.single('file'), async(req,res)=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||!req.file)return res.status(400).json({error:'A file is required'});try{const [a]=await q("SELECT id,status,DATE_FORMAT(due_at,'%Y-%m-%d %H:%i:%s') due_at FROM assignments WHERE id=? AND class_name='B4' LIMIT 1",[id]);if(!a[0])return res.status(404).json({error:'Assignment not found'});if(a[0].status!=='OPEN')return res.status(400).json({error:'This assignment is not open'});if(a[0].due_at&&cairoEpoch(a[0].due_at)<=Date.now())return res.status(400).json({error:'The assignment deadline has passed'});const [existing]=await q('SELECT id FROM assignment_submissions WHERE assignment_id=? AND user_id=? LIMIT 1',[id,req.session.userId]);let submissionId;if(existing[0]){submissionId=existing[0].id;await q('UPDATE assignment_submissions SET status=\'SUBMITTED\',score=NULL,submitted_at=CURRENT_TIMESTAMP WHERE id=?',[submissionId]);await q('DELETE FROM assignment_submission_files WHERE submission_id=?',[submissionId])}else{const [r]=await q('INSERT INTO assignment_submissions(assignment_id,user_id,status) VALUES(?,?,\'SUBMITTED\')',[id,req.session.userId]);submissionId=r.insertId}await q('INSERT INTO assignment_submission_files(submission_id,filename,mime_type,data) VALUES(?,?,?,?)',[submissionId,req.file.originalname,req.file.mimetype||'application/octet-stream',req.file.buffer]);await audit(req,'ASSIGNMENT_SUBMITTED','assignment',id,{filename:req.file.originalname});res.json({ok:true,submissionId})}catch(e){console.error('Assignment submission failed:',e);res.status(500).json({error:'Could not submit assignment'})}});
app.delete('/api/assignments/:id/submission',requireAuth,async(req,res)=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id))return res.status(400).json({error:'Invalid assignment id'});try{const [rows]=await q('SELECT id FROM assignment_submissions WHERE assignment_id=? AND user_id=? LIMIT 1',[id,req.session.userId]);if(!rows[0])return res.status(404).json({error:'Submission not found'});await q('DELETE FROM assignment_submissions WHERE id=?',[rows[0].id]);await audit(req,'ASSIGNMENT_SUBMISSION_DELETED','assignment',id,null);res.json({ok:true})}catch(e){console.error('Assignment submission delete failed:',e);res.status(500).json({error:'Could not delete submission'})}});
app.get('/api/assignments/submissions/files/:id', requireAuth, async(req,res)=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id))return res.status(400).end();const [rows]=await q('SELECT sf.filename,sf.mime_type,sf.data FROM assignment_submission_files sf JOIN assignment_submissions s ON s.id=sf.submission_id JOIN assignments a ON a.id=s.assignment_id WHERE sf.submission_id=? AND a.class_name=\'B4\' AND s.user_id=? LIMIT 1',[id,req.session.userId]);if(!rows[0])return res.status(404).end();res.setHeader('Content-Type',rows[0].mime_type||'application/octet-stream');res.setHeader('Content-Disposition','inline; filename*=UTF-8\'\''+encodeURIComponent(rows[0].filename));res.send(rows[0].data)});


app.get('/api/admin/assignment-submissions', requirePermission('MANAGE_ASSIGNMENTS'), async(req,res)=>{
  try{
    const [actor]=await q('SELECT role,is_super_admin FROM users WHERE id=? LIMIT 1',[req.session.userId]);
    const assignmentId=req.query.assignmentId?Number(req.query.assignmentId):null;
    const params=[];let where="a.class_name='B4'";
    if(Number.isSafeInteger(assignmentId)){where+=' AND a.id=?';params.push(assignmentId)}
    if(actor[0]?.role==='TEACHER'&&Number(actor[0]?.is_super_admin)!==1){where+=' AND a.created_by=?';params.push(req.session.userId)}
    const [submissions]=await q('SELECT s.id submission_id,s.assignment_id,s.submitted_at,s.status,s.score,a.title assignment_title,u.id user_id,u.display_name,st.student_code,sf.id file_id,sf.filename,sf.mime_type FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN users u ON u.id=s.user_id LEFT JOIN students st ON st.id=u.student_id LEFT JOIN assignment_submission_files sf ON sf.submission_id=s.id WHERE '+where+' ORDER BY s.submitted_at DESC',params);
    res.json({submissions});
  }catch(e){console.error('Assignment submissions list failed:',e);res.status(500).json({error:'Could not load assignment submissions'})}
});
app.get('/api/admin/assignment-submissions/files/:id', requirePermission('MANAGE_ASSIGNMENTS'), async(req,res)=>{
  const id=Number(req.params.id);if(!Number.isSafeInteger(id))return res.status(400).end();
  try{
    const [actor]=await q('SELECT role,is_super_admin FROM users WHERE id=? LIMIT 1',[req.session.userId]);
    const [rows]=await q("SELECT sf.filename,sf.mime_type,sf.data,a.created_by FROM assignment_submission_files sf JOIN assignment_submissions sub ON sub.id=sf.submission_id JOIN assignments a ON a.id=sub.assignment_id WHERE sf.id=? AND a.class_name='B4' LIMIT 1",[id]);
    if(!rows[0])return res.status(404).end();
    if(actor[0]?.role==='TEACHER'&&Number(actor[0]?.is_super_admin)!==1&&Number(rows[0].created_by)!==Number(req.session.userId))return res.status(403).json({error:'Permission denied'});
    res.setHeader('Content-Type',rows[0].mime_type||'application/octet-stream');
    res.setHeader('Content-Disposition','inline; filename="'+encodeURIComponent(rows[0].filename)+'"');
    res.send(rows[0].data);
  }catch(e){console.error('Assignment submission file failed:',e);res.status(500).end()}
});
app.post('/api/admin/announcements', requirePermission('MANAGE_ANNOUNCEMENTS'), async (req,res) => {
  const {title,body,category='General'} = req.body || {};
  if(!title?.trim() || !body?.trim()) return res.status(400).json({error:'Title and body are required'});
  const [r]=await q(`INSERT INTO announcements(title,body,category,class_name,created_by) VALUES(?,?,?,'B4',?)`,
    [title.trim(),body.trim(),category.trim(),req.session.userId]);
  await audit(req,'ANNOUNCEMENT_CREATED','announcement',r.insertId,{title:title.trim()});
  res.json({ok:true,id:r.insertId});
});

app.patch('/api/admin/assignments/:id',requirePermission('MANAGE_ASSIGNMENTS'),async(req,res)=>{const id=Number(req.params.id);try{await assertTeacherOwner(req,'assignments',id)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}const {title,description='',subjectId=null,dueAt=null,status='OPEN'}=req.body||{};const startMs=Date.now(),dueMs=cairoEpoch(dueAt);if(dueAt&&!Number.isFinite(dueMs))return res.status(400).json({error:'Invalid deadline'});if(dueMs!==null&&dueMs<=startMs)return res.status(400).json({error:'Deadline must be after the current time'});const [r]=await q("UPDATE assignments SET title=?,description=?,subject_id=?,due_at=?,timer_started_ms=?,due_at_ms=?,timer_started_at=CURRENT_TIMESTAMP,status=? WHERE id=? AND class_name='B4'",[String(title||'').trim(),String(description||'').trim(),subjectId||null,dueAt||null,startMs,dueMs,['OPEN','DONE','CLOSED'].includes(status)?status:'OPEN',id]);if(!r.affectedRows)return res.status(404).json({error:'Assignment not found'});await audit(req,'ASSIGNMENT_UPDATED','assignment',id);res.json({ok:true});});
app.delete('/api/admin/assignments/:id',requirePermission('MANAGE_ASSIGNMENTS'),async(req,res)=>{const id=Number(req.params.id);try{await assertTeacherOwner(req,'assignments',id)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}const [r]=await q("DELETE FROM assignments WHERE id=? AND class_name='B4'",[id]);if(!r.affectedRows)return res.status(404).json({error:'Assignment not found'});await audit(req,'ASSIGNMENT_DELETED','assignment',id);res.json({ok:true});});
app.patch('/api/admin/resources/:id',requirePermission('MANAGE_RESOURCES'),async(req,res)=>{const id=Number(req.params.id);try{await assertTeacherOwner(req,'resources',id)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}const {title,description='',url='',subjectId=null}=req.body||{};const [r]=await q("UPDATE resources SET title=?,description=?,url=?,subject_id=? WHERE id=? AND class_name='B4'",[String(title||'').trim(),String(description||'').trim(),String(url||'').trim()||null,subjectId||null,id]);if(!r.affectedRows)return res.status(404).json({error:'Resource not found'});await audit(req,'RESOURCE_UPDATED','resource',id);res.json({ok:true});});
app.delete('/api/admin/resources/:id',requirePermission('MANAGE_RESOURCES'),async(req,res)=>{const id=Number(req.params.id);try{await assertTeacherOwner(req,'resources',id)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}const [r]=await q("DELETE FROM resources WHERE id=? AND class_name='B4'",[id]);if(!r.affectedRows)return res.status(404).json({error:'Resource not found'});await audit(req,'RESOURCE_DELETED','resource',id);res.json({ok:true});});
app.patch('/api/admin/exams/:id',requirePermission('MANAGE_EXAMS'),async(req,res)=>{const id=Number(req.params.id);try{await assertTeacherOwner(req,'exams',id)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}const {title,description='',subjectId=null,startsAt=null,endsAt=null,durationMinutes=null,questions=[]}=req.body||{};if(!title?.trim()||!Array.isArray(questions)||!questions.length)return res.status(400).json({error:'Exam title and questions are required'});if(startsAt&&endsAt&&new Date(endsAt)<=new Date(startsAt))return res.status(400).json({error:'Deadline must be after start time'});const conn=await pool.getConnection();try{await conn.beginTransaction();const startMs=Date.now(),endMs=cairoEpoch(endsAt);if(endsAt&&!Number.isFinite(endMs))throw new Error('Invalid deadline');if(endMs!==null&&endMs<=startMs)throw new Error('Deadline must be after the current time');const [r]=await conn.execute("UPDATE exams SET title=?,description=?,subject_id=?,starts_at=?,ends_at=?,timer_started_ms=?,ends_at_ms=?,timer_started_at=CURRENT_TIMESTAMP,duration_minutes=? WHERE id=? AND class_name='B4'",[title.trim(),String(description||'').trim(),subjectId||null,startsAt||null,endsAt||null,startMs,endMs,durationMinutes?Number(durationMinutes):null,id]);if(!r.affectedRows)throw new Error('Exam not found');await conn.execute('DELETE FROM exam_questions WHERE exam_id=?',[id]);let inserted=0;for(let i=0;i<questions.length;i++){const qn=questions[i],text=String(qn.questionText||'').trim();if(!text)continue;const type=['MCQ','TRUE_FALSE','SHORT'].includes(qn.questionType)?qn.questionType:'MCQ';const opts=type==='MCQ'?(Array.isArray(qn.options)?qn.options.map(v=>String(v||'').trim()).filter(Boolean).slice(0,8):[]):null;if(type==='MCQ'&&(!opts||opts.length<2))throw new Error('MCQ needs at least two options');const correct=type==='MCQ'?String(qn.correctAnswer||'').trim():(type==='TRUE_FALSE'?(String(qn.correctAnswer||'TRUE').toUpperCase()==='TRUE'?'TRUE':'FALSE'):null);if(type==='MCQ'&&!opts.includes(correct))throw new Error('Correct answer must be one of the MCQ options');await conn.execute('INSERT INTO exam_questions(exam_id,question_text,question_type,options_json,correct_answer,points,sort_order) VALUES(?,?,?,?,?,?,?)',[id,text,type,opts?JSON.stringify(opts):null,correct,Math.max(.5,Number(qn.points)||1),inserted++]);}if(!inserted)throw new Error('Add at least one valid question');await conn.commit();await audit(req,'EXAM_UPDATED','exam',id);res.json({ok:true});}catch(e){await conn.rollback();res.status(400).json({error:e.message})}finally{conn.release()}});
app.delete('/api/admin/exams/:id',requirePermission('MANAGE_EXAMS'),async(req,res)=>{const id=Number(req.params.id);try{await assertTeacherOwner(req,'exams',id)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}const [r]=await q("DELETE FROM exams WHERE id=? AND class_name='B4'",[id]);if(!r.affectedRows)return res.status(404).json({error:'Exam not found'});await audit(req,'EXAM_DELETED','exam',id);res.json({ok:true});});
app.patch('/api/admin/announcements/:id',requirePermission('MANAGE_ANNOUNCEMENTS'),async(req,res)=>{const id=Number(req.params.id),{title,body,category='General'}=req.body||{};const [r]=await q("UPDATE announcements SET title=?,body=?,category=? WHERE id=? AND class_name='B4'",[String(title||'').trim(),String(body||'').trim(),String(category||'General').trim(),id]);if(!r.affectedRows)return res.status(404).json({error:'Announcement not found'});await audit(req,'ANNOUNCEMENT_UPDATED','announcement',id);res.json({ok:true});});
app.delete('/api/admin/announcements/:id',requirePermission('MANAGE_ANNOUNCEMENTS'),async(req,res)=>{const id=Number(req.params.id),[r]=await q("DELETE FROM announcements WHERE id=? AND class_name='B4'",[id]);if(!r.affectedRows)return res.status(404).json({error:'Announcement not found'});await audit(req,'ANNOUNCEMENT_DELETED','announcement',id);res.json({ok:true});});
app.put('/api/admin/schedule',requirePermission('MANAGE_SCHEDULE'),async(req,res)=>{const rows=Array.isArray(req.body?.schedule)?req.body.schedule:[],conn=await pool.getConnection();try{await conn.beginTransaction();await conn.execute("DELETE FROM schedule WHERE class_name='B4'");for(const [i,row] of rows.entries())await conn.execute("INSERT INTO schedule(class_name,day_order,day_name,p1,p2,p3,p4) VALUES('B4',?,?,?,?,?,?)",[i+1,String(row.day_name||'Day '+(i+1)),String(row.p1||''),String(row.p2||''),String(row.p3||''),String(row.p4||'')]);await conn.commit();await audit(req,'SCHEDULE_UPDATED','schedule',null,{rows:rows.length});res.json({ok:true});}catch(e){await conn.rollback();res.status(400).json({error:e.message})}finally{conn.release()}});
app.get('/api/admin/logs',requirePermission('VIEW_LOGS'),async(req,res)=>{const [activity]=await q('SELECT l.id,l.action,l.entity_type,l.entity_id,l.details,l.created_at,u.display_name actor_name FROM activity_logs l LEFT JOIN users u ON u.id=l.actor_user_id ORDER BY l.created_at DESC LIMIT 500');const [security]=await q('SELECT l.id,l.action,l.details,l.created_at,u.display_name actor_name FROM security_logs l LEFT JOIN users u ON u.id=l.actor_user_id ORDER BY l.created_at DESC LIMIT 500');res.json({activity,security});});
app.get('/api/exams/:id/edit',requirePermission('MANAGE_EXAMS'),async(req,res)=>{const id=Number(req.params.id);try{await assertTeacherOwner(req,'exams',id)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}const [rows]=await q("SELECT id,title,description,subject_id,starts_at,ends_at,duration_minutes,status,created_by FROM exams WHERE id=? AND class_name='B4' LIMIT 1",[id]);if(!rows[0])return res.status(404).json({error:'Exam not found'});const [questions]=await q('SELECT id,question_text,question_type,options_json,correct_answer,points,sort_order FROM exam_questions WHERE exam_id=? ORDER BY sort_order',[id]);res.json({exam:rows[0],questions:questions.map(x=>({...x,options_json:typeof x.options_json==='string'?(JSON.parse(x.options_json||'[]')):(x.options_json||[])}))});});
app.get('/api/admin/exams/:id/submissions/:attemptId',requirePermission('MANAGE_EXAMS'),async(req,res)=>{
  const examId=Number(req.params.id),attemptId=Number(req.params.attemptId);
  if(!Number.isSafeInteger(examId)||!Number.isSafeInteger(attemptId)) return res.status(400).json({error:'Invalid submission'});
  try{await assertTeacherOwner(req,'exams',examId)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}
  const [attemptRows]=await q(`SELECT a.id,a.exam_id,a.user_id,a.status,a.score,a.started_at,a.submitted_at,u.display_name,u.official_name,e.title,e.subject_id
    FROM exam_attempts a JOIN users u ON u.id=a.user_id JOIN exams e ON e.id=a.exam_id WHERE a.id=? AND a.exam_id=? LIMIT 1`,[attemptId,examId]);
  if(!attemptRows[0]) return res.status(404).json({error:'Submission not found'});
  const [questions]=await q(`SELECT q.id,q.question_text,q.question_type,q.options_json,q.correct_answer,q.points,
    ans.answer_text,ans.is_correct,ans.points_awarded FROM exam_questions q
    LEFT JOIN exam_answers ans ON ans.question_id=q.id AND ans.attempt_id=?
    WHERE q.exam_id=? ORDER BY q.sort_order`,[attemptId,examId]);
  const total=questions.reduce((n,x)=>n+Number(x.points||0),0);
  res.json({attempt:attemptRows[0],total,percent:total?Math.round(Number(attemptRows[0].score||0)/total*100):0,
    questions:questions.map(x=>({...x,options_json:typeof x.options_json==='string'?(JSON.parse(x.options_json||'[]')):(x.options_json||[])}))});
});

app.get('/api/exams/:id/result',requireAuth,async(req,res)=>{const id=Number(req.params.id),[r]=await q('SELECT a.id,a.status,a.score,a.started_at,a.submitted_at,e.title,e.ends_at,e.duration_minutes FROM exam_attempts a JOIN exams e ON e.id=a.exam_id WHERE a.exam_id=? AND a.user_id=? LIMIT 1',[id,req.session.userId]);if(!r[0])return res.status(404).json({error:'No exam submission yet'});const [tot]=await q('SELECT COALESCE(SUM(points),0) total FROM exam_questions WHERE exam_id=?',[id]);const total=Number(tot[0]?.total||0),score=Number(r[0].score||0);res.json({attempt:r[0],percent:total?Math.round(score/total*100):0,total});});

app.get('/api/admin/exams/:id/submissions',requirePermission('MANAGE_EXAMS'),async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)) return res.status(400).json({error:'Invalid exam id'});
  try{await assertTeacherOwner(req,'exams',id)}catch(e){return res.status(e.statusCode||403).json({error:e.message})}
  const [rows]=await q(`SELECT a.id,a.user_id,a.status,a.score,a.started_at,a.submitted_at,u.display_name,u.official_name,
    COALESCE((SELECT SUM(points) FROM exam_questions WHERE exam_id=a.exam_id),0) total
    FROM exam_attempts a JOIN users u ON u.id=a.user_id WHERE a.exam_id=? ORDER BY a.submitted_at DESC,a.started_at DESC`,[id]);
  res.json({submissions:rows.map(x=>({...x,percent:Number(x.total)?Math.round(Number(x.score||0)/Number(x.total)*100):0}))});
});

app.get('/api/chat/stream',requireAuth,async(req,res)=>{
  res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
  res.flushHeaders?.();
  const client={res,userId:req.session.userId};
  chatStreams.add(client);
  res.write(': connected\n\n');
  req.on('close',()=>chatStreams.delete(client));
});

app.get('/api/profile/live',requireAuth,async(req,res)=>{
  const [users]=await q('SELECT id,avatar_url,display_name,student_id,teacher_id FROM users WHERE status=\'ACTIVE\'');
  res.json({users});
});

app.get('/api/chat/messages',requireAuth,async(req,res)=>{
  const [messages]=await q(`SELECT m.id,m.body,m.created_at,m.edited_at,m.user_id,m.reply_to_id,u.display_name,u.avatar_url,rm.body reply_body,ru.display_name reply_display_name
    FROM chat_messages m LEFT JOIN users u ON u.id=m.user_id
    LEFT JOIN chat_messages rm ON rm.id=m.reply_to_id LEFT JOIN users ru ON ru.id=rm.user_id
    WHERE m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 100`);
  messages.reverse();
  res.json({messages});
});

app.post('/api/chat/messages',requireAuth,async(req,res)=>{
  const body=String(req.body?.body||'').trim();
  const replyToId=req.body?.replyToId?Number(req.body.replyToId):null;
  if(!body||body.length>4000)return res.status(400).json({error:'Message is empty or too long'});
  if(replyToId){const [reply]=await q('SELECT id FROM chat_messages WHERE id=? AND deleted_at IS NULL LIMIT 1',[replyToId]);if(!reply[0])return res.status(400).json({error:'Reply target not found'});}
  const [r]=await q('INSERT INTO chat_messages(user_id,body,reply_to_id) VALUES(?,?,?)',[req.session.userId,body,replyToId||null]);
  const [rows]=await q(`SELECT m.id,m.body,m.created_at,m.edited_at,m.user_id,m.reply_to_id,u.display_name,u.avatar_url,rm.body reply_body,ru.display_name reply_display_name FROM chat_messages m JOIN users u ON u.id=m.user_id LEFT JOIN chat_messages rm ON rm.id=m.reply_to_id LEFT JOIN users ru ON ru.id=rm.user_id WHERE m.id=?`,[r.insertId]);
  res.json({message:rows[0]});
  pushChatEvent('chat',{type:'created',message:rows[0]});
});
app.patch('/api/chat/messages/:id',requireAuth,async(req,res)=>{
  const id=Number(req.params.id),body=String(req.body?.body||'').trim();
  if(!Number.isSafeInteger(id)||!body||body.length>4000)return res.status(400).json({error:'Invalid message'});
  const [rows]=await q('SELECT id,user_id,body,deleted_at FROM chat_messages WHERE id=? LIMIT 1',[id]);const m=rows[0];
  if(!m)return res.status(404).json({error:'Message not found'});
  if(m.deleted_at)return res.status(400).json({error:'Deleted message cannot be edited'});
  const permissions=await getPermissionCodes(req.session.userId);
  const canEdit=Number(m.user_id)===Number(req.session.userId)||permissions.includes('MANAGE_CHAT');
  if(!canEdit)return res.status(403).json({error:'Permission denied'});
  if(body===m.body)return res.status(400).json({error:'No changes made'});
  await q('INSERT INTO chat_message_edits(message_id,editor_user_id,old_body,new_body) VALUES(?,?,?,?)',[id,req.session.userId,m.body,body]);
  await q('UPDATE chat_messages SET body=?,edited_at=NOW() WHERE id=?',[body,id]);
  await q('INSERT INTO activity_logs(actor_user_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)',[req.session.userId,'CHAT_MESSAGE_EDITED','chat_message',id,JSON.stringify({old_body:m.body,new_body:body})]);
  const [updated]=await q('SELECT m.id,m.body,m.created_at,m.edited_at,m.user_id,m.reply_to_id,u.display_name,u.avatar_url,rm.body reply_body,ru.display_name reply_display_name FROM chat_messages m JOIN users u ON u.id=m.user_id LEFT JOIN chat_messages rm ON rm.id=m.reply_to_id LEFT JOIN users ru ON ru.id=rm.user_id WHERE m.id=?',[id]);
  res.json({message:updated[0]});
  pushChatEvent('chat',{type:'updated',message:updated[0]});
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
  pushChatEvent('chat',{type:'deleted',id});
});
app.get('/api/admin/chat/edit-logs',requirePermission('VIEW_LOGS'),async(req,res)=>{
  const [logs]=await q('SELECT e.id,e.message_id,e.old_body,e.new_body,e.created_at,u.display_name editor_name FROM chat_message_edits e LEFT JOIN users u ON u.id=e.editor_user_id ORDER BY e.created_at DESC LIMIT 200');
  res.json({logs});
});

app.post('/api/chat/typing',requireAuth,async(req,res)=>{const typing=!!req.body?.typing;if(typing)await q('INSERT INTO chat_typing(user_id,typing) VALUES(?,1) ON DUPLICATE KEY UPDATE typing=1,updated_at=CURRENT_TIMESTAMP',[req.session.userId]);else await q('DELETE FROM chat_typing WHERE user_id=?',[req.session.userId]);res.json({ok:true});});
app.get('/api/chat/typing',requireAuth,async(req,res)=>{await q('DELETE FROM chat_typing WHERE updated_at < (NOW() - INTERVAL 5 SECOND)');const [users]=await q("SELECT t.user_id,t.updated_at,u.display_name FROM chat_typing t JOIN users u ON u.id=t.user_id WHERE t.typing=1 AND u.status='ACTIVE' ORDER BY t.updated_at DESC");res.json({users});});
app.post('/api/ai', requirePermission('USE_AI'), async (req,res)=>{
  const [u]=await q('SELECT role,is_super_admin,status FROM users WHERE id=? LIMIT 1',[req.session.userId]);
  if(!u[0]||u[0].status!=='ACTIVE') return res.status(401).json({error:'Account is not active'});
  if(u[0].role!=='STUDENT' && !Number(u[0].is_super_admin)) return res.status(403).json({error:'AI is available to B4 students'});
  const message=String(req.body?.message||'').trim();
  if(!message) return res.status(400).json({error:'Message required'});
  const key=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY;
  if(!key) return res.status(503).json({error:'Gemini is not configured on the backend'});
  const models=[...new Set([process.env.GEMINI_MODEL||'gemini-3.8-flash','gemini-3.8-flash','gemini-3.6-flash'])];
  const instruction='You are B4 AI Assistant for a secondary-school Telecommunication class. Explain academic topics clearly and safely. Do not invent private class data. Prefer Egyptian Arabic for Arabic questions and English for English questions.';
  let last=null;
  for(const model of models){
    try{
      const ai=new GoogleGenAI({apiKey:key});
      const out=await ai.models.generateContent({model,contents:message,config:{systemInstruction:instruction,maxOutputTokens:700}});
      const answer=String(out?.text||'').trim();
      if(answer)return res.json({answer,model});
      last=new Error('Empty Gemini response');
    }catch(err){
      last=err;
      const status=Number(err?.status||err?.statusCode||0);
      const msg=String(err?.message||'');
      console.error('Gemini error',{model,status,message:msg});
      if(status===400||status===401||status===403) return res.status(502).json({error:'Gemini rejected the request. Check the backend Gemini configuration.'});
    }
  }
  const msg=String(last?.message||'');
  if(/quota|resource.?exhausted|rate.?limit|429/i.test(msg)) return res.status(503).json({error:'Gemini quota/rate limit reached.'});
  return res.status(502).json({error:'Gemini request failed. Check the backend Gemini configuration.'});
});


app.get('/api/auth/linked', requireAuth, async (req,res)=>{
  const [rows]=await q('SELECT provider,provider_email,created_at FROM linked_accounts WHERE user_id=? ORDER BY provider',[req.session.userId]);
  res.json({linked:rows});
});

async function startGoogleOAuth(req,res,mode){
  const clientId=process.env.GOOGLE_CLIENT_ID,redirectUri=process.env.GOOGLE_REDIRECT_URI||process.env.GOOGLE_CALLBACK_URL;
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
    const clientId=process.env.GOOGLE_CLIENT_ID,clientSecret=process.env.GOOGLE_CLIENT_SECRET,redirectUri=process.env.GOOGLE_REDIRECT_URI||process.env.GOOGLE_CALLBACK_URL;
    if(!clientId||!clientSecret||!redirectUri)return res.status(503).send('Google linking is not configured.');
    const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:String(req.query.code),client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code'})});
    const tokens=await tokenRes.json();if(!tokenRes.ok||!tokens.access_token)throw new Error('Google token exchange failed');
    const infoRes=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokens.access_token}});
    const info=await infoRes.json();if(!infoRes.ok||!info.sub)throw new Error('Google user info failed');
    const [owner]=await q("SELECT user_id FROM linked_accounts WHERE provider='GOOGLE' AND provider_user_id=? LIMIT 1",[String(info.sub)]);
    if(mode==='login'){
      if(!owner[0])return res.redirect('/?google=not-linked');
      const [u]=await q('SELECT id,role,status,session_version FROM users WHERE id=? LIMIT 1',[owner[0].user_id]);
      if(!u[0]||u[0].status!=='ACTIVE')return res.redirect('/?google=disabled');
      req.session.userId=u[0].id;req.session.role=u[0].role;req.session.sessionVersion=Number(u[0].session_version||1);await audit(req,'GOOGLE_LOGIN','user',u[0].id,{email:info.email||null});
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
  try{
    const body=req.body||{};
    const title=String(body.title||'').trim();
    const description=String(body.description||'').trim();
    const url=String(body.url||'').trim();
    const subjectId=body.subjectId?Number(body.subjectId):null;
    const resourceType=['LINK','FILE','VIDEO','NOTE'].includes(body.resourceType)?body.resourceType:(url?'LINK':'NOTE');
    if(!title)return res.status(400).json({error:'Resource title is required'});
    if(subjectId!==null&&!Number.isSafeInteger(subjectId))return res.status(400).json({error:'Invalid subject'});
    if(url&& !/^https?:\/\//i.test(url))return res.status(400).json({error:'Link must start with http:// or https://'});
    const [r]=await q('INSERT INTO resources(title,description,url,resource_type,subject_id,class_name,created_by) VALUES(?,?,?,?,?,\'B4\',?)',[title,description,url||null,resourceType,subjectId,req.session.userId]);
    await audit(req,'RESOURCE_CREATED','resource',r.insertId,{type:resourceType});
    res.json({ok:true,id:r.insertId});
  }catch(e){
    console.error('Resource creation failed:',e);
    res.status(500).json({error:e?.code?('Could not publish resource: '+e.code):'Could not publish resource'});
  }
});

// Unified resource publisher: supports a normal link/note, a PDF, or both in one request.
// The PDF is optional, so publishing without choosing a file no longer hits the PDF-only endpoint.
app.post('/api/admin/resources/publish', requirePermission('MANAGE_RESOURCES'), pdfUpload.single('file'), async(req,res)=>{
  try{
    const title=String(req.body?.title||'').trim();
    const description=String(req.body?.description||'').trim();
    const url=String(req.body?.url||'').trim();
    const subjectId=req.body?.subjectId?Number(req.body.subjectId):null;
    if(!title)return res.status(400).json({error:'Resource title is required'});
    if(subjectId!==null&&!Number.isSafeInteger(subjectId))return res.status(400).json({error:'Invalid subject'});
    if(url&&!/^https?:\/\//i.test(url))return res.status(400).json({error:'Link must start with http:// or https://'});
    const hasFile=!!req.file;
    const resourceType=hasFile?'FILE':(url?'LINK':'NOTE');
    const [r]=await q(
      'INSERT INTO resources(title,description,url,resource_type,subject_id,class_name,created_by) VALUES(?,?,?,?,\'B4\',?,?)',
      [title,description,url||null,resourceType,subjectId,req.session.userId]
    );
    let fileUrl=null;
    if(hasFile){
      const [f]=await q(
        'INSERT INTO resource_files(resource_id,filename,mime_type,data) VALUES(?,?,?,?)',
        [r.insertId,req.file.originalname,'application/pdf',req.file.buffer]
      );
      fileUrl='/api/resources/files/'+f.insertId;
    }
    await audit(req,'RESOURCE_CREATED','resource',r.insertId,{type:resourceType,has_file:hasFile});
    res.json({ok:true,id:r.insertId,fileUrl});
  }catch(e){
    console.error('Resource publish failed:',e);
    res.status(500).json({error:e?.sqlMessage||e?.message||'Could not publish resource'});
  }
});

app.post('/api/admin/resources/pdf', requirePermission('MANAGE_RESOURCES'), pdfUpload.single('file'), async(req,res)=>{
  if(!req.file) return res.status(400).json({error:'PDF file is required'});
  try{
    const title=String(req.body?.title||req.file.originalname).trim();
    const description=String(req.body?.description||'').trim();
    const subjectId=req.body?.subjectId?Number(req.body.subjectId):null;
    const [r]=await q('INSERT INTO resources(title,description,resource_type,subject_id,class_name,created_by) VALUES(?,?,\'FILE\',?,\'B4\',?)',[title,description,subjectId||null,req.session.userId]);
    await q('INSERT INTO resource_files(resource_id,filename,mime_type,data) VALUES(?,?,?,?)',[r.insertId,req.file.originalname,'application/pdf',req.file.buffer]);
    await audit(req,'PDF_UPLOADED','resource',r.insertId,{filename:req.file.originalname});res.json({ok:true,id:r.insertId,fileUrl:'/api/resources/files/'+r.insertId});
  }catch(e){
    console.error('PDF upload failed:',e);
    res.status(500).json({error:e?.sqlMessage||e?.message||'Could not upload PDF'});
  }
});

app.get('/api/resources/files/:id', requireAuth, async(req,res)=>{
  const id=Number(req.params.id); if(!Number.isSafeInteger(id)) return res.status(400).end();
  const [rows]=await q('SELECT rf.filename,rf.mime_type,rf.data FROM resource_files rf JOIN resources r ON r.id=rf.resource_id WHERE rf.id=? AND r.class_name=\'B4\' LIMIT 1',[id]);
  if(!rows[0]) return res.status(404).end();
  res.setHeader('Content-Type',rows[0].mime_type);
  res.setHeader('Content-Disposition','inline; filename*=UTF-8\'\''+encodeURIComponent(rows[0].filename));
  res.send(rows[0].data);
});
app.post('/api/admin/resources/:id/pdf', requirePermission('MANAGE_RESOURCES'), pdfUpload.single('file'), async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||!req.file) return res.status(400).json({error:'Valid resource id and PDF file are required'});
  try{ await assertTeacherOwner(req,'resources',id); }catch(e){ return res.status(e.statusCode||403).json({error:e.message}); }
  const [resource]=await q("SELECT id,title FROM resources WHERE id=? AND class_name='B4' LIMIT 1",[id]);
  if(!resource[0]) return res.status(404).json({error:'Resource not found'});
  await q('DELETE FROM resource_files WHERE resource_id=?',[id]);
  const [fileRow]=await q('INSERT INTO resource_files(resource_id,filename,mime_type,data) VALUES(?,?,?,?)',[id,req.file.originalname,'application/pdf',req.file.buffer]);
  await q("UPDATE resources SET resource_type='FILE',url=NULL,file_url=NULL WHERE id=?",[id]);
  await audit(req,'PDF_REPLACED','resource',id,{filename:req.file.originalname});
  res.json({ok:true,fileUrl:'/api/resources/files/'+fileRow.insertId});
});

app.post('/api/admin/exams', requirePermission('MANAGE_EXAMS'), async(req,res)=>{
  const {title,description='',subjectId=null,endsAt=null,durationMinutes=null,questions=[]}=req.body||{};
  if(!title?.trim()) return res.status(400).json({error:'Exam title is required'});
  if(!Array.isArray(questions)||!questions.length) return res.status(400).json({error:'Add at least one question'});

  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    const startMs=Date.now(),endMs=cairoEpoch(endsAt);if(endsAt&&!Number.isFinite(endMs))throw new Error('Invalid deadline');if(endMs!==null&&endMs<=startMs)throw new Error('Deadline must be after the current time');const [e]=await conn.execute('INSERT INTO exams(title,description,subject_id,class_name,starts_at,ends_at,timer_started_ms,ends_at_ms,duration_minutes,status,created_by) VALUES(?,?,?,?,NULL,?,?,?, ?,\'OPEN\',?)',[title.trim(),description.trim(),subjectId||null,'B4',endsAt||null,startMs,endMs,durationMinutes?Number(durationMinutes):null,req.session.userId]);
    let inserted=0;
    for(let i=0;i<questions.length;i++){
      const qn=questions[i]; const text=String(qn.questionText||'').trim(); if(!text) continue;
      const type=['MCQ','TRUE_FALSE','SHORT'].includes(qn.questionType)?qn.questionType:'MCQ';
      const opts=type==='MCQ'?(Array.isArray(qn.options)?qn.options.map(v=>String(v||'').trim()).filter(Boolean).slice(0,8):[]):null;
      if(type==='MCQ' && (!opts || opts.length<2)) throw new Error('MCQ needs at least two options');
      const correct=type==='MCQ'?String(qn.correctAnswer||'').trim():(type==='TRUE_FALSE'?(String(qn.correctAnswer||'TRUE').toUpperCase()==='TRUE'?'TRUE':'FALSE'):null);
      if(type==='MCQ' && !opts.includes(correct)) throw new Error('Correct answer must be one of the MCQ options');
      await conn.execute('INSERT INTO exam_questions(exam_id,question_text,question_type,options_json,correct_answer,points,sort_order) VALUES(?,?,?,?,?,?,?)',[e.insertId,text,type,opts?JSON.stringify(opts):null,correct,Math.max(.5,Number(qn.points)||1),inserted++]);
    }
    if(!inserted) throw new Error('Add at least one valid question');
    await conn.commit();await audit(req,'EXAM_CREATED','exam',e.insertId,{title:title.trim()});res.json({ok:true,id:e.insertId});
  }catch(e){await conn.rollback();res.status(400).json({error:e.message})}finally{conn.release();}
});

app.get('/api/exams/:id', requireAuth, async(req,res)=>{
  const id=Number(req.params.id); if(!Number.isSafeInteger(id)) return res.status(400).json({error:'Invalid exam'});
   const [ex]=await q("SELECT e.*,DATE_FORMAT(e.starts_at,'%Y-%m-%d %H:%i:%s') starts_at,DATE_FORMAT(e.ends_at,'%Y-%m-%d %H:%i:%s') ends_at,s.name subject_name FROM exams e LEFT JOIN subjects s ON s.id=e.subject_id WHERE e.id=? AND e.class_name='B4' LIMIT 1",[id]);
  if(!ex[0]) return res.status(404).json({error:'Exam not found'});
  const [attempt]=await q('SELECT id,status,started_at,submitted_at,score FROM exam_attempts WHERE exam_id=? AND user_id=? LIMIT 1',[id,req.session.userId]);
  res.json({exam:ex[0],attempt:attempt[0]||null});
});

app.post('/api/exams/:id/start', requireAuth, async(req,res)=>{
  const id=Number(req.params.id); const now=new Date();
  const [ex]=await q('SELECT * FROM exams WHERE id=? AND class_name=\'B4\' LIMIT 1',[id]); const exam=ex[0];
  if(!exam) return res.status(404).json({error:'Exam not found'});
  const endMs=cairoEpoch(exam.ends_at);
  if(endMs!==null&&now.getTime()>=endMs) return res.status(403).json({error:'Exam deadline has passed'});
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
  const endDeadline=cairoEpoch(exam.ends_at);
  const deadlines=[durationDeadline,endDeadline].filter(Boolean);
  const deadline=deadlines.length?new Date(Math.min(...deadlines)).toISOString():null;
  res.json({exam,attempt:{id:attempt.id,started_at:attempt.started_at,deadline},questions:questions.map(q=>({...q,options_json:typeof q.options_json==='string'?(JSON.parse(q.options_json||'[]')):(q.options_json||[])}))});
}

app.post('/api/exams/:id/submit', requireAuth, async(req,res)=>{
  const id=Number(req.params.id),answers=req.body?.answers||{};
  const [rows]=await q('SELECT a.*,e.ends_at,e.duration_minutes FROM exam_attempts a JOIN exams e ON e.id=a.exam_id WHERE a.exam_id=? AND a.user_id=? LIMIT 1',[id,req.session.userId]);
  const attempt=rows[0]; if(!attempt)return res.status(404).json({error:'Exam attempt not found'});
  if(attempt.status!=='STARTED')return res.status(400).json({error:'Exam already submitted'});
  const started=new Date(attempt.started_at).getTime(),deadline=Math.min(...[attempt.ends_at?cairoEpoch(attempt.ends_at):Infinity,attempt.duration_minutes?started+Number(attempt.duration_minutes)*60000:Infinity]);
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


/* ===== B4 RESET / ACCOUNTS / ATTENDANCE / BADGES / DEVELOPERS / TEACHER CHAT ===== */
app.post('/api/auth/forgot-password',async(req,res)=>{res.json({ok:true,whatsapp:'https://wa.me/201023019916'});});

app.get('/api/admin/accounts',requirePermission('MANAGE_ACCOUNTS'),async(req,res)=>{
  const [rows]=await q(`SELECT u.id,u.display_name,u.official_name,u.role,u.is_super_admin,u.status,u.student_id,u.teacher_id,u.avatar_url,
    EXISTS(SELECT 1 FROM linked_accounts l WHERE l.user_id=u.id AND l.provider='GOOGLE') google_linked,
    (SELECT l.provider_email FROM linked_accounts l WHERE l.user_id=u.id AND l.provider='GOOGLE' ORDER BY l.created_at DESC LIMIT 1) google_email,
    COALESCE(s.student_code,t.teacher_code) identity_code,COALESCE(ak.key_preview,'') activation_key_preview
    FROM users u LEFT JOIN students s ON s.id=u.student_id LEFT JOIN teachers t ON t.id=u.teacher_id
    LEFT JOIN activation_keys ak ON ak.used_user_id=u.id ORDER BY u.display_name`);
  res.json({accounts:rows});
});
app.delete('/api/admin/accounts/:id',requirePermission('MANAGE_ACCOUNTS'),async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)) return res.status(400).json({error:'Invalid account'});
  const [rows]=await q('SELECT id,role,is_super_admin,display_name FROM users WHERE id=? LIMIT 1',[id]);
  if(!rows[0]) return res.status(404).json({error:'Account not found'});
  if(Number(id)===Number(req.session.userId)) return res.status(400).json({error:'You cannot delete your own account'});
  if(Number(rows[0].is_super_admin)===1){
    const [actor]=await q('SELECT is_super_admin FROM users WHERE id=? LIMIT 1',[req.session.userId]);
    if(!Number(actor[0]?.is_super_admin)) return res.status(403).json({error:'Only Super Admin can delete a Super Admin account'});
  }
  await audit(req,'ACCOUNT_DELETED','user',id,{display_name:rows[0].display_name});
  await q('DELETE FROM users WHERE id=?',[id]);
  res.json({ok:true});
});

app.post('/api/admin/accounts/:id/reset-password',requirePermission('MANAGE_ACCOUNTS'),async(req,res)=>{
  const id=Number(req.params.id); const [u]=await q('SELECT id FROM users WHERE id=? LIMIT 1',[id]); if(!u[0])return res.status(404).json({error:'Account not found'});
  const temp='B4-'+crypto.randomBytes(6).toString('base64url'); await q('UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?',[await bcrypt.hash(temp,12),id]); await audit(req,'PASSWORD_RESET','user',id); res.json({ok:true,tempPassword:temp});
});
app.post('/api/admin/accounts/:id/end-session',requirePermission('MANAGE_ACCOUNTS'),async(req,res)=>{
  const id=Number(req.params.id); const [r]=await q('UPDATE users SET session_version=session_version+1 WHERE id=?',[id]); if(!r.affectedRows)return res.status(404).json({error:'Account not found'}); await audit(req,'SESSION_ENDED','user',id); res.json({ok:true});
});

app.get('/api/admin/attendance',requirePermission('MANAGE_ATTENDANCE'),async(req,res)=>{
  const date=String(req.query.date||new Date().toISOString().slice(0,10)); 
  const [rows]=await q(`SELECT u.id,u.display_name,u.role,u.student_id,s.student_code,COALESCE(a.status,'PRESENT') status
    FROM users u JOIN students s ON s.id=u.student_id LEFT JOIN b4_attendance a ON a.user_id=u.id AND a.attendance_date=?
    WHERE u.role='STUDENT' AND u.status='ACTIVE' ORDER BY u.display_name`,[date]);
  const [summary]=await q(`SELECT SUM(status='PRESENT') present_count,SUM(status='ABSENT') absent_count,COUNT(*) total_count FROM b4_attendance WHERE attendance_date=?`,[date]);
  res.json({date,students:rows,summary:summary[0]||{}});
});
app.post('/api/admin/attendance',requirePermission('MANAGE_ATTENDANCE'),async(req,res)=>{
  const date=String(req.body?.date||new Date().toISOString().slice(0,10)); const uid=Number(req.body?.userId); const status=req.body?.status==='ABSENT'?'ABSENT':'PRESENT';
  if(!Number.isSafeInteger(uid))return res.status(400).json({error:'Invalid student'});
  await q(`INSERT INTO b4_attendance(user_id,attendance_date,status,marked_by) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),marked_by=VALUES(marked_by)`,[uid,date,status,req.session.userId]);
  await audit(req,'ATTENDANCE_MARKED','user',uid,{date,status}); res.json({ok:true});
});
app.get('/api/attendance/analysis',requireAuth,async(req,res)=>{
  const [rows]=await q(`SELECT u.id,u.display_name,COUNT(a.id) marked_days,SUM(a.status='PRESENT') present_days,SUM(a.status='ABSENT') absent_days
    FROM users u JOIN students s ON s.id=u.student_id LEFT JOIN b4_attendance a ON a.user_id=u.id
    WHERE u.role='STUDENT' AND u.status='ACTIVE' GROUP BY u.id ORDER BY u.display_name`);
  res.json({students:rows.map(x=>({...x,present_rate:x.marked_days?Math.round(Number(x.present_days||0)/Number(x.marked_days)*100):0}))});
});

app.get('/api/admin/badges',requirePermission('MANAGE_BADGES'),async(req,res)=>{
  const [badges]=await q('SELECT id,name,description,created_at FROM b4_badges ORDER BY created_at DESC');
  const [people]=await q(`SELECT u.id,u.display_name,u.role,ub.badge_id FROM users u LEFT JOIN b4_user_badges ub ON ub.user_id=u.id WHERE u.status='ACTIVE' ORDER BY u.display_name`);
  res.json({badges,people});
});
app.post('/api/admin/badges',requirePermission('MANAGE_BADGES'),async(req,res)=>{
  const name=String(req.body?.name||'').trim(),description=String(req.body?.description||'').trim();if(!name)return res.status(400).json({error:'Badge name is required'});
  const [r]=await q('INSERT INTO b4_badges(name,description) VALUES(?,?)',[name,description||null]); await audit(req,'BADGE_CREATED','badge',r.insertId);res.json({ok:true,id:r.insertId});
});
app.post('/api/admin/badges/:id/icon',requirePermission('MANAGE_BADGES'),imageUpload.single('file'),async(req,res)=>{
  if(!req.file)return res.status(400).json({error:'Image required'}); const id=Number(req.params.id);
  await q('UPDATE b4_badges SET icon_mime=?,icon_data=? WHERE id=?',[req.file.mimetype,req.file.buffer,id]);res.json({ok:true});
});
app.get('/api/badges/:id/icon',async(req,res)=>{const [r]=await q('SELECT icon_mime,icon_data FROM b4_badges WHERE id=? LIMIT 1',[Number(req.params.id)]);if(!r[0]||!r[0].icon_data)return res.status(404).end();res.setHeader('Content-Type',r[0].icon_mime);res.setHeader('Cache-Control','public,max-age=300');res.send(r[0].icon_data);});
app.post('/api/admin/badges/assign',requirePermission('MANAGE_BADGES'),async(req,res)=>{const uid=Number(req.body?.userId),bid=Number(req.body?.badgeId);await q('INSERT IGNORE INTO b4_user_badges(user_id,badge_id,assigned_by) VALUES(?,?,?)',[uid,bid,req.session.userId]);await audit(req,'BADGE_ASSIGNED','user',uid,{badgeId:bid});res.json({ok:true});});
app.delete('/api/admin/badges/assign',requirePermission('MANAGE_BADGES'),async(req,res)=>{await q('DELETE FROM b4_user_badges WHERE user_id=? AND badge_id=?',[Number(req.body?.userId),Number(req.body?.badgeId)]);res.json({ok:true});});

app.get('/api/admin/developers',requirePermission('MANAGE_DEVELOPERS'),async(req,res)=>{const [developers]=await q('SELECT id,name,title,title2,link_url,created_at,IF(image_data IS NULL,NULL,CONCAT("/api/developers/",id,"/avatar")) avatar_url FROM b4_developers ORDER BY id DESC');res.json({developers});});
app.post('/api/admin/developers',requirePermission('MANAGE_DEVELOPERS'),async(req,res)=>{const title=String(req.body?.title||'').trim(),title2=String(req.body?.title2||'').trim(),name=String(req.body?.name||'').trim(),linkUrl=String(req.body?.linkUrl||'').trim();if(!name)return res.status(400).json({error:'Developer name required'});const [r]=await q('INSERT INTO b4_developers(name,title,title2,link_url) VALUES(?,?,?,?)',[name,title||null,title2||null,linkUrl||null]);await audit(req,'DEVELOPER_CREATED','developer',r.insertId);res.json({ok:true,id:r.insertId});});
app.patch('/api/admin/developers/:id',requirePermission('MANAGE_DEVELOPERS'),async(req,res)=>{const id=Number(req.params.id),title=String(req.body?.title||'').trim(),title2=String(req.body?.title2||'').trim(),name=String(req.body?.name||'').trim(),linkUrl=String(req.body?.linkUrl||'').trim(),extraFields=Array.isArray(req.body?.extraFields)?req.body.extraFields.map(x=>({label:String(x?.label||'').trim(),value:String(x?.value||'').trim()})).filter(x=>x.label&&x.value):[];if(!name)return res.status(400).json({error:'Name required'});await q('UPDATE b4_developers SET name=?,title=?,title2=?,link_url=? WHERE id=?',[name,title||null,title2||null,linkUrl||null,id]);await audit(req,'DEVELOPER_UPDATED','developer',id);res.json({ok:true});});
app.delete('/api/admin/developers/:id',requirePermission('MANAGE_DEVELOPERS'),async(req,res)=>{await q('DELETE FROM b4_developers WHERE id=?',[Number(req.params.id)]);res.json({ok:true});});
app.post('/api/admin/developers/:id/avatar',requirePermission('MANAGE_DEVELOPERS'),imageUpload.single('file'),async(req,res)=>{if(!req.file)return res.status(400).json({error:'Image required'});await q('UPDATE b4_developers SET image_mime=?,image_data=? WHERE id=?',[req.file.mimetype,req.file.buffer,Number(req.params.id)]);res.json({ok:true});});
app.get('/api/developers/:id/avatar',async(req,res)=>{const [r]=await q('SELECT image_mime,image_data FROM b4_developers WHERE id=?',[Number(req.params.id)]);if(!r[0]||!r[0].image_data)return res.status(404).end();res.setHeader('Content-Type',r[0].image_mime);res.send(r[0].image_data);});

async function teacherOnly(req,res,next){if(!req.session.userId)return res.status(401).json({error:'Login required'});const [u]=await q('SELECT role,is_super_admin,status FROM users WHERE id=?',[req.session.userId]);if(!u[0]||u[0].status!=='ACTIVE')return res.status(401).json({error:'Account disabled'});if(!Number(u[0].is_super_admin)&&u[0].role!=='TEACHER'&&!(await getPermissionCodes(req.session.userId)).includes('MANAGE_TEACHER_CHAT'))return res.status(403).json({error:'Teacher chat only'});next();}
app.get('/api/teacher-chat/stream',teacherOnly,async(req,res)=>{res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders?.();const client={res,userId:req.session.userId};teacherChatStreams.add(client);res.write(': connected\\n\\n');req.on('close',()=>teacherChatStreams.delete(client));});
app.get('/api/teacher-chat/messages',teacherOnly,async(req,res)=>{const [rows]=await q('SELECT m.id,m.body,m.created_at,m.edited_at,m.user_id,m.reply_to_id,u.display_name,u.avatar_url,rm.body reply_body,ru.display_name reply_display_name FROM b4_teacher_messages m LEFT JOIN users u ON u.id=m.user_id LEFT JOIN b4_teacher_messages rm ON rm.id=m.reply_to_id LEFT JOIN users ru ON ru.id=rm.user_id WHERE m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 100');rows.reverse();res.json({messages:rows});});
app.post('/api/teacher-chat/messages',teacherOnly,async(req,res)=>{const body=String(req.body?.body||'').trim(),replyToId=req.body?.replyToId?Number(req.body.replyToId):null;if(!body||body.length>4000)return res.status(400).json({error:'Message is empty or too long'});if(replyToId){const [reply]=await q('SELECT id FROM b4_teacher_messages WHERE id=? AND deleted_at IS NULL LIMIT 1',[replyToId]);if(!reply[0])return res.status(400).json({error:'Reply target not found'});}const [r]=await q('INSERT INTO b4_teacher_messages(user_id,body,reply_to_id) VALUES(?,?,?)',[req.session.userId,body,replyToId||null]);const [rows]=await q('SELECT m.id,m.body,m.created_at,m.edited_at,m.user_id,m.reply_to_id,u.display_name,u.avatar_url,rm.body reply_body,ru.display_name reply_display_name FROM b4_teacher_messages m JOIN users u ON u.id=m.user_id LEFT JOIN b4_teacher_messages rm ON rm.id=m.reply_to_id LEFT JOIN users ru ON ru.id=rm.user_id WHERE m.id=?',[r.insertId]);await audit(req,'TEACHER_CHAT_MESSAGE','teacher_chat',r.insertId);res.json({message:rows[0]});pushTeacherChatEvent('teacher-chat',{type:'created',message:rows[0]});});
app.patch('/api/teacher-chat/messages/:id',teacherOnly,async(req,res)=>{const id=Number(req.params.id),body=String(req.body?.body||'').trim();if(!Number.isSafeInteger(id)||!body||body.length>4000)return res.status(400).json({error:'Invalid message'});const [rows]=await q('SELECT id,user_id,body,deleted_at FROM b4_teacher_messages WHERE id=? LIMIT 1',[id]);const m=rows[0];if(!m)return res.status(404).json({error:'Message not found'});if(m.deleted_at)return res.status(400).json({error:'Deleted message cannot be edited'});const permissions=await getPermissionCodes(req.session.userId);const canEdit=Number(m.user_id)===Number(req.session.userId)||permissions.includes('MANAGE_TEACHER_CHAT');if(!canEdit)return res.status(403).json({error:'Permission denied'});if(body===m.body)return res.status(400).json({error:'No changes made'});await q('INSERT INTO b4_teacher_message_edits(message_id,editor_user_id,old_body,new_body) VALUES(?,?,?,?)',[id,req.session.userId,m.body,body]);await q('UPDATE b4_teacher_messages SET body=?,edited_at=NOW() WHERE id=?',[body,id]);await audit(req,'TEACHER_CHAT_MESSAGE_EDITED','teacher_chat',id,{old_body:m.body,new_body:body});const [updated]=await q('SELECT m.id,m.body,m.created_at,m.edited_at,m.user_id,m.reply_to_id,u.display_name,u.avatar_url,rm.body reply_body,ru.display_name reply_display_name FROM b4_teacher_messages m JOIN users u ON u.id=m.user_id LEFT JOIN b4_teacher_messages rm ON rm.id=m.reply_to_id LEFT JOIN users ru ON ru.id=rm.user_id WHERE m.id=?',[id]);res.json({message:updated[0]});pushTeacherChatEvent('teacher-chat',{type:'updated',message:updated[0]});});
app.delete('/api/teacher-chat/messages/:id',teacherOnly,async(req,res)=>{const id=Number(req.params.id);const [rows]=await q('SELECT id,user_id,deleted_at FROM b4_teacher_messages WHERE id=? LIMIT 1',[id]);const m=rows[0];if(!m)return res.status(404).json({error:'Message not found'});const permissions=await getPermissionCodes(req.session.userId);const canDelete=Number(m.user_id)===Number(req.session.userId)||permissions.includes('MANAGE_TEACHER_CHAT');if(!canDelete)return res.status(403).json({error:'Permission denied'});if(m.deleted_at)return res.json({ok:true});await q('UPDATE b4_teacher_messages SET deleted_at=NOW(),deleted_by=? WHERE id=?',[req.session.userId,id]);await audit(req,'TEACHER_CHAT_MESSAGE_DELETED','teacher_chat',id,'Message deleted');res.json({ok:true});pushTeacherChatEvent('teacher-chat',{type:'deleted',id});});
app.post('/api/teacher-chat/typing',teacherOnly,async(req,res)=>{if(req.body?.typing)await q('INSERT INTO b4_teacher_typing(user_id) VALUES(?) ON DUPLICATE KEY UPDATE updated_at=CURRENT_TIMESTAMP',[req.session.userId]);else await q('DELETE FROM b4_teacher_typing WHERE user_id=?',[req.session.userId]);res.json({ok:true});});
app.get('/api/teacher-chat/typing',teacherOnly,async(req,res)=>{await q('DELETE FROM b4_teacher_typing WHERE updated_at<(NOW()-INTERVAL 5 SECOND)');const [rows]=await q('SELECT t.user_id,u.display_name FROM b4_teacher_typing t JOIN users u ON u.id=t.user_id ORDER BY t.updated_at DESC');res.json({users:rows});});

app.get('/api/admin/developers/public',async(req,res)=>{const [developers]=await q('SELECT id,name,title,title2,link_url,created_at,IF(image_data IS NULL,NULL,CONCAT("/api/developers/",id,"/avatar")) avatar_url FROM b4_developers ORDER BY id DESC');res.json({developers});});

// Serve shared assets from the repository root before the SPA fallback.
// The manifest references /assets/logo.svg, so this route must be public.
const assetsPath = path.resolve(__dirname, '../../assets');
app.use('/assets', express.static(assetsPath, { extensions: ['svg','png','jpg','jpeg','webp'] }));

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