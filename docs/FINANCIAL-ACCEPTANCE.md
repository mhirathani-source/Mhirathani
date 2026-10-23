# Follow-up: one member financial correction journey

Use SAME testing session and existing owner from onboarding test. DEV ONLY, no production, no real member or money modification. Clerk programmatic sign-in/claims override.

1. Capture baseline GET `/api/finance/cash` and today's `/api/finance/reports?period=day&date=<Jordan today>`.
2. Owner /members: create unique `اختبار إدارة <unique>` with unused valid Jordan phone `079` + seven unique digits. Edit name/notes, verify persisted after reload. Delete this UNLINKED fixture using UI confirmation, verify DB row removed.
3. Create another uniquely named fixture member. Owner /plans: create unique 30-day plan for 35 JOD, edit duration/name, verify persisted; use only this fixture plan.
4. Owner /subscriptions: create subscription for fixture member, start today, plan35 JOD, initial payment20 JOD (enabled method: cash). Verify database price35000, paid20000, balance15000 and receipt exists.
5. Edit subscription via UI: price40 JOD and extend end date one day. Verify DB + UI balance20000.
6. Owner member detail `/members/<fixture-id>`: use `عكس / تصحيح الدفعة` PaymentReverseButton, confirmation/reason. Verify original20000 payment still exists plus refund20000 and audit payment.reversed; debt40000; cash returns to baseline (no doubled mirrors). Duplicate POST `/api/payments/<original-id>/reverse` with reason must409. Original receipt still readable. Log out/programmatic sign-in same owner and verify corrected state remains.
7. Try deleting linked fixture member. Must not lose history;409 canArchive or UI archive. Archive and confirm active=false with original subscription/payment history retained.
8. Same correction journey: owner Finance creates unique fixture expense7 JOD cash dated today, reverses via UI with reason. Verify source retains amount7000,reversed=true, counter has kindexpense,amountFils=-7000,reversalOfId=sourceID. No fake income. Report/cash deltas return to baseline. Repeated reverse409, source PATCH409.
9. Optional safe checks on same owner page: /admin backups create/download/preview succeeds, wrong confirmation400; do NOT execute live restore (main already tested actual restore in a rolled-back DB transaction). Reports CSV export actual text/csv. Custom role CRUD allowed only owner, assigned-role delete409.

Follow existing UI source selectors. Do not call WhatsApp. Preserve ALL preexisting records. Test-fixture linked business history can remain archived in DEVELOPMENT, explicitly report fixture IDs, or clean ONLY test-created rows by exact recorded IDs in safe dependency order, never broad name-prefix deletion. Do not alter the real owner's login, role, grants, or status.

Important source endpoints: POST /api/subscriptions, PATCH /api/subscriptions/:id, POST /api/payments/:id/reverse, POST /api/finance/transactions/:id/reverse. Cash GET `/api/finance/cash` response balanceFils/movements. Member full response subscriptions/payments. Correction button is mounted in MemberFinancePage.tsx, plan CRUD in PlansPage.tsx, finance corrections in FinancePages.tsx. Record failures precisely and include a screenshot of the corrected member detail.
