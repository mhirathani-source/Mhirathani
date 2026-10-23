---
name: Explicitly delegated financial access
description: Owner-only default and deliberate per-section financial grants, replacing the older admin-role-only rule
---

The owner has full financial access by default. Other accounts, including administrative managers and accountants, receive financial access only when the owner explicitly grants the relevant section/action. A role name alone must not imply financial access. Unapproved, rejected and suspended accounts cannot access club records. The owner-only control panel must not be self-delegated or used by staff to approve themselves.

**Why:** The user replaced the earlier admin-role-only rule with configurable roles and per-user permissions, explicitly requiring that no employee receive financial access without the owner's grant.

**How to apply:** Enforce status and database-backed permissions on every sensitive API, including embedded money, reports, exports and payroll. Provide separate non-financial operational responses. Preserve the real owner's identity, access, login details and all existing data.
