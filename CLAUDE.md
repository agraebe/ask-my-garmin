# Claude Code Instructions — Ask My Garmin

## Project overview
Next.js 15 App Router web app that connects to a user's Garmin Connect account and lets them
ask natural-language questions about their fitness and health data. Claude (claude-sonnet-4-6)
answers questions by reasoning over live Garmin data injected into its context window.

## Dev environment
```bash
cp .env.example .env     # fill in GARMIN_EMAIL, GARMIN_PASSWORD, ANTHROPIC_API_KEY
npm install
npm run dev              # http://localhost:3000
npm run build            # production build (must pass before merging)
npm run lint             # ESLint
```

TypeScript type-check (no separate `tsc` script yet):
```bash
npx tsc --noEmit
```

## Architecture

```
src/
  app/
    page.tsx                  ← shell layout (header + ChatInterface)
    layout.tsx                ← root HTML, fonts, global CSS
    globals.css               ← Tailwind directives + custom animations
    api/
      ask/route.ts            ← POST: fetches Garmin data, streams Claude reply
      garmin/
        status/route.ts       ← GET: connectivity check (used by GarminStatus)
        data/route.ts         ← GET: raw Garmin snapshot JSON
  components/
    ChatInterface.tsx         ← streaming chat state machine
    MessageBubble.tsx         ← user (blue) / assistant (white) bubbles
    GarminStatus.tsx          ← header indicator, polls /api/garmin/status
    SuggestedQuestions.tsx    ← empty-state prompt chips
  lib/
    garmin.ts                 ← singleton GarminConnect client + helpers
  types/
    index.ts                  ← shared TS types (Message, GarminActivity, …)
```

### Data flow
1. User submits a question in `ChatInterface`
2. `POST /api/ask` fires; Garmin data is fetched in parallel via `Promise.allSettled`
3. Data + conversation history are injected into Claude's system prompt
4. `anthropic.messages.stream()` streams tokens back as a plain-text `ReadableStream`
5. The UI reads the stream and appends tokens to the assistant message in real time

### Key conventions
- **Garmin client is a module-level singleton** (`src/lib/garmin.ts`). Never instantiate
  `GarminConnect` outside that file.
- **`Promise.allSettled` on all Garmin calls** — partial failures must not crash responses.
  Surface errors in the data object so Claude can say "sleep data unavailable."
- **No `any` types** — use the interfaces in `src/types/index.ts`. Add new types there.
- **Server components by default** — only add `'use client'` when the component needs
  browser APIs, event handlers, or React hooks.
- **Tailwind only** — no CSS modules, no inline styles, no styled-components.
  Custom color `garmin-blue` and `garmin-dark` are defined in `tailwind.config.ts`.
- **API routes are Node.js runtime** (not Edge). `next.config.ts` lists `garmin-connect`
  in `serverExternalPackages`; do not move API routes to the Edge runtime.

## Secrets & security
- **Never log or expose `GARMIN_EMAIL`, `GARMIN_PASSWORD`, or `ANTHROPIC_API_KEY`.**
- API routes must never return raw credentials or session tokens to the client.
- The `.env` file is gitignored. Only `.env.example` (no real values) is committed.

## Adding new Garmin data sources
1. Add a fetch function in `src/lib/garmin.ts` using the existing `getClient()` pattern.
2. Add corresponding TypeScript types to `src/types/index.ts`.
3. Include the new data in the `garminData` object in `src/app/api/ask/route.ts`
   using `Promise.allSettled`.
4. Update the system prompt in `buildSystemPrompt` if the data needs explanation.

## What NOT to do
- Do not commit `.env` or any file containing real credentials.
- Do not bypass `Promise.allSettled` with `Promise.all` on Garmin calls — Garmin's API
  is unreliable and individual endpoint failures should be isolated.
- Do not switch to the Edge runtime for API routes — `garmin-connect` requires Node.js.
- Do not add `console.log` in production paths; use structured error objects instead.
- Do not create new top-level files/directories without a clear reason.
