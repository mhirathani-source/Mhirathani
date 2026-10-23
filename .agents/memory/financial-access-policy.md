---
name: Admin-only financial access
description: Owner's standing rule for access to financial information throughout the academy app
---

Only accounts with the admin role may see financial data and reports. Non-admin users must not obtain those data through direct URLs or API requests, including financial information embedded in member/subscription screens. Keep the financial pages for admins rather than deleting them. New accounts must not default to admin, and the owner's account must retain admin access.

**Why:** The owner explicitly identified financial visibility for all users as a critical security issue and requested backend-enforced access, not navigation hiding alone.

**How to apply:** Treat this as a product-wide visibility rule when adding dashboards, member views, reports, exports, payroll, or other features that expose money. Provide separate non-financial operational responses when staff need access.
