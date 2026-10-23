import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreatePlan, useListPlans, useUpdatePlan, type Plan } from "@workspace/api-client-react";
import { useAccess } from "./authz";

export function PlansPage() {
  const {can}=useAccess(),qc=useQueryClient(),plans=useListPlans(),create=useCreatePlan(),update=useUpdatePlan();
  const [editing,setEditing]=useState<Plan|"new"|null>(null),[error,setError]=useState(""),[message,setMessage]=useState(""),[deleting,setDeleting]=useState(false);
  const busy=create.isPending||update.isPending||deleting;
  const done=()=>{setEditing(null);setError("");setMessage("تم حفظ الباقة في قاعدة البيانات");void qc.invalidateQueries();};
  const failed=(e:unknown)=>setError((e as {data?:{error?:string};message?:string}).data?.error||(e as Error).message||"تعذر حفظ الباقة");
  function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setError("");const f=new FormData(e.currentTarget);
    const data={name:String(f.get("name")).trim(),durationDays:Number(f.get("durationDays")),priceFils:Math.round(Number(f.get("price"))*1000),active:f.get("active")==="on"};
    if(editing==="new")create.mutate({data},{onSuccess:done,onError:failed});
    else if(editing)update.mutate({id:editing.id,data},{onSuccess:done,onError:failed});
  }
  async function remove(plan:Plan) {
    if(!window.confirm(`حذف الباقة «${plan.name}»؟ إذا كانت مرتبطة باشتراكات فستُؤرشف بدل الحذف.`))return;
    setDeleting(true);setError("");
    try{
      const response=await fetch(`${import.meta.env.BASE_URL.replace(/\/$/,"")}/api/plans/${plan.id}`,{method:"DELETE",credentials:"same-origin"});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||"تعذر حذف الباقة");
      setMessage(body.archived?"أُرشفت الباقة مع حفظ تاريخ الاشتراكات":"حُذفت الباقة غير المرتبطة");void qc.invalidateQueries();
    }catch(e){failed(e);}finally{setDeleting(false);}
  }
  const selected=editing&&editing!=="new"?editing:null;
  return <>
    <div className="page-heading"><div><p className="eyebrow">الإعدادات المالية</p><h1>الباقات والأسعار</h1></div>{can("plans.create")&&<button className="button primary" onClick={()=>{setEditing("new");setError("");}}>إضافة باقة</button>}</div>
    {message&&<div className="notice-panel" role="status">{message}</div>}{error&&<div className="error-panel" role="alert">{error}</div>}
    {editing&&<form className="panel form-panel" key={selected?.id??"new"} onSubmit={submit}><h2>{selected?"تعديل الباقة":"إضافة باقة"}</h2><div className="form-grid">
      <label>اسم الباقة<input name="name" required minLength={2} maxLength={100} defaultValue={selected?.name??""}/></label>
      <label>المدة بالأيام<input name="durationDays" type="number" min={1} max={3650} required defaultValue={selected?.durationDays??30}/></label>
      <label>السعر بالدينار الأردني<input name="price" type="number" min={0} max={2_000_000} step="0.001" required defaultValue={(selected?.priceFils??35000)/1000}/></label>
      <label className="checkbox-label"><input name="active" type="checkbox" defaultChecked={selected?.active??true}/> الباقة متاحة للاشتراكات الجديدة</label>
    </div><p className="muted">تعديل سعر الباقة لا يغيّر أسعار الاشتراكات السابقة؛ يمكن تصحيح اشتراك محدد مع حفظ سجل التدقيق.</p><div className="form-actions"><button className="button primary" disabled={busy}>حفظ</button><button type="button" className="button ghost" disabled={busy} onClick={()=>setEditing(null)}>إلغاء</button></div></form>}
    <div className="panel table-panel">{plans.isLoading?<p>جارٍ تحميل الباقات…</p>:plans.isError?<div className="error-panel">تعذر تحميل الباقات</div>:<div className="table-scroll"><table><thead><tr><th>الباقة</th><th>المدة</th><th>السعر JOD</th><th>الحالة</th><th>العمليات</th></tr></thead><tbody>{plans.data?.map(plan=><tr key={plan.id}>
      <td>{plan.name}</td><td>{plan.durationDays} يومًا</td><td>{(plan.priceFils/1000).toFixed(3)}</td><td>{plan.active?"متاحة":"مؤرشفة"}</td><td className="row-actions">{can("plans.edit")&&<button className="mini-button" disabled={busy} onClick={()=>{setEditing(plan);setError("");}}>تعديل</button>}{can("plans.delete")&&<button className="mini-button mship-danger-mini" disabled={busy} onClick={()=>void remove(plan)}>حذف / أرشفة</button>}</td>
    </tr>)}</tbody></table>{!plans.data?.length&&<div className="empty-state">لم تُضف باقات بعد</div>}</div>}</div>
  </>;
}
