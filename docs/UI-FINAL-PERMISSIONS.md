# Final focused changes

Continue with only MembershipPages.tsx and FinancePages.tsx.

1. Cancel subscription must require BOTH `subscriptions.edit` and `subscriptions.delete`; backend now rejects cancel without delete.
2. Query GET `/api/club/operations/settings` using queryKey `["clubSettings","operational"]` (active users, no special financial permission). Returns `{clubName,memberRequiredFields:string[],paymentMethods:string[],maxDiscountPercent}`. Reflect required email/birthDate in MemberForm (`required` HTML and validation); filter method dropdowns to only enabled methods in both files. Do not submit default cash when disabled; pick first enabled method. Server enforces this too.
3. Add actual CSV download buttons with export permissions:
   - members: `/api/club/exports/members`, requires members.export.
   - subscriptions: `/api/club/exports/subscriptions`, requires subscriptions.export. The server strips money for accounts without payments.view.
   - Finance transaction section `/api/club/exports/finance`, finance.export.
   - Payroll section `/api/club/exports/payroll`, payroll.export.
   Same-origin/base-aware fetch/blob, actual errors, no hardcoded domain.
4. Summary amounts should include signed correction rows; counter transactions now have SAME kind with NEGATIVE amountFils, so income is never inflated by reversing an expense. Do not filter these out of sums. They are marked reversalOfId, and originals reversed=true cannot edit or reverse.

Do not browser test or change other files. Main mounts PaymentReverseButton and builds dedicated PlansPage and MemberFinancePage.
