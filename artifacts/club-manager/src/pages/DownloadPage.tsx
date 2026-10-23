import { useEffect, useState } from "react";
import { Download, ExternalLink, ShieldCheck, Smartphone, WifiOff } from "lucide-react";
import { PUBLIC_DOWNLOAD_URL, securePortalUrl } from "../lib/public-site";
import "./download.css";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function DownloadPage() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [guide, setGuide] = useState<"android" | "ios" | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [qrFailed, setQrFailed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const base = import.meta.env.BASE_URL;
  const portal = securePortalUrl();
  useEffect(() => {
    document.title = "حمل تطبيق Prime Boxing Academy";
    const meta = document.querySelector('meta[name="description"]');
    meta?.setAttribute("content", "ثبّت تطبيق Prime Boxing Academy على أندرويد وآيفون وآيباد مع الحفاظ على تسجيل الدخول والصلاحيات.");
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    const before = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const after = () => { setInstalled(true); setPrompt(null); setNotice("تم تثبيت التطبيق على هذا الجهاز."); };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", after);
    return () => { window.removeEventListener("beforeinstallprompt", before); window.removeEventListener("appinstalled", after); };
  }, []);

  async function androidInstall() {
    setGuide("android");
    if (installed) { setNotice("التطبيق يعمل بالفعل في الوضع المستقل."); return; }
    if (!prompt) { setNotice("إذا لم يظهر خيار التثبيت، افتح الرابط المنشور في Chrome ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»."); return; }
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setNotice(choice.outcome === "accepted" ? "تم قبول طلب التثبيت. انتظر تأكيد المتصفح." : "لم يُثبّت التطبيق؛ يمكنك المحاولة من قائمة المتصفح.");
    } catch { setNotice("لم يتمكن المتصفح من عرض طلب التثبيت. استخدم الخطوات الموضحة أدناه."); }
    finally { setPrompt(null); setBusy(false); }
  }

  return <main className="download-page" dir="rtl">
    <header className="download-brand"><img src={`${base}logo.svg`} width="52" height="52" alt="شعار Prime Boxing Academy"/><div dir="ltr">PRIME BOXING ACADEMY<small dir="rtl">نظام إدارة الأكاديمية</small></div></header>
    <div className="download-layout">
      <section className="download-card">
        <span className="download-badge"><Smartphone size={16}/> تثبيت من المتصفح • PWA</span>
        <h1>حمل تطبيق <span dir="ltr">Prime Boxing Academy</span></h1>
        <p className="download-lead">نفس النظام ونفس حسابك، من الشاشة الرئيسية على الهاتف والآيباد واللابتوب. لا تحتاج حساب متجر لتثبيت نسخة الويب.</p>
        <div className="download-actions">
          <button type="button" data-testid="install-android" disabled={busy} className="download-primary" onClick={() => void androidInstall()}><Download size={19}/>{busy ? "جارٍ عرض الطلب…" : "تثبيت على أندرويد - Install PWA"}</button>
          <button type="button" data-testid="install-ios" className="download-secondary" onClick={() => { setGuide("ios"); setNotice("على آيفون وآيباد استخدم Safari ثم المشاركة ← إضافة إلى الشاشة الرئيسية."); }}>تثبيت على آيفون - Install on iOS</button>
        </div>
        {installed && <p className="download-status" role="status">التطبيق مفتوح في الوضع المستقل على هذا الجهاز.</p>}
        <p className="download-notice" role="status" aria-live="polite">{notice}</p>
        {guide && <section className="download-guide" tabIndex={-1} data-testid="install-guide">
          <h2>{guide === "ios" ? "خطوات آيفون وآيباد" : "خطوات أندرويد"}</h2>
          <ol>{guide === "ios" ? <>
            <li>افتح الرابط الآمن أدناه مباشرة في Safari، وليس متصفح واتساب أو إنستغرام.</li>
            <li>اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية».</li>
            <li>فعّل «فتح كتطبيق ويب» إذا ظهر، ثم اضغط «إضافة».</li>
          </> : <>
            <li>افتح الرابط الآمن أدناه مباشرة في Chrome على أندرويد.</li>
            <li>اضغط زر التثبيت أعلاه إذا عرضه المتصفح، أو افتح القائمة ⋮.</li>
            <li>اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»، ثم أكّد.</li>
          </>}</ol>
          <p>التثبيت مرتبط بالمتصفح والجهاز. وجود زر التثبيت لا يعني أن المتصفح وافق على تثبيت التطبيق.</p>
        </section>}
        <div className="download-safe"><ShieldCheck size={23}/><p><strong>حسابك وصلاحياتك كما هي</strong><br/>صفحة التحميل عامة، لكن الدخول إلى إدارة النادي والمالية يتطلب الحساب والصلاحية المناسبة.</p></div>
        <div className="download-safe"><WifiOff size={23}/><p><strong>البيانات الحساسة لا تُخزّن للعمل دون اتصال</strong><br/>يلزم الإنترنت لجلب وحفظ بيانات النادي. عند إعادة فتح صفحة دون شبكة تظهر رسالة آمنة فقط.</p></div>
      </section>
      <aside className="download-card download-link-card">
        <h2>الرابط الآمن المنشور</h2>
        <a className="download-url" href={portal} dir="ltr">{portal}</a>
        <a className="download-primary" href={portal}><ExternalLink size={18}/> فتح النظام الآمن</a>
        <p className="download-small">امسح الرمز لفتح النظام على جهازك:</p>
        {qrFailed ? <p role="status">تعذر تحميل الرمز. استخدم الرابط الآمن أعلاه.</p> : <img className="download-qr" src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(portal)}`} width="200" height="200" alt="رمز QR للرابط الآمن للنظام" onError={() => setQrFailed(true)}/>}
        <p className="download-small">الرابط أعلاه هو رابط النشر، وليس رابط معاينة التطوير. إذا ظهرت كلمة مرور خاصة بالنشر، يجب تغيير إتاحة النشر إلى Public؛ حساب النادي يبقى مطلوبًا.</p>
        <a className="download-text-link" href={PUBLIC_DOWNLOAD_URL}>رابط صفحة التحميل المنشورة</a>
        <p className="download-small">هذه الصفحة لتثبيت PWA وليست رابط APK أو TestFlight أو متجر التطبيقات.</p>
      </aside>
    </div>
    <footer className="download-footer">Prime Boxing Academy · للمدراء والموظفين المصرّح لهم فقط</footer>
  </main>;
}
