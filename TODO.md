# TODO — Unfinished & Future Work

Items marked `[REQUIRED]` must be done before this is truly production-ready.
Items marked `[NICE]` are improvements worth doing but not blockers.

---

## Deployment

- `[REQUIRED]` **Set Vercel environment variables** for all three environments
  (Production, Preview, Development) in the Vercel dashboard:
  - `GARMIN_EMAIL`
  - `GARMIN_PASSWORD`
  - `ANTHROPIC_API_KEY`
    Without these, every Vercel deployment (including PR previews) will fail at runtime.

- `[REQUIRED]` **Run `npm install` locally after cloning** to activate the Husky
  pre-commit and pre-push hooks. The hooks are in `.husky/` but Husky's shims only
  exist after running `npm install` (the `prepare` script runs `husky`).

- `[NICE]` **Garmin session cold-start latency (~2–3 s)** — On every Vercel cold start,
  the singleton `client` in `src/lib/garmin.ts` is null and a fresh Garmin login is
  triggered. Fix: cache the OAuth tokens in Vercel KV (or another KV store) and reload
  them via `client.loadToken(oauth1, oauth2)` on warm-up. The `garmin-connect` package
  supports `exportToken()` / `loadToken()`.

- `[NICE]` **Region selection** — `vercel.json` currently targets `iad1` (US East).
  Change if users are in a different region.

---

## Testing

- `[REQUIRED]` **Verify the test suite runs** — `npm run test:run` has not been
  confirmed passing yet. Run it once locally after `npm install`.

- `[NICE]` **`/api/ask` has no real streaming test** — The MSW handler in
  `src/test/msw/handlers.ts` returns a simple string, not a chunked stream.
  A proper test should use `ReadableStream` chunks and verify the `ChatInterface`
  appends tokens progressively.

- `[NICE]` **API route tests** — There are no tests for `api/garmin/status`,
  `api/garmin/data`, or `api/ask`. These are server-only routes; test them by
  calling the handler functions directly with a mocked `Request` object.

- `[NICE]` **Raise coverage thresholds** — Currently 60% across lines/functions/
  branches in `vitest.config.ts`. Increase to 80% once the core feature set is stable.

---

## Performance & Reliability

- `[NICE]` **Garmin API is reverse-engineered** — `garmin-connect` uses undocumented
  Garmin endpoints that may break without notice on Garmin's side. Consider:
  - Wrapping all Garmin calls with a retry + exponential backoff
  - Adding a circuit breaker so repeated Garmin failures don't hang the UI

- `[NICE]` **Rate limiting on API routes** — `/api/ask` calls both Garmin and
  Anthropic on every request. Add simple in-memory rate limiting (or use
  Vercel's Edge Middleware) to prevent abuse.

- `[NICE]` **Max token handling** — If the Garmin data payload is very large,
  it may approach Claude's context limit. Truncate or summarise large activity
  arrays before injecting into the system prompt.

---

## Security

- `[NICE]` **Garmin credentials in env vars** — The app uses username/password
  directly. Garmin's unofficial API has no OAuth for third-party apps. If this
  becomes a multi-user app, each user would need their own credentials — redesign
  the auth model first.

- `[NICE]` **Error monitoring** — Add Sentry (or similar) to capture runtime errors
  from Garmin auth failures, Anthropic API errors, and streaming failures.

---

## Features

- `[NICE]` **More Garmin data sources** — The following `garmin-connect` methods are
  available but not yet used:
  - `getDailyHydration(date)` — hydration log
  - `getDailyWeightData(date)` — body weight
  - `getHeartRate(date)` — already used in `getDailyStats` but the full epoch data
    (`heartRateValues`) could be summarised for trend questions

- `[NICE]` **Dynamic suggested questions** — `SuggestedQuestions.tsx` has a hardcoded
  list. Replace or supplement with questions generated from the user's recent activity
  types (e.g. surface "How was my swim?" only if the last activity was a swim).

- `[NICE]` **Conversation history limit** — `ChatInterface` passes the full
  `messages` array to `/api/ask` on every turn. Truncate to the last N turns to
  prevent the context from growing unbounded across a long session.
