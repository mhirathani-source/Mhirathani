import { useState } from "react";
import { Browser } from "@capacitor/browser";
import { securePortalUrl } from "../lib/public-site";
import "./download.css";

export default function NativePortal() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true); setError("");
    try { await Browser.open({ url: securePortalUrl(), toolbarColor: "#FACC15", presentationStyle: "fullscreen" }); }
    catch { setError("تعذر فتح المتصفح الآمن. تأكد من اتصالك بالإنترنت وحاول مجددًا."); }
    finally { setBusy(false); }
  }
  return <main className="download-page" dir="rtl">
    <div className="download-brand"><img src={`${import.meta.env.BASE_URL}logo.svg`} width="64" height="64" alt="شعار الأكاديمية"/><div dir="ltr">PRIME BOXING ACADEMY</div></div>
    <section className="download-card" style={{ maxWidth: 520, margin: "40px auto" }}>
      <span className="download-badge">بوابة النظام الآمن</span><h1>إدارة الأكاديمية</h1>
      <p className="download-lead">افتح النظام المنشور وسجّل الدخول بحسابك الحالي. تظل البيانات والصلاحيات في الخادم؛ هذه البوابة لا تخزّن سجلات النادي على الجهاز.</p>
      <button className="download-primary" disabled={busy} onClick={() => void open()}>{busy ? "جارٍ الفتح…" : "فتح النظام عبر المتصفح الآمن"}</button>
      <p className="download-small">يُفتح النظام في المتصفح الآمن للجهاز، وليس داخل واجهة WebView لمصادقة غير مهيّأة. يلزم اتصال بالإنترنت.</p>
      <p className="download-notice" role="alert">{error}</p>
    </section>
  </main>;
}
