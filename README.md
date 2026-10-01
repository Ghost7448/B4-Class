# B4 Class Portal

B4 Telecommunication Class Portal — Node.js/Express + MySQL + vanilla HTML/CSS/JS.

## Run locally

1. Create the MySQL database/service.
2. Run `database/schema.sql`.
3. Run `database/seed.sql`.
4. Set `MYSQL_URL` and `SESSION_SECRET`.
5. Run `npm install`.
6. Run `npm start`.
7. Open `http://localhost:3000`.

For development use `npm run dev`.

## Railway

Use the repository root as the service root and `npm start` as the start command. The backend serves the frontend and exposes `/api/health`.

Required:
```
NODE_ENV=production
MYSQL_URL=...
SESSION_SECRET=...
```

AI:
```
GEMINI_API_KEY=...
```

Google account linking/login:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://YOUR-DOMAIN/auth/google/callback
```

The backend also accepts `GOOGLE_CALLBACK_URL` as a backwards-compatible alias.

## Roles

STUDENT, TEACHER, ADMIN, SUPER_ADMIN.

Permissions are stored in MySQL. SUPER_ADMIN always receives every permission.

## Bootstrap admin

After schema setup:

```
npm run create-admin
```

Never commit real environment secrets.