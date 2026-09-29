# B4 Class — Full Stack

B4 Telecommunication class portal using a Node.js/Express backend, Railway MySQL, secure sessions, activation keys and a frontend served by the same Railway service.

## Railway deployment

1. Deploy this repository/service with the **Root Directory set to `/backend` only if the backend is deployed as a separate service**.
2. If you want the backend to serve the frontend from the same service (the recommended setup in this package), set the Railway service Root Directory to `/` so the service can access both `backend/` and `frontend/`, then use the start command:

```bash
npm --prefix backend start
```

3. Add these Railway variables:

```env
NODE_ENV=production
MYSQL_URL=${{MySQL.DATABASE_URL}}
SESSION_SECRET=your-long-random-secret
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-5.6-luna
```

4. Do not commit `.env` or API keys.

## Database

Run `database/schema.sql` first, then `database/seed.sql` against the MySQL database already provided by Railway. These files do not create or select a separate database.

## Super Admin

After the tables exist, create the first Super Admin from the backend environment/command line:

```bash
npm --prefix backend run create-admin -- "Your Display Name" "A-Strong-Password"
```

Activation keys are stored as SHA-256 hashes and the raw key is returned only once when generated. User passwords are stored as bcrypt hashes.

## Frontend

When the same Railway service serves the frontend, `frontend/config.js` can stay empty and the browser uses the same origin for `/api/*`.

If the frontend is later moved to GitHub Pages, set `window.B4_API_URL` in `frontend/config.js` to the public backend URL and configure `FRONTEND_URL` in Railway to the exact frontend origin.
