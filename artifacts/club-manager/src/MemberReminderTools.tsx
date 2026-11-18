import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccess } from "./authz";

type Log = {
  id: number;
  createdAt: string;
  triggerDays: string;
  status: string;
  error: string | null;
  source: "manual" | "legacy";
};
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

async function request<T>(path: string, method = "GET"): Promise<T> {
  const response = await fetch(`${base}/api${path}`, { method, credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "تعذر تنفيذ الطلب");
  return body;
}

export function MemberReminderTools({ memberId }: { memberId: number }) {
  const { can } = useAccess();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const logs = useQuery({
    queryKey: ["member-reminders", memberId],
    queryFn: () => request<Log[]>(`/members/${memberId}/whatsapp-reminders`),
    enabled: can("whatsapp.view"),
  });
  const openChat = useMutation({
    mutationFn: () => request<{ url: string; message: string }>(`/members/${memberId}/whatsapp-reminder`, "POST"),
    onSuccess: (result) => {
      setMessage(result.message);
      void qc.invalidateQueries({ queryKey: ["member-reminders", memberId] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  if (!can("whatsapp.view") && !can("whatsapp.create")) return null;

  function prepareAndOpenChat() {
    // Open a blank tab synchronously inside the user gesture, then direct it to
    // the server-prepared wa.me link after the authenticated request completes.
    const target = window.open("about:blank", "_blank");
    openChat.mutate(undefined, {
      onSuccess: (result) => {
        if (target && !target.closed) {
          target.opener = null;
          target.location.href = result.url;
        } else {
          window.location.assign(result.url);
        }
      },
      onError: () => target?.close(),
    });
  }

  const statusLabel = (log: Log) => log.source === "legacy"
    ? "سجل قديم"
    : "طلب فتح المحادثة";

  return <section className="panel table-panel">
    <div className="table-toolbar">
      <div>
        <h2>تذكيرات WhatsApp</h2>
        <small>لن تُرسل الرسالة تلقائيًا؛ أرسلها بنفسك داخل التطبيق.</small>
      </div>
      {can("whatsapp.create") && <button className="button primary" disabled={openChat.isPending} onClick={prepareAndOpenChat}>
        {openChat.isPending ? "جارٍ تجهيز الرسالة…" : "فتح WhatsApp برسالة جاهزة"}
      </button>}
    </div>
    {message && <p className={openChat.isError ? "error-panel" : "notice-panel"} role={openChat.isError ? "alert" : "status"}>{message}</p>}
    {can("whatsapp.view") && (logs.isError
      ? <div className="error-panel">تعذر تحميل سجل التذكيرات</div>
      : logs.isLoading
        ? <p>جارٍ تحميل السجل…</p>
        : !logs.data?.length
          ? <div className="empty-state">لا توجد محاولات فتح أو سجلات قديمة.</div>
          : <div className="table-scroll"><table>
            <thead><tr><th>التاريخ</th><th>النوع</th><th>الحالة</th><th>التفاصيل</th></tr></thead>
            <tbody>{logs.data.map(log => <tr key={`${log.source}-${log.id}`}>
              <td>{new Date(log.createdAt).toLocaleString("ar-JO", { timeZone: "Asia/Amman" })}</td>
              <td>{log.source === "manual" ? "يدوي" : log.triggerDays.startsWith("manual:") ? "يدوي سابقًا" : "تذكير سابق"}</td>
              <td>{statusLabel(log)}</td>
              <td>{log.error ?? "لا يوجد تأكيد على الإرسال أو الاستلام."}</td>
            </tr>)}</tbody>
          </table></div>)}
  </section>;
}
