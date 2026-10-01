import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import readline from 'node:readline';

const url=process.env.MYSQL_URL||process.env.DATABASE_URL;
if(!url){console.error('MYSQL_URL or DATABASE_URL is required.');process.exit(1);}
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const ask=q=>new Promise(r=>rl.question(q,r));
try{
  const displayName=(await ask('Admin display name: ')).trim();
  const password=await ask('Admin password (8+ chars): ');
  if(!displayName||password.length<8)throw new Error('Display name and an 8+ character password are required.');
  const db=mysql.createPool(url);
  const hash=await bcrypt.hash(password,12);
  const [existing]=await db.query('SELECT id FROM users WHERE LOWER(display_name)=LOWER(?) LIMIT 1',[displayName]);
  if(existing[0]){
    await db.query("UPDATE users SET password_hash=?,role='SUPER_ADMIN',status='ACTIVE' WHERE id=?",[hash,existing[0].id]);
    console.log('Existing account promoted to SUPER_ADMIN.');
  }else{
    const [r]=await db.query("INSERT INTO users(official_name,display_name,password_hash,role,status) VALUES(?,?,?,'SUPER_ADMIN','ACTIVE')",[displayName,displayName,hash]);
    console.log('SUPER_ADMIN created. ID:',r.insertId);
  }
  await db.end();
}catch(e){console.error(e.message);process.exitCode=1;}finally{rl.close();}