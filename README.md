# Ask My Garmin

A conversational AI app that connects to your Garmin Connect account and answers natural-language questions about your fitness and health data — powered by Claude Sonnet 4.6.

> "How was my training load this week?" / "Am I recovered enough to run hard tomorrow?" / "What were my best running activities this month?"

## Features

- **Natural language fitness queries** — ask anything about your activities, sleep, heart rate, training status, and daily stats
- **Live Garmin data** — fetches real-time data from Garmin Connect on every question
- **Streaming responses** — Claude's answer appears token-by-token for a responsive feel
- **2FA / MFA support** — works with Garmin accounts that require two-factor authentication
- **Per-user encrypted sessions** — no shared credentials; each browser tab is isolated
- **Fun mode** — toggle "RunBot 9000" for a stereotypically enthusiastic running coach persona

## Architecture

```
Browser (Next.js 15)  ──/api/*──▶  Python FastAPI (:8000)
                                        │
                           ┌────────────┴────────────┐
                           ▼                         ▼
                    Garmin Connect            Anthropic Claude
                    (via garth)               (claude-sonnet-4-6)
```

- **Frontend** (`src/`) — Next.js 15 App Router, React 19, Tailwind CSS, TypeScript
- **Backend** (`backend/`) — Python FastAPI, [garth](https://github.com/matin/garth) for Garmin auth, Anthropic Python SDK
- **Proxy** — Next.js rewrites `/api/*` to the Python backend (no CORS needed)
- **Sessions** — Garmin credentials stay on-server; browser only holds an encrypted session token

## Prerequisites

- Node.js 18+
- Python 3.11+
- A [Garmin Connect](https://connect.garmin.com) account
- An [Anthropic API key](https://console.anthropic.com)

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/agraebe/ask-my-garmin.git
cd ask-my-garmin

# Frontend
npm install

# Backend
cd backend && pip install -r requirements.txt && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```
BACKEND_URL=http://localhost:8000      # Python backend (local default)
```

Set your Anthropic API key on the backend side:

```bash
# backend/.env (or export in terminal)
ANTHROPIC_API_KEY=sk-ant-...
SESSION_SECRET=<random-base64-key>     # optional; omit for dev (sessions reset on server restart)
```

### 3. Start both servers

```bash
# Terminal 1 — Python backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 — Next.js frontend
npm run dev       # http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000), enter your Garmin credentials, and start asking questions.

## Data Flow

1. User logs in with Garmin email + password (+ optional 2FA code)
2. Backend authenticates via `garth`, encrypts the Garmin session, returns a token
3. User asks a question; browser sends question + session token to `POST /api/ask`
4. Backend decrypts the session, fetches live Garmin data in parallel:
   - Recent activities (up to 200, paginated)
   - Today's daily stats (steps, calories, floors, HR)
   - Last night's sleep (stages, duration, score)
   - Heart rate zones
   - Training status (load, recovery, VO2 max estimate)
5. Data + conversation history are injected into Claude's system prompt
6. Claude streams a response; tokens are forwarded to the browser in real time
7. A refreshed session token is returned in the `X-Session-Token` response header

## Quality Commands

All checks must pass before merging. CI runs them in order:

```bash
npm run format:check     # Prettier — check formatting
npm run lint             # ESLint with zero warnings
npm run typecheck        # tsc --noEmit (TypeScript strict)
npm run test:run         # Vitest single run
npm run build            # Next.js production build
```

Other useful commands:

```bash
npm run format           # Auto-fix formatting
npm run lint:fix         # Auto-fix lint issues
npm run test             # Vitest in watch mode
npm run test:coverage    # Vitest + V8 coverage report
npm run e2e              # Playwright end-to-end tests
```

## Project Structure

```
ask-my-garmin/
├── backend/
│   ├── main.py              # FastAPI app — auth, session encryption, /api/ask streaming
│   ├── garmin_client.py     # Garmin data fetching (accepts garth.Client per-call)
│   ├── requirements.txt
│   └── Procfile             # Railway deployment
├── src/
│   ├── app/
│   │   ├── page.tsx         # Root client component — auth state + layout
│   │   └── layout.tsx       # HTML shell, fonts, global CSS
│   ├── components/
│   │   ├── ChatInterface.tsx      # Streaming chat state machine
│   │   ├── MessageBubble.tsx      # User / assistant message bubbles
│   │   ├── GarminStatus.tsx       # Connection indicator
│   │   ├── LoginModal.tsx         # Login form + MFA flow
│   │   └── SuggestedQuestions.tsx # Empty-state prompt chips
│   ├── types/index.ts       # Shared TypeScript types (Message)
│   └── test/                # MSW mock handlers + Vitest setup
├── e2e/                     # Playwright end-to-end tests
├── .github/
│   └── workflows/           # CI, Claude agentic workflows, nightly E2E
├── CLAUDE.md                # Claude Code instructions (for AI agents)
├── AGENTS.md                # Agent orientation guide
└── next.config.ts           # API proxy rewrites
```

## Deployment

The app deploys as two separate services:

| Service  | Platform                       | Notes                                         |
| -------- | ------------------------------ | --------------------------------------------- |
| Frontend | [Vercel](https://vercel.com)   | Set `BACKEND_URL` to your Railway backend URL |
| Backend  | [Railway](https://railway.app) | Set `ANTHROPIC_API_KEY` and `SESSION_SECRET`  |

**Required environment variables:**

| Variable            | Where   | Description                                                                                                                                  |
| ------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `BACKEND_URL`       | Vercel  | URL of the Railway backend (e.g. `https://your-app.railway.app`)                                                                             |
| `ANTHROPIC_API_KEY` | Railway | Anthropic API key for Claude                                                                                                                 |
| `SESSION_SECRET`    | Railway | Fernet key for session encryption; generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |

## GitHub Actions

| Workflow                  | Trigger                       | Purpose                                      |
| ------------------------- | ----------------------------- | -------------------------------------------- |
| `ci.yml`                  | Push / PR                     | TypeScript check, lint, build                |
| `claude.yml`              | `@claude` comment on issue/PR | Claude implements requested changes          |
| `claude-requirements.yml` | New issue opened              | Claude drafts a requirements breakdown       |
| `claude-review.yml`       | PR opened                     | Claude posts a code review                   |
| `nightly-e2e.yml`         | Scheduled (nightly)           | Playwright E2E tests; opens issue on failure |

**Required GitHub Secrets:**

| Secret              | Used by                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | All Claude workflows                                                    |
| `VERCEL_TOKEN`      | Vercel MCP (deployment logs)                                            |
| `RAILWAY_TOKEN`     | Railway MCP (build/service logs)                                        |
| `GH_PAT`            | `nightly-e2e` — creates issues so `issues:opened` triggers `claude.yml` |

## Security Notes

- Garmin credentials are never stored — only a short-lived encrypted session token is issued
- The session token is kept in browser `sessionStorage` (cleared on tab close)
- `SESSION_SECRET` should be a stable Fernet key in production (otherwise sessions invalidate on server restart)
- Rate limiting on login: 5 attempts per IP per 15 minutes
- The `.env` file is gitignored; never commit real credentials

## Contributing

1. Fork the repo and create a feature branch
2. Follow the conventions in [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md)
3. Run `npm run lint && npm run typecheck && npm run test:run` before pushing
4. Open a pull request — Claude will post an automated code review

## License

MIT
