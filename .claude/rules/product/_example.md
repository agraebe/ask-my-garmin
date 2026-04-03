## <!-- Example guideline — rename and edit to activate -->

paths:

- "src/components/Payment\*"
- "src/services/payment\*"

---

# Payment Processing Guidelines

ALWAYS:

- Use the existing PaymentService class for all payment operations
- Show itemized totals before payment confirmation

ASK FIRST:

- Before creating any new payment-related database tables
- Before adding a new payment method type

NEVER:

- Store raw credit card numbers in any form
- Skip payment confirmation screens
