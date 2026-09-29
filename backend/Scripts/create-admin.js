import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const mysqlUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
const pool = mysqlUrl
  ? mysql.createPool(mysqlUrl)
  : mysql.createPool({
      host: process.env.MYSQLHOST,
      port: Number(process.env.MYSQLPORT || 3306),
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE
    });

const display = process.argv[2] || process.env.ADMIN_DISPLAY_NAME;
const password = process.argv[3] || process.env.ADMIN_PASSWORD;

if (!display || !password || password.length < 8) {
  console.error('Usage: npm run create-admin -- "Display Name" "StrongPassword"');
  process.exit(1);
}

const [x] = await pool.execute('SELECT id FROM users WHERE LOWER(display_name)=LOWER(?)', [display]);
if (x[0]) {
  console.error('User already exists');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
await pool.execute(
  `INSERT INTO users(official_name,display_name,password_hash,role,status) VALUES(?,?,?,?,?)`,
  [display, display, hash, 'SUPER_ADMIN', 'ACTIVE']
);

console.log(`SUPER_ADMIN created: ${display}`);
await pool.end();
