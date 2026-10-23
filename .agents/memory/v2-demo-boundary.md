---
name: V2 independent demo boundary
description: Explicit user-approved separation between the local-only v2 demo and the real academy management system
---

The user requested Prime Boxing Academy Manager v2 as a frontend-only, local-state demo with fictional members, and explicitly chose a separate version while keeping the existing system unchanged.

**Why:** The original app has real database-backed authentication and financial access restrictions; replacing it with public demo login would weaken its protection. The standalone choice was confirmed by the user.

**How to apply:** Keep v2 isolated from the original app's API, Clerk users, database and WhatsApp connection. Demo login and reminder simulation must not be presented as secure production authentication or real message delivery. In v2 only, reception staff may see fixed package prices and manage subscriptions; financial totals and employee management remain admin-only. Do not apply this demo exception to the original app's admin-only financial policy.
