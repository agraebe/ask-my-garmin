# Product Guidelines

Files in this directory are automatically injected by Claude Code as system
reminders when the agent works on matching files.

## How to write a guideline

Create a `.md` file with an optional YAML frontmatter block that lists the
file glob patterns the guideline applies to:

```markdown
---
paths:
  - 'src/components/Payment*'
  - 'src/services/payment*'
---

# Payment Processing Guidelines

ALWAYS:

- Use PaymentService for all payment operations

NEVER:

- Store raw credit card numbers
```

Steer will also pick up these files for decision classification (M3).

Run `steer add-rule` for an interactive authoring experience.
