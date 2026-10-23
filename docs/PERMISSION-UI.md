# Focused follow-up frontend work

Edit ONLY `MembershipPages.tsx` and `FinancePages.tsx` inside the main club-manager. Main owns App/authz/backend/admin. No workflows, dependencies or browser testing.

Main created `src/authz.ts`: `useAccess()` returns `{can(...permissionNames),isOwner,session}`. Status/permissions now govern access; role `admin` alone does not imply access. Replace role checks with per-action permission gates, including forms, add/edit/archive/delete/export/print/payment/action controls.

- Member permissions: `members.view/create/edit/delete`. Read-only member access must show no add/edit/archive/delete buttons.
- Subscription `subscriptions.view/create/edit`, financial payment `payments.view/create/edit`. Renew also requires subscription create. Financial member details mount only when authorized, but still gate mutation controls.
- Finance permissions: `finance.view/create/edit/delete/export`.
- Employee permissions: `employees.view/create/edit/delete`.
- Payroll permissions: `payroll.view/create/edit/delete/approve`. `approve` controls actual salary disbursement.
- Report permissions: `reports.view/export`.

FinancePage must conditionally enable hooks and expose sections by permission. No employee/payroll/finance requests or aggregates for ungranted sections. Default selected tab must work for payroll-only/employees-only accounts. No broad isAdmin write flag. Cash hero and transaction summary only for finance.view. Creating payroll may need employees.view for employee selection; show honest dependency instead of fetching hidden employee data.

Real backend additions being implemented:

- POST `/api/finance/transactions/:id/reverse` `{reason:string}` -> transaction. Permission finance.delete. Require confirmation and reason. Transaction response gains `reversed:boolean`, `reversalOfId:number|null`; hide edit/reverse for already reversed and counter rows; indicate status.
- PATCH `/api/finance/payroll/:id` `{amountFils,dueDate,period}` -> entry. Permission payroll.edit. No below-paid amount, backend enforced.
- DELETE `/api/finance/payroll/:id` ->204, only unpaid. Permission payroll.delete. Confirmation.
- DELETE `/api/finance/employees/:id` -> `{archived:boolean}`, archive linked records. Permission employees.delete.
- DELETE `/api/finance/categories/:id` -> `{archived:boolean}`, archive linked records. Permission finance.delete.
- POST `/api/payments/:id/reverse` `{reason:string}` -> refund row. Permission payments.edit. Show original receipt/amount, confirmation and reason; backend prevents duplicate reversal. Keep original payment.
- GET `/api/finance/reports?format=csv&period=...&date=...` -> real CSV. Require reports.export on server too. Replace client CSV export with fetch/blob, using app base prefix and same-origin credentials, handling HTTP errors. Print only reports.export. View-only users may read report, not export controls.

Await success, show actual Arabic server errors, invalidate relevant queries. Do not invent endpoints, mock data or financial totals. Match existing UI and responsive behavior.
