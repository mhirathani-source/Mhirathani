import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getListMembersQueryKey, useListMembers } from "@workspace/api-client-react";
import { useAccess } from "./authz";

type Subscription = {id:number;memberId:number;memberName:string;planId:number;planName:string;startDate:string;endDate:string;status:string};
type Plan = {id:number;name:string;durationDays:number};
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
async function api<T>(path:string,body?:unknown,method = "POST"):Promise<T> {
  const response = await fetch(`${base}/api/club/operations${path}`, {method:body === undefined ? "GET" : method, credentials:"same-origin", headers:{"Content-Type":"application/json"}, ...(body === undefined ? {} : {body:JSON.stringify(body)})});
  const result = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(result.error || "تعذر تنفيذ العملية");
  return result;
}
const statusNames:Record<string,string> = {active:"نشط",paused:"موقوف مؤقتًا",expired:"منتهي",cancelled:"ملغي"};
export function OperationalSubscriptions() {
  const {can} = useAccess(), qc=useQueryClient();
  const [edit,setEdit]=useState<Subscription|null>(null),[open,setOpen]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState(""),[search,setSearch]=useState("");
  const rows=useQuery({queryKey:["operations","subscriptions"],queryFn:()=>api<Subscription[]>("/subscriptions")});
  const plans=useQuery({queryKey:["operations","plans"],queryFn:()=>api<Plan[]>("/plans")});
  const members=useListMembers({limit:100},{query:{queryKey:getListMembersQueryKey({limit:100}),enabled:can("members.view") && can("subscriptions.create")}});
  const mutation=useMutation({mutationFn:({path,body,method}:{path:string;body:unknown;method?:string})=>api(path,body,method),
    onSuccess:()=>{setError("");setMessage("تم حفظ العملية في النظام");setOpen(false);setEdit(null);void qc.invalidateQueries();},
    onError:(e:Error)=>{setMessage("");setError(e.message);}});
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setError("");const form=new FormData(event.currentTarget);
    if(edit) mutation.mutate({path:`/subscriptions/${edit.id}`,method:"PATCH",body:{planId:Number(form.get("planId")),startDate:String(form.get("startDate")),endDate:String(form.get("endDate"))}});
    else mutation.mutate({path:"/subscriptions",body:{memberId:Number(form.get("memberId")),planId:Number(form.get("planId")),startDate:String(form.get("startDate"))}});
  }
  function action(row:Subscription,kind:string) {
    if(kind==="cancel"&&!window.confirm(`إلغاء اشتراك ${row.memberName}؟ ستبقى المدفوعات والديون محفوظة.`))return;
    mutation.mutate({path:`/subscriptions/${row.id}/action`,body:{action:kind}});
  }
  return <div>
    <div className="page-heading"><h1>الاشتراكات والتجديدات</h1>{can("subscriptions.create","members.view")&&<button className="button primary" onClick={()=>{setOpen(true);setEdit(null);}}>اشتراك جديد</button>}</div>
    <p className="notice-panel">واجهة تشغيلية دون أسعار أو ديون أو مدفوعات؛ تظهر البيانات المالية فقط لمن منحه المدير صلاحيتها.</p>
    {message&&<div className="notice-panel" role="status">{message}</div>}{error&&<div className="error-panel" role="alert">{error}</div>}
    {(open||edit)&&<form className="panel form-panel" key={edit?.id??"new"} onSubmit={submit}><h2>{edit?"تعديل الاشتراك":"إضافة اشتراك"}</h2><div className="form-grid">
      {!edit&&<label>المشترك<select name="memberId" required><option value="">اختر المشترك</option>{members.data?.filter(m=>m.active).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
      <label>الباقة<select name="planId" required defaultValue={edit?.planId??""}><option value="">اختر الباقة</option>{plans.data?.map(plan=><option key={plan.id} value={plan.id}>{plan.name} — {plan.durationDays} يومًا</option>)}</select></label>
      <label>تاريخ البداية<input name="startDate" type="date" required defaultValue={edit?.startDate??new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Amman"})}/></label>
      {edit&&<label>تاريخ الانتهاء<input name="endDate" type="date" required defaultValue={edit.endDate}/></label>}
    </div><div className="form-actions"><button className="button primary" disabled={mutation.isPending}>حفظ</button><button className="button ghost" type="button" onClick={()=>{setOpen(false);setEdit(null);}}>إلغاء</button></div></form>}
    <div className="panel table-panel"><div className="table-toolbar"><h2>الاشتراكات</h2><input aria-label="البحث في الاشتراكات" value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالمشترك أو الباقة"/></div>
    {rows.isError||plans.isError?<div className="error-panel">تعذر تحميل الاشتراكات أو الباقات</div>:rows.isLoading?<p>جارٍ التحميل…</p>:!rows.data?.length?<div className="empty-state">لا توجد اشتراكات</div>:
      <div className="table-scroll"><table><thead><tr><th>المشترك</th><th>الباقة</th><th>البداية</th><th>الانتهاء</th><th>الحالة</th><th>العمليات</th></tr></thead><tbody>{rows.data.filter(row=>`${row.memberName} ${row.planName}`.includes(search)).map(row=><tr key={row.id}>
        <td>{row.memberName}</td><td>{row.planName}</td><td>{row.startDate}</td><td>{row.endDate}</td><td>{statusNames[row.status]??row.status}</td><td className="row-actions">
        {can("subscriptions.edit")&&<>{["active","paused"].includes(row.status)&&<button className="mini-button" disabled={mutation.isPending} onClick={()=>{setEdit(row);setOpen(false);}}>تعديل</button>}
        {row.status==="active"&&<button className="mini-button" disabled={mutation.isPending} onClick={()=>action(row,"pause")}>إيقاف مؤقت</button>}
        {row.status==="paused"&&<button className="mini-button" disabled={mutation.isPending} onClick={()=>action(row,"resume")}>استئناف</button>}
        {can("subscriptions.create")&&["active","expired"].includes(row.status)&&<button className="mini-button" disabled={mutation.isPending} onClick={()=>action(row,"renew")}>تجديد</button>}
        {can("subscriptions.delete")&&["active","paused"].includes(row.status)&&<button className="mini-button" disabled={mutation.isPending} onClick={()=>action(row,"cancel")}>إلغاء الاشتراك</button>}</>}</td>
      </tr>)}</tbody></table></div>}</div>
  </div>;
}
