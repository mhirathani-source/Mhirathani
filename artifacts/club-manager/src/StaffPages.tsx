import { Link, useParams } from "wouter";
import { useGetClubOverview, useGetMemberProfile } from "@workspace/api-client-react";
import { MemberProfileTools } from "./MembershipPages";
import { MemberReminderTools } from "./MemberReminderTools";

export function StaffDashboard() {
  const query = useGetClubOverview();
  return <>
    <div className="page-heading"><div><p className="eyebrow">إدارة الأكاديمية</p><h1>لوحة التحكم</h1></div><Link href="/members" className="button primary">إدارة المشتركين</Link></div>
    <p className="notice-panel">تعرض هذه الصفحة ملخصًا تشغيليًا فقط. البيانات المالية تحتاج صلاحية صريحة يمنحها المدير الرئيسي.</p>
    {query.isLoading ? <div className="loading-panel">جارٍ تحميل الملخص…</div> : query.isError ? <div className="error-panel">تعذر تحميل الملخص التشغيلي.</div> : query.data && <div className="stats-grid">
      <div className="panel"><h2>مشتركون نشطون</h2><strong>{query.data.activeMembers}</strong></div>
      <div className="panel"><h2>تنتهي خلال يومين</h2><strong>{query.data.endingSoon}</strong></div>
      <div className="panel"><h2>اشتراكات منتهية</h2><strong>{query.data.expiredSubscriptions}</strong></div>
    </div>}
  </>;
}

export function StaffMemberDetail() {
  const id = Number(useParams<{ id: string }>().id);
  const query = useGetMemberProfile(id);
  if (query.isLoading) return <div className="loading-panel">جارٍ تحميل المشترك…</div>;
  if (query.isError || !query.data) return <div className="error-panel">تعذر تحميل بيانات المشترك.</div>;
  const member = query.data;
  return <>
    <div className="page-heading"><h1>{member.name}</h1><Link href="/members" className="button ghost">العودة للمشتركين</Link></div>
    <div className="panel member-summary"><div className="avatar large">{member.name.slice(0, 1)}</div><div>
      <h2>{member.name}</h2><p dir="ltr">{member.phone}</p>{member.email && <p dir="ltr">{member.email}</p>}
      <small>تاريخ التسجيل: {String(member.joinedAt).slice(0, 10)}</small>
      {member.birthDate && <p>تاريخ الميلاد: {member.birthDate}</p>}{member.notes && <p>{member.notes}</p>}
      <p>{member.active ? "حساب مفعّل" : "حساب مؤرشف"}</p>
    </div></div>
    <MemberProfileTools member={member}/>
    <MemberReminderTools memberId={member.id}/>
    <p className="notice-panel">تفاصيل المدفوعات والإيصالات لا تظهر دون الصلاحية المالية المناسبة.</p>
  </>;
}
