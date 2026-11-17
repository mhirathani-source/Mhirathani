# تثبيت Prime Boxing Academy على الهاتف

هذا العمل داخل النظام الرئيسي الحالي `artifacts/club-manager`؛ لا ينقل قاعدة البيانات ولا يغيّر المصادقة أو صلاحيات المالية ولا يعدّل نسخة v2.

## الروابط

النطاق التالي مأخوذ من بيانات النشر الفعلية في Replit، وليس نطاقًا مفترضًا:

- النظام/PWA: https://Prime1academy.replit.app/
- صفحة التثبيت بعد نشر التغييرات: https://Prime1academy.replit.app/download
- المسار البديل داخل الموقع: `/app`

عند تجهيز هذه التغييرات كان النشر القائم محميًا بكلمة مرور على مستوى Replit. وافق المالك على إتاحة التحميل للعامة مع إبقاء تسجيل دخول النادي محميًا. **تغييرات مساحة العمل لا تعدّل النشر القائم تلقائيًا.** يجب إعادة النشر بإتاحة Public قبل اعتبار صفحة التثبيت عامة ومحدّثة.

في Publishing غيّر الإتاحة إلى Public وأعد النشر. بحسب إعدادات Replit قد يتطلب تغيير إتاحة نشر قائم إلغاء نشره أولًا ثم اختيار Public وإعادة النشر؛ يعني ذلك توقفًا مؤقتًا للرابط. لا تُزل Clerk ولا صلاحيات الخادم، ولا تعدّل البيانات أو الأسرار لهذا الغرض.

## نسخة PWA

- أندرويد: افتح الرابط المنشور في Chrome، ثم «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». إذا عرض المتصفح طلب التثبيت، يستخدمه زر صفحة التحميل.
- آيفون/آيباد: افتح الرابط في Safari، ثم المشاركة ← إضافة إلى الشاشة الرئيسية ← إضافة. ليس هناك تثبيت صامت أو تلقائي على iOS.
- اللابتوب: استخدم أمر التثبيت في المتصفح إذا أتاحه.
- QR يرسل الرابط العام فقط إلى خدمة qrserver؛ لا يتضمن معلومات مستخدمين أو مفاتيح.
- لا يوجد ملف APK أو TestFlight خلف أزرار صفحة PWA.

الـmanifest يحدد الاسم والاختصار، RTL عربي، الوضع standalone، اللون `#FACC15` والخلفية `#FFFFFF`. أيقونات 192 و512 وApple 180 مشتقة من الشعار الموجود. عدّل الشعار ثم شغّل `pnpm --filter @workspace/club-manager run icons` لإعادة توليدها.

### العمل دون اتصال

الـservice worker يسجل في بناء الإنتاج فقط. يخزّن الأيقونات والملفات العامة وكود الواجهة؛ لا يخزّن HTML للجلسات ولا API ولا الردود المالية ولا بيانات المشتركين أو Clerk. لا توجد قائمة عمليات مالية مؤجلة دون اتصال. فتح صفحة رئيسية أثناء انقطاع الشبكة يعرض رسالة عامة آمنة بدل السجلات.

الطلبات الخاصة بـv2 والتطبيقات الأخرى تمرّ للشبكة دون معالجة من هذا العامل. لا يُفرض تحديث على نموذج مالي مفتوح. عند تعديل العامل بعد نشره، غيّر نسخة الذاكرة المؤقتة وأغلق النوافذ القديمة لاعتماد التحديث.

## مشروعا Capacitor

- `appId`: `com.primeboxingacademy.app`
- `appName`: `Prime Boxing Academy`
- المجلد الفعلي الذي ينتجه Vite: `dist/public`، وليس `dist` وحده.
- Android: `artifacts/club-manager/android`
- iOS: `artifacts/club-manager/ios`، باستخدام Swift Package Manager.
- مدة شاشة البداية: 2000ms.

**نسختا Android وiOS الحاليتان:** تفتحان موقع Production نفسه داخل Capacitor WebView بملء مساحة التطبيق ودون شريط متصفح. `server.url` يحدد أصل HTTPS فقط؛ واجهات النظام وClerk والـ API تبقى على الموقع المنشور نفسه. لا تُنسخ قاعدة البيانات أو مفاتيح المصادقة إلى التطبيق ولا تنشأ قاعدة جديدة. يتطلب الاستخدام اتصالًا بالإنترنت، كما أن بوابة كلمة مرور Replit الحالية قد تظهر قبل شاشة دخول النادي إلى أن يصبح النشر عامًا.

يستخدم Android `adjustResize` لظهور لوحة المفاتيح دون تغطية الحقول. يستخدم iOS لوحة المفاتيح وسجل الرجوع الأصليين في WKWebView. يتطلب التحقق النهائي من تسجيل الدخول والتنقل اختبارًا على أجهزة فعلية؛ لا تتوفر جلسة دخول أو أجهزة في المعاينة.

### التحضير والتزامن

من جذر المشروع:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/club-manager run icons
pnpm --filter @workspace/club-manager run native:sync
```

أمر `native:sync` يبني ملفات الويب بالمسار `/` ثم ينفّذ `cap sync`. أُنشئ المشروعان بـ`cap add android` و`cap add ios --packagemanager SPM`، وتم التزامن فعليًا.

### Android: APK وAAB

على جهاز تطوير مجهز بـJDK 21 وAndroid Studio وAndroid SDK 36، اضبط `ANDROID_HOME` أو ملف `android/local.properties` محليًا ثم:

```bash
cd artifacts/club-manager
pnpm run native:sync
cd android
./gradlew assembleDebug
./gradlew bundleRelease
```

- APK اختباري: `app/build/outputs/apk/debug/app-debug.apk`.
- AAB: `app/build/outputs/bundle/release/app-release.aab`.
- `bundleRelease` وحده **لا يضمن حزمة موقّعة**. جهّز توقيع الإصدار في Android Studio ومفتاح رفع آمن قبل Google Play، واختبر التثبيت أولًا.
- لا تحفظ keystore أو كلمات مروره في Git أو المحادثة. ملفات المفاتيح ومخرجات البناء مستبعدة من التتبع.

### iOS

على macOS مزوّد بـXcode المتوافق مع Capacitor 8:

- مشروع Xcode مزامَن مع عنوان Production الحالي.
- Bundle ID: `com.primeboxingacademy.app`، الإصدار `1.1`، رقم البناء `2`.
- الأيقونة وشاشة البداية مأخوذتان من هوية الأكاديمية الحالية.
- إنشاء IPA موقّع غير متاح في بيئة Linux الحالية؛ يلزم Mac وXcode وفريق Apple Developer للاعتماد والتوقيع.

```bash
cd artifacts/club-manager
pnpm run native:sync
pnpm exec cap open ios
# المكافئ إذا كنت تستخدم npx محليًا: npx cap open ios
```

في Xcode اختر فريق Apple Developer، واضبط Signing & Capabilities، وحافظ على bundle identifier أعلاه، ثم اختبر على جهاز فعلي. أنشئ Archive ووزّعه عبر TestFlight أو App Store بعد التوقيع والمراجعة. لا يوجد رابط IPA عام أو TestFlight قبل إنشاء إصدار موقّع.

### APK الاختباري

مخرجات Android مستبعدة من Git والنشر. بناء Debug يستخدم مفتاح Android الاختباري المحلي، وهو قابل للتثبيت للاختبار لكنه ليس توقيع Release مملوكًا للأكاديمية أو صالحًا كتحديث إنتاجي في Google Play. لا تحفظ keystore أو كلمات مروره في Git أو المحادثة.

ملف APK الحالي: `generated-artifacts/android/Prime-Boxing-Academy-1.1-debug.apk`. الحزمة `com.primeboxingacademy.app`، الإصدار `1.1`، ونجح التحقق من توقيع APK v2. لم يتصل جهاز Android أو محاكي أثناء الاختبار، لذا يلزم اختبار تسجيل الدخول والرجوع على هاتف فعلي قبل توزيع واسع.

لإعادة البناء في هذه البيئة بعد تجهيز SDK:

```bash
export ANDROID_HOME="$PWD/.cache/android-sdk"
pnpm --filter @workspace/club-manager run native:sync
cd artifacts/club-manager/android
./gradlew assembleDebug --no-daemon --max-workers=2
```

احتفظ بـSDK ومخرجات البناء خارج Git وصورة نشر الويب. لم يُنتج AAB موقّع للإنتاج أو IPA، ولا يتوفر Xcode في Linux.

## HTTPS والأمان

- الرابط المنشور وQR وفتح البوابة تستخدم HTTPS فقط.
- Android يحدد `android:usesCleartextTraffic="false"` ويطبق `network_security_config.xml` مع `cleartextTrafficPermitted="false"`. النسخ الاحتياطي للنظام المحلي معطّل.
- iOS يحدد `NSAllowsArbitraryLoads=false` و`NSAllowsArbitraryLoadsInWebContent=false`، دون استثناءات HTTP.
- Android يستخدم `androidScheme: "https"`. **iOS لا يدعم `iosScheme: "https"`** وفق Capacitor/WKWebView؛ يستخدم `capacitor` للمحتوى المحلي. هذا بروتوكول ملفات محلي، وليس اتصال HTTP غير مشفّر.
- `server.url` يوجّه Android إلى عنوان Production الحالي عبر HTTPS؛ لا توجد استثناءات لتنقل HTTP غير المشفر.
- بقيت جميع صلاحيات المالية على الخادم كما هي. صفحة التثبيت عامة فقط؛ لا تمنح دور مدير أو موظف.
- عند تغيير النطاق المنشور حدّث `src/lib/public-site.ts` بعد التحقق من رابط النشر، وأعد بناء الويب ومزامنة المشروعين الأصليين.

## الفحص والصيانة

```bash
pnpm --filter @workspace/club-manager run typecheck
pnpm --filter @workspace/scripts exec tsx --test ../artifacts/club-manager/tools/pwa.test.ts
```

الاختبارات تتحقق من manifest ومقاسات PNG، ومنع تخزين API والجلسات والبيانات المالية، وصفحة الانقطاع، وإعدادات منع cleartext. الاختبار على المتصفح لا يثبت تثبيتًا فعليًا على iOS أو نجاح توقيع حزم المتجر.
