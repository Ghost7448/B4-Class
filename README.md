# B4 Class

Production-ready class portal for **B4 — Telecommunication**.

## Architecture

- Frontend: HTML / CSS / JavaScript
- Backend: Node.js + Express
- Database: MySQL 8.x
- Authentication: MySQL-backed secure sessions + bcrypt passwords
- AI: OpenAI Responses API through the backend
- Deployment: Railway
- Data source: **MySQL / SQL seed only** — no JSON class-data sync

## Main modules

- Dashboard
- Students
- Subjects
- Schedule
- Assignments
- Resources
- Exam Center
- Announcements
- Class Chat
- Attendance
- B4 AI Assistant
- Admin Center
- Settings
- Install App / PWA
- Arabic / English
- Light / Dark
- Activation Keys
- Role-based permissions

## Roles

- STUDENT
- TEACHER
- ADMIN
- SUPER_ADMIN

## Database setup

Run:

1. `database/schema.sql`
2. `database/seed.sql`

Do not run `CREATE DATABASE` or `USE`; Railway's MySQL service supplies the selected database.

## Railway

The repository is configured as a single Railway service from the repository root:

- Start command: `npm start`
- Healthcheck: `/api/health`
- Root directory: `/`
- Frontend is served by the same Node/Express service.

Required environment variables include:

```env
NODE_ENV=production
MYSQL_URL=...
SESSION_SECRET=...
OPENAI_API_KEY=...
```

Optional:

```env
OPENAI_MODEL=gpt-5.6-luna
FRONTEND_URL=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=...
```

Never commit real secrets.

## Admin bootstrap

Use the included command after the database tables exist:

```bash
npm run create-admin
```

## Important

Dynamic class data belongs in MySQL. The repository's SQL seed contains the official B4 roster and subject catalog; accounts, attendance, chat, assignments, resources, exams, announcements, notifications, permissions and logs are relational database data.
