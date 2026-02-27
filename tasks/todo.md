# Python backend + garth 2FA rework

## Plan

Replace the `garmin-connect` npm package (no 2FA) with a Python FastAPI backend
using `garth` (full 2FA/MFA support). Expose the Garmin login flow in the UI.
No credentials in env vars.

## Tasks

- [x] Write tasks/todo.md plan
- [ ] Create backend/requirements.txt
- [ ] Create backend/garmin_client.py (garth data fetching)
- [ ] Create backend/main.py (FastAPI: auth + data + Claude streaming)
- [ ] Update next.config.ts (rewrite /api/\* → Python backend)
- [ ] Create src/components/LoginModal.tsx
- [ ] Refactor src/app/page.tsx → client component managing auth state
- [ ] Refactor src/components/GarminStatus.tsx → stateless display component
- [ ] Update src/test/msw/handlers.ts for new API shape
- [ ] Update src/components/GarminStatus.test.tsx for new props API
- [ ] Create src/components/LoginModal.test.tsx
- [ ] Delete src/app/api/\* (all Next.js API routes)
- [ ] Delete src/lib/garmin.ts + garmin-mock.ts + their tests
- [ ] Remove garmin-connect and @anthropic-ai/sdk from package.json
- [ ] Verify: npm run typecheck, lint, test:run all pass

## Architecture

```
backend/main.py (FastAPI on :8000)
  POST /api/auth/login   → garth login (returns mfa_required if 2FA)
  POST /api/auth/mfa     → submit MFA code, complete login
  GET  /api/auth/status  → check if authenticated
  POST /api/auth/logout  → clear garth session
  POST /api/ask          → fetch Garmin data + stream Claude response

next.config.ts
  rewrites: /api/* → http://localhost:8000/api/*
  (Next.js proxies; browser sees same-origin; no CORS needed)

Frontend
  page.tsx (client) → manages authState, shows LoginModal when not connected
  LoginModal.tsx     → email/password + optional MFA code flow
  GarminStatus.tsx   → stateless: receives email prop, has onLogout callback
  ChatInterface.tsx  → unchanged
```
