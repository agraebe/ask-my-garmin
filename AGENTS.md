# Agent Guide — Ask My Garmin

This file provides orientation for any AI agent (Claude Code, Copilot, Cursor, etc.)
working in this repository. Read it before making changes.

## What this project does

A Next.js web app that authenticates with Garmin Connect and provides a streaming
chat interface powered by Claude. Users ask natural-language questions about their
fitness data ("How far did I run this week?") and Claude answers using live Garmin data.

## Tech stack

| Layer      | Technology                                              |
| ---------- | ------------------------------------------------------- |
| Framework  | Next.js 15 (App Router)                                 |
| Language   | TypeScript (strict)                                     |
| Styling    | Tailwind CSS 3                                          |
| Garmin API | `garmin-connect` npm package                            |
| AI         | Anthropic SDK (`@anthropic-ai/sdk`) / claude-sonnet-4-6 |
| Runtime    | Node.js (not Edge)                                      |

## Critical files

| File                                 | Purpose                                              |
| ------------------------------------ | ---------------------------------------------------- |
| `src/lib/garmin.ts`                  | All Garmin API interactions. Singleton client.       |
| `src/types/index.ts`                 | Canonical TypeScript interfaces for all data shapes. |
| `src/app/api/ask/route.ts`           | Core AI endpoint — data fetching + Claude streaming. |
| `src/app/api/garmin/status/route.ts` | Health check for the Garmin connection.              |
| `src/components/ChatInterface.tsx`   | All client-side chat state and streaming logic.      |
| `.env.example`                       | Template for required environment variables.         |
| `next.config.ts`                     | Marks `garmin-connect` as server-only (Node.js).     |

## Environment variables

```
GARMIN_EMAIL       # Garmin Connect login email
GARMIN_PASSWORD    # Garmin Connect login password
ANTHROPIC_API_KEY  # Anthropic API key
```

None of these should ever appear in committed code or logs.

## Required GitHub repository secrets

| Secret              | Purpose                                       | Where to generate                   | Notes                                                                                                                                          |
| ------------------- | --------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | All Claude workflows                          | Anthropic console                   |                                                                                                                                                |
| `VERCEL_TOKEN`      | Claude MCP — Vercel deployment & runtime logs | Vercel → Account Settings → Tokens  | Personal access token (not OAuth). Passed to `@vercel/sdk mcp start --bearer-token`.                                                           |
| `RAILWAY_TOKEN`     | Claude MCP — Railway service & build logs     | Railway → Account Settings → Tokens | **Account-scoped** token. Passed as `RAILWAY_API_TOKEN` env var to `@railway/mcp-server`. Project-scoped tokens can't read cross-project logs. |

None of these should ever appear in committed code or logs.

### MCP architecture notes

- **Vercel**: `mcp.vercel.com` requires OAuth (browser flow — unusable in CI). We use the local
  `@vercel/sdk` MCP server instead, which accepts a personal access token directly.
- **Railway**: The `@railway/mcp-server` package shells out to the `railway` CLI binary. The
  workflows install it via `npm install -g @railway/cli` before running Claude. The token must
  be account-scoped (`RAILWAY_API_TOKEN`) to access logs and projects across all services.

## How to verify your changes work

```bash
npm run format:check  # Prettier — must pass
npm run lint          # ESLint (zero warnings) — must pass
npm run typecheck     # tsc --noEmit — must pass
npm run test:run      # Vitest single run — must pass (≥80% coverage)
npm run build         # Next.js production build — must pass
```

All five checks must pass before a PR is merged. CI enforces them in this order.

## Spec-Driven Development (SDD) + TDD workflow

### Every non-trivial change follows this order

1. **Write a spec** in `specs/features/<kebab-case-name>.md` using `specs/template.md`.
   - Fill in: problem statement, acceptance criteria, technical design, test scenarios.
   - Set `status: ready` when the spec is complete.
   - Commit the spec _before_ writing any implementation code.

2. **Write failing tests** (TDD Red phase).
   - Each acceptance criterion → at least one test case.
   - Tests must fail because the code does not exist yet.

3. **Implement** (TDD Green phase).
   - Write the minimum code to make all tests pass.
   - No gold-plating; stay within the spec's scope.

4. **Refactor** (TDD Refactor phase).
   - Clean up while keeping tests green.

5. **Update the spec** status to `done` in the same PR.

### What counts as non-trivial

- Any new component, route, or lib function
- Any change to data shapes, API contracts, or the Claude system prompt
- Any UI flow with multiple states

Simple one-line fixes do not need a spec.

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
                             + drafts a spec in specs/features/
                             as an issue comment
       │
       ▼
 Read requirements,
 ask follow-up Qs,
 or comment:
 "@claude implement"
       │
       └──────────────────► claude-implement.yml fires
                             Claude writes failing tests first (TDD),
                             then implements, runs full CI suite,
                             opens a PR (closes the issue)
       │
       └──────────────────► claude-review.yml fires (auto on PR open)
                             Claude posts a thorough code review
       │
       └──────────────────► Vercel builds a preview deployment
                             vercel-preview-ready.yml posts preview URL
                             + manual test checklist on the PR
       │
       ▼
 Review the PR + Claude's
 review + Vercel preview
 in GitHub app.
 Merge or request changes.
       │
       └──────────────────► Vercel deploys to Production (main branch)
```

### Triggering Claude

| What you type                 | Where               | What happens                       |
| ----------------------------- | ------------------- | ---------------------------------- |
| _(nothing — just open issue)_ | New issue           | Requirements drafted automatically |
| `@claude implement`           | Issue comment       | Claude codes + opens a PR          |
| `@claude fix the lint error`  | PR review comment   | Claude pushes a fix commit         |
| `@claude [any instruction]`   | Issue or PR comment | Claude acts on the instruction     |

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
