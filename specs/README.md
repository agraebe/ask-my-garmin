# Specs — Ask My Garmin

This directory contains feature specs for the project. Specs are the **source of truth** for
what gets built and why. No implementation code is written without a corresponding spec.

## Directory layout

```
specs/
  README.md          ← You are here
  template.md        ← Blank spec template — copy this for every new feature
  features/          ← One file per feature (active, in-progress, or done)
```

## Spec lifecycle

| Status        | Meaning                                                         |
| ------------- | --------------------------------------------------------------- |
| `draft`       | Being written — not ready for implementation                    |
| `ready`       | Acceptance criteria are finalized — tests can be written        |
| `in-progress` | TDD cycle underway — tests written, implementation in progress  |
| `done`        | All acceptance criteria pass, PR merged                         |

## Workflow

1. **Create a spec** by copying `template.md` → `features/<kebab-case-name>.md`.
2. Fill in every section. Set `status: ready` when acceptance criteria are complete.
3. Commit the spec before writing any test or implementation code.
4. Write **failing tests** that encode each numbered acceptance criterion (TDD Red).
5. Write the minimum code to make the tests pass (TDD Green).
6. Refactor while keeping tests green.
7. Update `status: done` in the spec and include it in the same PR.

## Naming conventions

- File names use lowercase kebab-case: `garmin-data-sources.md`, `chat-streaming.md`.
- Acceptance criteria are numbered (AC-1, AC-2, …) and referenced in test `describe`/`it`
  blocks so reviewers can trace code back to requirements.

## Example acceptance criterion → test mapping

Spec:
```
### Acceptance criteria

- AC-1: The status indicator shows "Connected" when `/api/garmin/status` returns `{ connected: true }`.
- AC-2: The status indicator shows "Disconnected" when the endpoint returns `{ connected: false }`.
```

Test:
```tsx
describe('GarminStatus', () => {
  it('AC-1: shows Connected when status endpoint returns connected: true', async () => { ... });
  it('AC-2: shows Disconnected when status endpoint returns connected: false', async () => { ... });
});
```
