import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccess } from "./authz";
import { buildWhatsAppChatUrl, buildWhatsAppReminderMessage } from "./whatsappLink";

type Log={id:number;createdAt:string;triggerDays:string;status:string;error:string|null};
const base=import.meta.env.BASE_URL.replace(/\/$/,"");
async function request<T>(path:string):Promise<T>{
  const response=await fetch(`${base}/api${path}`,{credentials:"same-origin"});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||"تعذر تنفيذ التذكير");
  return body;
}
export function MemberReminderTools({memberId,memberName,phone}:{memberId:number;memberName:string;phone:string}){
  const {can}=useAccess(),[message,setMessage]=useState("");
  const logs=useQuery({queryKey:["member-reminders",memberId],queryFn:()=>request<Log[]>(`/members/${memberId}/whatsapp-reminders`),enabled:can("whatsapp.view")});
  const chatUrl=buildWhatsAppChatUrl(phone,buildWhatsAppReminderMessage(memberName));
  if(!can("whatsapp.view")&&!can("whatsapp.create"))return null;
  return <section className="panel table-panel"><div className="table-toolbar"><h2>تذكيرات واتساب العادي</h2>{can("whatsapp.create")&&(chatUrl?<a className="button primary" href={chatUrl} target="_blank" rel="noopener noreferrer" onClick={()=>setMessage("فُتحت محادثة برسالة جاهزة. اضغط إرسال داخل واتساب لإرسالها.")}>فتح واتساب وإعداد التذكير</a>:<button className="button primary" disabled>رقم الهاتف غير صالح لواتساب</button>)}</div>
    {can("whatsapp.create")&&<p className="muted">تُفتح محادثة برسالة جاهزة؛ الإرسال يتم يدويًا من واتساب ولا يتوفر تأكيد تسليم داخل النظام.</p>}
    {message&&<p className="notice-panel" role="status">{message}</p>}
    {can("whatsapp.view")&&(logs.isError?<div className="error-panel">تعذر تحميل سجل التذكيرات</div>:logs.isLoading?<p>جارٍ التحميل…</p>:!logs.data?.length?<div className="empty-state">لا توجد تذكيرات مسجلة</div>:<div className="table-scroll"><table><thead><tr><th>التاريخ</th><th>الموعد</th><th>الحالة</th><th>التفاصيل</th></tr></thead><tbody>{logs.data.map(log=><tr key={log.id}><td>{new Date(log.createdAt).toLocaleString("ar-JO",{timeZone:"Asia/Amman"})}</td><td>{log.triggerDays.startsWith("manual:")?"يدوي":log.triggerDays==="0"?"يوم الانتهاء":`قبل الانتهاء بـ${log.triggerDays} يوم`}</td><td>{log.status==="accepted"?"قبلتها Meta سابقًا":log.status==="failed"?"فشل سابقًا":log.status==="queued"?"قيد المعالجة سابقًا":log.status}</td><td>{log.error??"سجل سابق؛ لا يؤكد وصول الرسالة."}</td></tr>)}</tbody></table></div>)}
  </section>;
}
