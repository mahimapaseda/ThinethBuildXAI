# BuildX AI

AI-powered construction engineering assistant. Upload site photos, map your location, enter building specs, and get a comprehensive engineering blueprint with material estimates — powered by Google Gemini.

**Live repo:** [github.com/mahimapaseda/ThinethBuildXAI](https://github.com/mahimapaseda/ThinethBuildXAI)

## Features

- 7-phase wizard: Welcome → Map → Photos → Specs → Validate → Analyze → Results
- Google Gemini site analysis with engineering cross-validation (IS 456 / ACI 318)
- Material quantity & cost estimates
- User accounts, project save/load, admin dashboard
- Dark / light theme, mobile-responsive UI

## Quick start (local)

```bash
npm install
npm rebuild better-sqlite3   # required after Node version changes
cp .env.example .env.local   # then edit secrets (see below)
npm run dev
```

- Frontend: http://localhost:5173  
- Backend API: http://localhost:3001/api (proxied via Vite in dev)

## Environment variables

Copy `.env.example` to `.env.local` (gitignored):

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signing key for auth tokens (required in production) |
| `ADMIN_EMAIL` | Email allowed to become admin on first registration |
| `ADMIN_SECRET` | Secret code entered at signup to grant admin |
| `CORS_ORIGINS` | Comma-separated allowed frontend URLs (production) |
| `VITE_GEMINI_API_KEY` | Optional dev convenience; users can also enter key in the app UI |
| `VITE_API_URL` | API base URL (default `/api`; set to full URL when frontend and backend are on different hosts) |

**Never commit real API keys or `.env.local`.**

## Admin setup

1. Set `ADMIN_EMAIL` and `ADMIN_SECRET` in `.env.local`.
2. Register a new account with that email and enter the admin setup code on the signup form.
3. Only the **first** account with a valid admin secret becomes admin.

## Production deployment

This app needs **both** a frontend host and a Node backend:

1. Deploy `server/` to a Node host (Railway, Render, Fly.io, VPS, etc.).
2. Set `NODE_ENV=production`, `JWT_SECRET`, `CORS_ORIGINS`, and admin env vars.
3. Build the frontend with `VITE_API_URL=https://your-api.example.com/api`.
4. Deploy the `dist/` folder to Netlify, Vercel, or similar.

Static-only deploys (frontend without backend) will break auth, save project, and admin features.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + Vite dev server |
| `npm run server` | Backend only |
| `npm run dev:ui` | Frontend only |
| `npm run build` | Production frontend build |
| `npm run preview` | Preview production build |

## Security notes

- SQLite database (`server/buildx.db`) and uploads are gitignored — do not commit user data.
- Rotate any API key that was shared publicly.
- Use a strong random `JWT_SECRET` in production.

## License

MIT (or as specified by repository owner)
