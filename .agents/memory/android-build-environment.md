---
name: Android build environment
description: Replit package-index limitation encountered when preparing the Android SDK
---

لا تفترض أن جميع سمات Nixpkgs متاحة عبر أداة تثبيت حزم النظام. رفض الفهرس السمة `androidenv.androidPkgs.androidsdk` في هذه البيئة، بينما أمكن تجهيز SDK من أدوات Google الرسمية والبناء بنجاح.

**Why:** تكرار محاولة تثبيت السمة نفسها لا يجهز SDK، رغم توفر Java وأدوات Android الأخرى.

**How to apply:** تحقق أولًا من الأدوات الموجودة ومن توفر الحزمة في الفهرس. عند استمرار هذا القيد، استخدم أدوات Google الرسمية، وأبقِ SDK ومخرجات APK خارج Git وصورة نشر الويب. لا تعتبر غياب السمة دليلًا على استحالة بناء APK هنا.
