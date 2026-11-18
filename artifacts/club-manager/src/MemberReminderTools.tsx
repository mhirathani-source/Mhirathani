import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccess } from "./authz";

type Log={id:number;createdAt:string;triggerDays:string;status:string;error:string|null};
const base=import.meta.env.BASE_URL.replace(/\/$/,"");
async function request<T>(path:string,method="GET"):Promise<T>{
  const response=await fetch(`${base}/api${path}`,{method,credentials:"same-origin"});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||"تعذر تنفيذ التذكير");
  return body;
}
export function MemberReminderTools({memberId}:{memberId:number}){
  const {can}=useAccess(),qc=useQueryClient(),[message,setMessage]=useState("");
  const logs=useQuery({queryKey:["member-reminders",memberId],queryFn:()=>request<Log[]>(`/members/${memberId}/whatsapp-reminders`),enabled:can("whatsapp.view")});
  const send=useMutation({mutationFn:()=>request<{message:string}>(`/members/${memberId}/whatsapp-reminder`,"POST"),onSuccess:r=>{setMessage(r.message);void qc.invalidateQueries({queryKey:["member-reminders",memberId]});},onError:(e:Error)=>setMessage(e.message)});
  if(!can("whatsapp.view")&&!can("whatsapp.create"))return null;
  return <section className="panel table-panel"><div className="table-toolbar"><h2>تذكيرات واتساب</h2>{can("whatsapp.create")&&<button className="button primary" disabled={send.isPending} onClick={()=>send.mutate()}>{send.isPending?"جارٍ التحقق والإرسال…":"إرسال تذكير واتساب"}</button>}</div>
    {message&&<p className={send.isError?"error-panel":"notice-panel"} role={send.isError?"alert":"status"}>{message}</p>}
    {can("whatsapp.view")&&(logs.isError?<div className="error-panel">تعذر تحميل سجل التذكيرات</div>:logs.isLoading?<p>جارٍ التحميل…</p>:!logs.data?.length?<div className="empty-state">لا توجد تذكيرات مسجلة</div>:<div className="table-scroll"><table><thead><tr><th>التاريخ</th><th>الموعد</th><th>الحالة</th><th>التفاصيل</th></tr></thead><tbody>{logs.data.map(log=><tr key={log.id}><td>{new Date(log.createdAt).toLocaleString("ar-JO",{timeZone:"Asia/Amman"})}</td><td>{log.triggerDays.startsWith("manual:")?"يدوي":log.triggerDays==="0"?"يوم الانتهاء":`قبل الانتهاء بـ${log.triggerDays} يوم`}</td><td>{log.status==="accepted"?"قبلتها Meta":log.status==="failed"?"فشل":log.status==="queued"?"قيد المعالجة":log.status}</td><td>{log.error??"قبول الطلب لا يؤكد تسليم الرسالة"}</td></tr>)}</tbody></table></div>)}
  </section>;
}
