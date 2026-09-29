# B4 Class Portal

This package upgrades the original front-end into a B4 Telecommunication class portal and adds a production-oriented Node/Express + MySQL backend.

## Included
- `frontend/`: GitHub Pages-ready B4 frontend.
- `backend/`: Node.js + Express API, secure password hashing, persistent MySQL sessions, activation keys, chat, profile/password APIs and B4 AI endpoint.
- `database/schema.sql`: complete MySQL schema.
- `database/seed.sql`: B4 roster (24 students) + starter subjects.

## Important
- Do **not** commit `backend/.env`.
- Put `OPENAI_API_KEY` only in backend environment variables. The frontend never receives it.
- Activation keys are stored hashed; the raw key is returned only once when generated.
- Passwords are stored as bcrypt hashes; Super Admin cannot view original passwords.
- The schedule is intentionally not populated with fake data. Add the real B4 schedule later.

## Local backend test
1. Copy `backend/.env.example` to `backend/.env`.
2. Fill the Railway MySQL variables and a long `SESSION_SECRET`.
3. Run the SQL files in order: `schema.sql`, then `seed.sql`.
4. In `backend/`: `npm install` then `npm run create-admin -- "Your Name" "A-Strong-Password"`.
5. `npm start`.
6. Set `window.B4_API_URL` or `localStorage.b4ApiUrl` in the frontend to the deployed backend URL.

## Frontend API URL
For a static GitHub Pages frontend, edit `frontend/config.js` and set `window.B4_API_URL` to the deployed backend URL.
The backend must allow the exact frontend origin with credentials.
