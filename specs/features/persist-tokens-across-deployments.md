---
title: Persist Garmin Session Tokens Across Deployments
status: ready
issue: '#39'
pr: ''
created: 2026-03-07
---

# Persist Garmin Session Tokens Across Deployments

## Problem statement

On every Railway deployment (or browser tab close), users must log back into Garmin Connect.
With 2FA enabled this is especially disruptive. Two independent root causes compound the pain:

1. **Browser-side**: The Garmin session token is stored in `sessionStorage`, which is scoped
   to a single browser tab. Closing the tab (or the browser) wipes it.

2. **Server-side**: When `SESSION_SECRET` is not set in the Railway environment, the backend
   generates a random Fernet key on every startup. Tokens encrypted under the old key can no
   longer be decrypted after a redeployment, forcing a fresh login even if the client still
   holds a token.

## Goals

- The logged-in state survives browser restarts (tab close / machine reboot).
- The logged-in state survives Railway redeployments when `SESSION_SECRET` is configured.
- The `SESSION_SECRET` environment variable is documented in `.env.example` with generation
  instructions, so operators know they must set it.

## Non-goals

- Server-side token storage / database-backed sessions (out of scope for this change).
- Automatic token refresh when Garmin revokes OAuth credentials.
- Changing the login UX or 2FA flow.

## Acceptance criteria

- AC-1: Given a successful login, when the user closes and reopens the browser, then the app
  restores the session and the user does not see the login modal.
- AC-2: Given a successful login, when the session token is written to storage, then it is
  written to `localStorage` (not `sessionStorage`).
- AC-3: Given a logout action, when the user clicks logout, then the session token is removed
  from `localStorage`.
- AC-4: Given an updated session token from the backend (`X-Session-Token` response header),
  when a streaming response is received, then the updated token is written to `localStorage`.
- AC-5: The `.env.example` file documents `SESSION_SECRET` with generation instructions and
  explains that it must be stable across deployments.

## Technical design

### Data shapes / types

No new types required.

### Components / routes affected

| File | Change |
| ---- | ------ |
| `src/components/LoginModal.tsx` | Replace `sessionStorage` → `localStorage` for token write |
| `src/app/page.tsx` | Replace `sessionStorage` → `localStorage` for token read/clear |
| `src/components/ChatInterface.tsx` | Replace `sessionStorage` → `localStorage` for token read/update |
| `.env.example` | Add `SESSION_SECRET` with documentation |

### Data flow

1. User logs in successfully → backend returns `session_token`.
2. `LoginModal` writes token to `localStorage['garmin_session']` (was `sessionStorage`).
3. On app boot, `page.tsx` reads from `localStorage['garmin_session']` and checks status.
4. Per-request, `ChatInterface` reads token from `localStorage['garmin_session']`.
5. If backend rotates token (OAuth refresh), `ChatInterface` updates `localStorage`.
6. On logout, `page.tsx` removes `localStorage['garmin_session']`.

**For deployments to survive restarts:** the operator must set a stable `SESSION_SECRET`
environment variable in Railway so the Fernet key does not rotate on each restart.

## Test scenarios

| ID  | Description | Type | AC refs |
| --- | ----------- | ---- | ------- |
| T-1 | After successful login, token is written to `localStorage` | unit | AC-2 |
| T-2 | After logout, token is removed from `localStorage` | unit | AC-3 |
| T-3 | ChatInterface reads token from `localStorage` when sending a message | unit | AC-2 |
| T-4 | ChatInterface updates `localStorage` when X-Session-Token header is received | unit | AC-4 |

## Implementation notes

The `garmin_session` key name is unchanged — only the storage tier changes.
`localStorage` persists across browser restarts and survives redeployments as long as the
domain and browser profile are the same. The server-side `SESSION_SECRET` is a separate
concern (deployment config), documented in `.env.example`.
