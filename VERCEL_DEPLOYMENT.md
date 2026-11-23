# RaktSetu — one Vercel project

This branch preserves the existing frontend and backend folders but exposes both through one Vercel project and one domain.

## Vercel settings

- Root Directory: repository root (`./`); do not choose either subfolder.
- Framework Preset: Other.
- Install Command: `npm install`.
- Build Command: `npm run build`.
- Output Directory: `raktsetufrontend/build`.

## Required environment variables

Set these in Vercel Project Settings → Environment Variables for Production (and Preview if required):

- `MONGO_URI`: MongoDB Atlas connection string; configure Atlas network access for the deployment.
- `JWT_SECRET`: random secret with at least 32 characters. Never commit this value.
- `CLIENT_ORIGIN`: optional comma-separated list of exact allowed frontend origins, particularly if using a custom domain or external clients.

Do not set `REACT_APP_API_BASE_URL` for same-domain deployment. In production, the frontend defaults to `/api`; local development keeps `http://localhost:5000/api`.

## What changed

- Added a root `package.json` to install backend runtime dependencies and build the nested React frontend.
- Added `api/[...path].js` to route `/api/*` requests into the existing Express application.
- Added `vercel.json` with the build/output configuration and `/admin` SPA fallback.
- Updated the Express server to export the app, connect to MongoDB lazily for serverless invocations, and continue to run normally in local development.
- Updated the frontend API base so production requests use the same domain.

## Verify after deployment

1. Deploy this branch in Vercel with the repository root selected.
2. Add the environment variables before testing database-backed features.
3. Open `/` for the frontend, `/api/health` for API liveness (works even if MongoDB is unavailable), `/api/health/ready` for database/configuration readiness, and `/admin` for the admin route.
4. If API calls return 503, check `MONGO_URI` and `JWT_SECRET`. Never paste secrets into chat or issues.

Vercel functions are serverless: local files and in-memory state are not durable. SMS/email/push notifications are not enabled merely by deploying this branch.
