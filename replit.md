# Prime Boxing Academy Management System

نظام عربي RTL لإدارة أكاديمية ملاكمة واحدة؛ العملة الدينار الأردني والتوقيت Asia/Amman.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- واجهة الأكاديمية: `artifacts/club-manager/`
- خادم API المشترك: `artifacts/api-server/`
- عقد API: `lib/api-spec/openapi.yaml`
- مخطط PostgreSQL: `lib/db/src/schema/`
- سجل التدقيق: `lib/db/src/schema/auditLog.ts`
- تعليمات التشغيل والإعداد: `README.md` و`docs/ENVIRONMENT.md`

## Architecture decisions

- مصادقة المستخدمين عبر Clerk؛ أدوار التطبيق تُفرض على الخادم ولا يكفي إخفاء الروابط في الواجهة.
- لا تُمنح صلاحية المدير إلا لحساب يطابق `CLUB_ADMIN_EMAIL` بعد تسجيل الدخول الموثق.
- المبالغ المالية تُخزن كأعداد صحيحة بالفلس الأردني؛ لا تستخدم floating point للحسابات المالية.
- قاعدة بيانات التطوير خالية من بيانات الأعضاء التجريبية. الأقسام غير المنفذة يجب أن تبقى موسومة «قيد التطوير».
- لا تُنشر الأكاديمية للعامة قبل ضبط حساب المدير الأول والتحقق من الأمان.

## Product

إدارة المشتركين والباقات والاشتراكات والدفعات والإيصالات، المصاريف والإيرادات والتصنيفات وسجل الصندوق، الموظفين والرواتب الجزئية، وتقارير الفترة متاحة. تبقى المحاسبة المزدوجة، حسابات الموظفين وصلاحياتهم التفصيلية، الرسوم البيانية والنسخ الاحتياطي وWhatsApp Business قيد التطوير.

## User preferences

- الاسم Prime Boxing Academy، والعرض عربي بالكامل باتجاه RTL وبألوان الأسود والأصفر والأبيض.
- لا تُستخدم بيانات تجريبية في الإنتاج، ولا تُعلن ميزة واتساب قبل إعدادها واختبارها.

## Gotchas

- تعرّف البريد الأول للمدير عبر `CLUB_ADMIN_EMAIL` في متغيرات البيئة؛ لا تضع كلمة مرور ثابتة في التطبيق.
- بعد تغيير مخطط Drizzle في التطوير، استخدم `pnpm --filter @workspace/db run push`. اتبع مسار Replit المدعوم لتغييرات الإنتاج.
- قاعدة التطوير أُنشئت عبر `push`، لذلك لا تعِد تشغيل migration الأساس عليها. عند تغييرات المخطط، أنشئ migration عبر الأمر الموثق ثم اتبع مسار Replit لتطبيق مخطط الإنتاج.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
