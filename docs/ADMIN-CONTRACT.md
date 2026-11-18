# Owner administration implementation contract

Prime Boxing Academy is a real single Jordanian boxing club. This is an existing Arabic RTL business application, not the separate v2 demo. Preserve existing styling and data. Prioritize legibility, organized information density, responsive mobile/iPad use, clear confirmations and success/error feedback. No emojis, fake data, placeholder controls or frontend-only security claims.

Create frontend files only inside `artifacts/club-manager/src/admin/`. Export named `AdminPage` from `AdminPage.tsx`. Main agent owns App.tsx routing/auth, all backend, DB, packages and workflows. `/admin` is protected for the main owner only by main agent. Use React Query and base-aware same-origin fetch. New APIs have no generated hooks yet. Prefix API paths with `import.meta.env.BASE_URL` (strip trailing slash), then `/api/club/admin`. Throw Arabic server error for any non-2xx result. Poll overview/users every 10 seconds; refresh session queries after grants, roles/users after permissions changes. Do not run a testing agent.

Make all 14 requested areas reachable: local admin sections for general, users, roles, financial settings, audit, backups, security; real links for `/members`, `/subscriptions`, `/plans`, `/finance` (includes categories, transactions, employees and payroll), `/reports`, `/settings/whatsapp`. Provide clear destinations labeled general settings, users, roles, members, subscriptions, debts/payments, accounting, income/expenses, payroll, reports, WhatsApp, backups, audit, security. Do not invent unimplemented modules.

## API (all relative to /api/club/admin)

- `GET /overview` -> `{pendingCount:number,userCount:number}`.
- `GET /users?status=&search=` -> array of `{id,clerkUserId,email,displayName:string|null,role,status:'pending'|'active'|'rejected'|'suspended',isOwner:boolean,permissions:string[],permissionOverrides:Record<string,boolean>,createdAt,updatedAt}`.
- `PATCH /users/:id` body `{status?,role?,permissionOverrides?}` -> user. Owner protected. Clear page heading "طلبات انضمام الموظفين"; show name/email/created date/status; approve with role and permissions, reject/suspend/reactivate. No deletion of actual login accounts. Per-user overrides must distinguish inherit/allow/deny, not accidentally turn inherited permissions into blanket deny.
- `GET /roles` -> `{roles:[{name,label,builtIn,permissions:string[],assignedCount:number}],catalog:[{name,label,section,sectionLabel,action,actionLabel}]}`.
- `POST /roles` body `{name:lowercase_slug,label,permissions:string[]}`.
- `PATCH /roles/:name` body `{label?,permissions?}`.
- `DELETE /roles/:name`: only custom unassigned roles, confirmation required.
- Matrix uses the actual catalog returned by server, grouped by section and action. Built-in role names: admin (administrative manager, NOT main owner), accountant, staff (reception), coach. Financial permissions are not default grants; owner alone has implicit full access.
- `GET /settings` -> `{clubName,currency:'JOD',timezone:'Asia/Amman',memberRequiredFields:string[],paymentMethods:string[],maxDiscountPercent:number,financialYearStartMonth:number,reminderDays:number[],renewalPolicy:'after_end'}`.
- `PUT /settings` whole object -> saved settings. Name/phone always required; optional email/birthDate. Currency/timezone/renewalPolicy read-only supported Jordan rules. Methods can enable cash/card/bank_transfer/wallet. The stored `reminderDays` field is legacy and no longer schedules WhatsApp messages. WhatsApp links are composed manually and require the employee to send from the app. Financial settings link to existing package/pricing/finance/payroll screens.
- `GET /audit?page=1&search=` -> `{items:[{id,actorId,actorName:string|null,action,entityType,entityId:number|null,details:object,createdAt}],total,page}`. Expand before/after details and paginate/filter. `GET /audit?format=csv` protected download via fetch/blob with error handling.
- `GET /backups` -> array `{id,label,createdAt,createdBy,bytes,counts:Record<string,number>}`.
- `POST /backups` body `{label?}` -> entry. AES-256-GCM encrypted business snapshot.
- `GET /backups/:id/file` -> encrypted JSON download.
- `POST /backups/import` body `{file:string}` -> entry. Read exported encrypted JSON text from file input, max 12 MB. Import does NOT restore automatically.
- `POST /backups/:id/preview` body `{}` -> `{counts,changes:Record<string,{current:number,backup:number}>,token:string,warning:string}`.
- `POST /backups/:id/restore` body `{token,confirmation:'استعادة '+id}` -> `{ok:true,preRestoreBackupId:number}`. Dangerous replacement of BUSINESS DATA ONLY. Preserve auth/roles/owner and audit; automatic pre-restore snapshot. Display impact counts, exact warning, typed confirmation and extra explicit confirmation. Never automatically restore or test destructive restore on user's records. Refresh all queries after restore. Explain DB-local snapshots alone are not disaster backups; download encrypted exports and keep SESSION_SECRET safe, never ask user to paste keys.
- `GET /security` -> readonly `{authProvider:'Clerk',requiresApproval:true,financialDefault:'deny',ownerProtected:true,backupEncryption:'AES-256-GCM',backupAvailable:boolean,sessionPolicySource:'Clerk'}`. Explain truthful controls, link `/account` for Clerk account/password management (main agent integrates UserProfile). No fake security toggles or unsupported tenant settings.

All writes must await server persistence before success. Show meaningful loading/empty/error states, disable duplicate submits. Existing financial/member screens remain the actual editing UI; do not replace their working functionality.
