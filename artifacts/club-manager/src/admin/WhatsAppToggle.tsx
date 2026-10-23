import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";

type Status={enabled:boolean;configured:boolean};
const path=`${import.meta.env.BASE_URL}api/club/admin/whatsapp-reminders`;
async function request(enabled?:boolean):Promise<Status>{
  const response=await fetch(path,{credentials:"same-origin",...(enabled===undefined?{}:{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled})})});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||"تعذر حفظ إعداد واتساب");
  return data;
}
export default function WhatsAppToggle(){
  const client=useQueryClient();
  const status=useQuery({queryKey:["admin","whatsapp-reminders"],queryFn:()=>request()});
  const update=useMutation({mutationFn:(enabled:boolean)=>request(enabled),onSuccess:data=>client.setQueryData(["admin","whatsapp-reminders"],data)});
  return <section className="panel">
    <h2>تذكيرات واتساب</h2>
    <label className="checkbox-label"><input type="checkbox" role="switch" aria-label="Enable WhatsApp Reminders" checked={status.data?.enabled??false} disabled={status.isPending||status.isError||update.isPending} onChange={e=>update.mutate(e.target.checked)}/>
      تفعيل تذكيرات واتساب — <b dir="ltr">{status.data?.enabled?"ON":"OFF"}</b>
    </label>
    <p className="muted">معطلة افتراضيًا. جهّز قوالب Meta العربية المعتمدة وأضف META_WHATSAPP_TOKEN وMETA_PHONE_NUMBER_ID في Secrets لاحقًا؛ عدم وجودهما لا يمنع تشغيل التطبيق أو بناءه.</p>
    <p className="muted">تشمل التذكيرات يومين قبل الانتهاء، ويوم الانتهاء، والاشتراك المنتهي الذي لم يُجدّد. لا يُرسل تذكير تلقائي مكرر للاشتراك نفسه.</p>
    {!status.isPending&&<p>{status.data?.configured?"إعدادات الربط موجودة؛ قبول Meta لا يعني تأكيد التسليم.":"بيانات الربط غير مكتملة، والإرسال غير جاهز."}</p>}
    {(status.error||update.error)&&<p className="error-text" role="alert">{(status.error||update.error)?.message}</p>}
  </section>;
}
