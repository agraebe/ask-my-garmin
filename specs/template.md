---
title: <Feature Name>
status: draft   # draft | ready | in-progress | done
issue: "#<issue-number>"
pr: ""
created: YYYY-MM-DD
---

# <Feature Name>

## Problem statement

<!-- Why does this feature need to exist? What user pain or gap does it address? -->

## Goals

<!-- What will be true when this feature is done? (outcomes, not tasks) -->

-

## Non-goals

<!-- What is explicitly out of scope for this spec? -->

-

## Acceptance criteria

<!-- Numbered, testable statements. Each maps to ≥1 test case.
     Format: "AC-N: Given <context>, when <action>, then <outcome>."  -->

- AC-1:
- AC-2:

## Technical design

### Data shapes / types

<!-- New or changed TypeScript interfaces (add to src/types/index.ts) -->

```ts
// example
```

### Components / routes affected

<!-- List files that will be created or modified -->

| File | Change |
| ---- | ------ |
|      |        |

### Data flow

<!-- Describe the sequence of events (user action → API call → state update → render) -->

1.
2.

## Test scenarios

<!-- Derived from acceptance criteria. List all unit + integration test cases. -->

| ID   | Description                        | Type        | AC refs |
| ---- | ---------------------------------- | ----------- | ------- |
| T-1  |                                    | unit        | AC-1    |
| T-2  |                                    | integration | AC-2    |

## Open questions

<!-- Decisions still to be made. Remove this section when all are resolved. -->

-

## Implementation notes

<!-- Added after implementation: key decisions made, gotchas encountered. -->
