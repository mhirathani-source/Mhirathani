---
name: Schema-only role rollout
description: Publish applies schema before app seed data; preserve legacy access without startup DDL
---

Do not introduce a schema-time users-to-role-catalog foreign key that assumes production role rows already exist. Initialize application data only at startup; all managed production schema changes belong to Publish, never startup DDL or deploy migration scripts.

**Why:** Development had seeded roles while production still had legacy admin accounts and an empty role catalog. Publish attempted the foreign key before the new app could seed roles, blocking deployment despite successful builds. Publish also applies the new pending default to existing account rows.

**How to apply:** Before adding data-dependent constraints, inspect production prerequisites read-only. Preserve role assignment validation and deletion/assignment serialization in the owner API. On the first access-model initialization only, preserve legacy account access; later pending accounts must still require approval. Never overwrite production with development test data to fix a schema rollout.
