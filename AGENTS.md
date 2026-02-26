# Agent Guide — Ask My Garmin

This file provides orientation for any AI agent (Claude Code, Copilot, Cursor, etc.)
working in this repository. Read it before making changes.

## What this project does
A Next.js web app that authenticates with Garmin Connect and provides a streaming
chat interface powered by Claude. Users ask natural-language questions about their
fitness data ("How far did I run this week?") and Claude answers using live Garmin data.

## Tech stack
| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 3 |
| Garmin API | `garmin-connect` npm package |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) / claude-sonnet-4-6 |
| Runtime | Node.js (not Edge) |

## Critical files
| File | Purpose |
|---|---|
| `src/lib/garmin.ts` | All Garmin API interactions. Singleton client. |
| `src/types/index.ts` | Canonical TypeScript interfaces for all data shapes. |
| `src/app/api/ask/route.ts` | Core AI endpoint — data fetching + Claude streaming. |
| `src/app/api/garmin/status/route.ts` | Health check for the Garmin connection. |
| `src/components/ChatInterface.tsx` | All client-side chat state and streaming logic. |
| `.env.example` | Template for required environment variables. |
| `next.config.ts` | Marks `garmin-connect` as server-only (Node.js). |

## Environment variables
```
GARMIN_EMAIL       # Garmin Connect login email
GARMIN_PASSWORD    # Garmin Connect login password
ANTHROPIC_API_KEY  # Anthropic API key
```
None of these should ever appear in committed code or logs.

## How to verify your changes work
```bash
npm run lint          # ESLint — must pass
npx tsc --noEmit      # TypeScript — must pass
npm run build         # Next.js build — must pass before any PR is merged
```
There is no test suite yet. Type correctness and a successful build are the
minimum bars for any change.

## Coding conventions agents must follow

### TypeScript
- Strict mode is on. No `any`. No `@ts-ignore` without an explanatory comment.
- Add new shared types to `src/types/index.ts`, not inline in component files.
- Use `unknown` + type narrowing instead of casting with `as` wherever possible.

### React / Next.js
- Default to Server Components. Add `'use client'` only when needed.
- Keep API routes in `src/app/api/`. Do not create `src/pages/api/`.
- Use `Promise.allSettled` (never `Promise.all`) for any group of Garmin calls.

### Tailwind
- Use utility classes only. No inline `style=` props, no CSS modules.
- Garmin brand colors: `garmin-blue` (#007DC3), `garmin-dark` (#1D2F3F).

### Garmin client
- All access goes through `src/lib/garmin.ts`. Never import `garmin-connect` directly
  in a route or component.
- The module-level singleton (`client`) is intentional — do not refactor it away.

### Security
- Credentials must not leak to the client. API routes return only processed data.
- The Garmin singleton login happens server-side only.

## Mobile-first development workflow

This project is designed to be developed entirely from a phone via the GitHub app.
There is no local dev loop for the owner — all work is done through GitHub Issues and PRs.

```text
 [You on phone]          [GitHub Actions — automatic]
       │
       ▼
 Open an Issue
 (use a template)
       │
       └──────────────────► claude-requirements.yml fires
                             Claude posts requirements breakdown
                             as an issue comment
       │
       ▼
 Read requirements,
 ask follow-up Qs,
 or comment:
 "@claude implement"
       │
       └──────────────────► claude-implement.yml fires
                             Claude writes code, runs tsc + lint + build,
                             opens a PR (closes the issue)
       │
       └──────────────────► claude-review.yml fires (auto on PR open)
                             Claude posts a thorough code review
       │
       ▼
 Review the PR + Claude's
 review in GitHub app.
 Merge or request changes.
```

### Triggering Claude

| What you type | Where | What happens |
| --- | --- | --- |
| *(nothing — just open issue)* | New issue | Requirements drafted automatically |
| `@claude implement` | Issue comment | Claude codes + opens a PR |
| `@claude fix the lint error` | PR review comment | Claude pushes a fix commit |
| `@claude [any instruction]` | Issue or PR comment | Claude acts on the instruction |

## Scope limits for autonomous agents

Agents operating via GitHub Actions (e.g., on `@claude` mentions) should:

**Feel free to:**

- Fix TypeScript errors and ESLint warnings
- Add new Garmin data sources (following the pattern in `src/lib/garmin.ts`)
- Improve UI components (styling, accessibility, UX)
- Add new suggested questions in `SuggestedQuestions.tsx`
- Write or improve types in `src/types/index.ts`
- Refactor within existing files while preserving public API surfaces

**Ask before:**

- Changing the Claude model or system prompt in `api/ask/route.ts`
- Adding new npm dependencies
- Restructuring the `src/` directory layout
- Modifying `.github/workflows/`

**Never do:**

- Commit or log real credentials
- Move API routes to Edge runtime
- Replace `Promise.allSettled` with `Promise.all` on Garmin calls
- Add `console.log` to production code paths
- Create files outside the existing directory structure without discussion
