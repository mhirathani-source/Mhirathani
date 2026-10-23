import { Link, useParams } from "wouter";
import { useGetMember } from "@workspace/api-client-react";
import { useAccess } from "./authz";
import { MemberProfileTools, PaymentReverseButton, SubscriptionManager } from "./MembershipPages";
import { MemberReminderTools } from "./MemberReminderTools";

export function MemberFinancePage(){
  const id=Number(useParams<{id:string}>().id),query=useGetMember(id),{can}=useAccess();
  if(query.isLoading)return <div className="loading-panel">جارٍ تحميل ملف المشترك…</div>;
  if(query.isError||!query.data)return <div className="error-panel">تعذر تحميل الملف المالي للمشترك</div>;
  const {member,subscriptions,payments}=query.data;
  return <>
    <div className="page-heading"><h1>{member.name}</h1><Link className="button ghost" href="/members">العودة للمشتركين</Link></div>
    <div className="panel member-summary"><div className="avatar large">{member.name.slice(0,1)}</div><div><h2>{member.name}</h2><p dir="ltr">{member.phone}</p>{member.email&&<p dir="ltr">{member.email}</p>}{member.birthDate&&<p>تاريخ الميلاد: {member.birthDate}</p>}{member.notes&&<p>{member.notes}</p>}<small>تاريخ التسجيل: {member.joinedAt.slice(0,10)}</small></div></div>
    <MemberProfileTools member={member}/>
    {can("plans.view")?<SubscriptionManager memberId={member.id}/>:<div className="panel table-panel"><h2>سجل الاشتراكات</h2><div className="table-scroll"><table><thead><tr><th>الباقة</th><th>البداية</th><th>الانتهاء</th><th>المتبقي JOD</th></tr></thead><tbody>{subscriptions.map(row=><tr key={row.id}><td>{row.planName}</td><td>{row.startDate}</td><td>{row.endDate}</td><td>{(row.balanceFils/1000).toFixed(3)}</td></tr>)}</tbody></table></div></div>}
    <section className="panel table-panel"><div className="table-toolbar"><h2>سجل الدفعات والتصحيحات</h2><small>تبقى الإيصالات الأصلية محفوظة عند العكس</small></div>
      {!payments.length?<div className="empty-state">لا توجد دفعات مسجلة</div>:<div className="table-scroll"><table><thead><tr><th>الإيصال</th><th>التاريخ</th><th>النوع</th><th>المبلغ JOD</th><th>الطريقة</th><th>العمليات</th></tr></thead><tbody>{payments.map(payment=><tr key={payment.id}><td>{payment.receiptNumber}</td><td>{payment.createdAt.slice(0,10)}</td><td>{payment.kind==="payment"?"تحصيل":payment.kind==="refund"?"استرداد / عكس":"خصم"}</td><td>{(payment.amountFils/1000).toFixed(3)}</td><td>{({cash:"نقدي",card:"بطاقة",bank_transfer:"تحويل",wallet:"محفظة"} as Record<string,string>)[payment.method]??payment.method}</td><td className="row-actions">
        {payment.kind==="payment"&&<><Link className="mini-button" href={`/receipt/${payment.id}`}>عرض الإيصال</Link>{payment.reversed?<span className="status-pill muted">عُكست الدفعة</span>:<PaymentReverseButton paymentId={payment.id} receiptNumber={payment.receiptNumber} amountFils={payment.amountFils} onDone={()=>void query.refetch()}/>}</>}
      </td></tr>)}</tbody></table></div>}
    </section>
    <MemberReminderTools memberId={member.id}/>
  </>;
}
