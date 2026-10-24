import { useEffect, useState } from "react";
import { Download, ExternalLink, ShieldCheck, Smartphone, WifiOff } from "lucide-react";
import { publicDownloadUrl, securePortalUrl } from "../lib/public-site";
import QRCode from "qrcode";
import {clearInstallPrompt, getInstallPrompt, subscribeInstallPrompt, type InstallEvent} from "../lib/install";
import "./download.css";

type InstallGuide = "android" | "ios" | "desktop";

function getInstallGuide(): InstallGuide {
  const ua = navigator.userAgent.toLowerCase();
  const ipad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/.test(ua) || ipad) return "ios";
  return /android/.test(ua) ? "android" : "desktop";
}

export default function DownloadPage() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(getInstallPrompt);
  const [guide, setGuide] = useState<InstallGuide | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [qrFailed, setQrFailed] = useState(false);
  const [qr, setQr] = useState("");
  const [installed, setInstalled] = useState(false);
  const base = import.meta.env.BASE_URL;
  const portal = securePortalUrl();
  useEffect(() => {
    document.title = "حمل تطبيق Prime Boxing Academy";
    const meta = document.querySelector('meta[name="description"]');
    meta?.setAttribute("content", "ثبّت تطبيق Prime Boxing Academy على أندرويد وآيفون وآيباد مع الحفاظ على تسجيل الدخول والصلاحيات.");
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    const unsubscribe = subscribeInstallPrompt(() => setPrompt(getInstallPrompt()));
    const after = () => { setInstalled(true); setPrompt(null); setNotice("تم تثبيت التطبيق على هذا الجهاز."); };
    window.addEventListener("appinstalled", after);
    let live = true;
    void QRCode.toDataURL(portal, {width:200,margin:2,errorCorrectionLevel:"M"})
      .then(data => { if(live)setQr(data); }).catch(() => { if(live)setQrFailed(true); });
    return () => { live = false; unsubscribe(); window.removeEventListener("appinstalled", after); };
  }, []);

  async function installApp() {
    const deviceGuide = getInstallGuide();
    setGuide(deviceGuide);
    if (deviceGuide === "ios") {
      setNotice("على آيفون وآيباد، استخدم Safari ثم «مشاركة» ← «إضافة إلى الشاشة الرئيسية».");
      return;
    }
    if (installed) { setNotice("التطبيق يعمل بالفعل في الوضع المستقل."); return; }
    if (!prompt) {
      setNotice(deviceGuide === "android"
        ? "افتح الرابط في Chrome، ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية» من القائمة."
        : "افتح الرابط في Chrome أو Edge، ثم اختر رمز التثبيت في شريط العنوان أو «تثبيت هذه الصفحة كتطبيق» من القائمة.");
      return;
    }
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setNotice(choice.outcome === "accepted" ? "تم قبول طلب التثبيت. انتظر تأكيد المتصفح." : "لم يُثبّت التطبيق؛ يمكنك المحاولة من قائمة المتصفح.");
    } catch { setNotice("لم يتمكن المتصفح من عرض طلب التثبيت. استخدم الخطوات الموضحة أدناه."); }
    finally { clearInstallPrompt(); setBusy(false); }
  }

  return <main className="download-page" dir="rtl">
    <header className="download-brand"><img src={`${base}logo.svg`} width="52" height="52" alt="شعار Prime Boxing Academy"/><div dir="ltr">PRIME BOXING ACADEMY<small dir="rtl">نظام إدارة الأكاديمية</small></div></header>
    <div className="download-layout">
      <section className="download-card">
        <span className="download-badge"><Smartphone size={16}/> تثبيت من المتصفح • PWA</span>
        <h1>حمل تطبيق <span dir="ltr">Prime Boxing Academy</span></h1>
        <p className="download-lead">نفس النظام ونفس حسابك، من الشاشة الرئيسية على الهاتف والآيباد واللابتوب. لا تحتاج حساب متجر لتثبيت نسخة الويب.</p>
        <div className="download-actions">
          <button type="button" data-testid="install-app" disabled={busy} className="download-primary" onClick={() => void installApp()}><Download size={19}/>{busy ? "جارٍ عرض طلب التثبيت…" : "تثبيت التطبيق"}</button>
          <button type="button" data-testid="install-ios" className="download-secondary" onClick={() => { setGuide("ios"); setNotice("على آيفون وآيباد استخدم Safari ثم المشاركة ← إضافة إلى الشاشة الرئيسية."); }}>تثبيت على آيفون وآيباد</button>
        </div>
        {installed && <p className="download-status" role="status">التطبيق مفتوح في الوضع المستقل على هذا الجهاز.</p>}
        <p className="download-notice" role="status" aria-live="polite">{notice}</p>
        {guide && <section className="download-guide" tabIndex={-1} data-testid="install-guide">
          <h2>{guide === "ios" ? "خطوات آيفون وآيباد" : guide === "android" ? "خطوات أندرويد" : "خطوات الكمبيوتر"}</h2>
          <ol>{guide === "ios" ? <>
            <li>افتح الرابط الآمن أدناه مباشرة في Safari، وليس متصفح واتساب أو إنستغرام.</li>
            <li>اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية».</li>
            <li>فعّل «فتح كتطبيق ويب» إذا ظهر، ثم اضغط «إضافة».</li>
          </> : guide === "android" ? <>
            <li>افتح الرابط الآمن أدناه مباشرة في Chrome على أندرويد.</li>
            <li>اضغط زر التثبيت أعلاه إذا عرضه المتصفح، أو افتح القائمة ⋮.</li>
            <li>اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»، ثم أكّد.</li>
          </> : <>
            <li>افتح الرابط الآمن في Chrome أو Edge.</li>
            <li>اضغط رمز التثبيت بجانب شريط العنوان، أو افتح القائمة.</li>
            <li>اختر «تثبيت التطبيق» أو «تثبيت هذه الصفحة كتطبيق» ثم أكّد.</li>
          </>}</ol>
          <p>التثبيت مرتبط بالمتصفح والجهاز. إذا لم يظهر خيار التثبيت، استخدم متصفحًا يدعم تطبيقات الويب التقدمية.</p>
        </section>}
        <div className="download-safe"><ShieldCheck size={23}/><p><strong>حسابك وصلاحياتك كما هي</strong><br/>صفحة التثبيت لا تعرض سجلات النادي. الدخول إلى إدارة النادي والمالية يتطلب الحساب والصلاحية المناسبة.</p></div>
        <div className="download-safe"><WifiOff size={23}/><p><strong>البيانات الحساسة لا تُخزّن للعمل دون اتصال</strong><br/>يلزم الإنترنت لجلب وحفظ بيانات النادي. عند إعادة فتح صفحة دون شبكة تظهر رسالة آمنة فقط.</p></div>
      </section>
      <aside className="download-card download-link-card">
        <h2>الرابط الآمن المنشور</h2>
        <a className="download-url" href={portal} dir="ltr">{portal}</a>
        <a className="download-primary" href={portal}><ExternalLink size={18}/> فتح النظام الآمن</a>
        <p className="download-small">امسح الرمز لفتح النظام على جهازك:</p>
        {qrFailed ? <p role="status">تعذر تحميل الرمز. استخدم الرابط الآمن أعلاه.</p> : qr ? <img className="download-qr" src={qr} width="200" height="200" alt="رمز QR للرابط الآمن للنظام" onError={() => setQrFailed(true)}/> : <p>جارٍ تجهيز الرمز…</p>}
        <p className="download-small">الرابط أعلاه هو رابط النشر، وليس رابط معاينة التطوير. إذا ظهرت كلمة مرور خاصة بالنشر، يجب تغيير إتاحة النشر إلى Public؛ حساب النادي يبقى مطلوبًا.</p>
        <a className="download-text-link" href={publicDownloadUrl()}>رابط صفحة التحميل</a>
        <p className="download-small">هذه الصفحة لتثبيت PWA وليست رابط APK أو TestFlight أو متجر التطبيقات.</p>
      </aside>
    </div>
    <footer className="download-footer">Prime Boxing Academy · للمدراء والموظفين المصرّح لهم فقط</footer>
  </main>;
}
