import "./_group.css";
import { useState } from "react";
import { BadgeCheck, ChartNoAxesCombined, ChevronLeft, ClipboardList, LayoutDashboard, LogOut, Menu, MessageCircle, Settings, ShieldCheck, UserRound, Users, Wallet, X } from "lucide-react";

const items = [
  { href: "/admin", title: "لوحة التحكم والإعدادات", icon: Settings },
  { href: "/dashboard", title: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/members", title: "المشتركون", icon: Users },
  { href: "/subscriptions", title: "الاشتراكات", icon: BadgeCheck },
  { href: "/plans", title: "الباقات", icon: ClipboardList },
  { href: "/finance", title: "المالية والرواتب", icon: Wallet },
  { href: "/settings/whatsapp", title: "واتساب", icon: MessageCircle },
  { href: "/reports", title: "التقارير", icon: ChartNoAxesCombined },
];

export function Luxury() {
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState("/dashboard");
  return (
    <div className="lux-stage" dir="rtl">
      <main className="lux-main">
        <header><button type="button" aria-label="فتح القائمة" onClick={() => setOpen(true)}><Menu size={20} /></button><span>لوحة التحكم</span><small>الأكاديمية • نظرة عامة</small></header>
        <div className="lux-content"><div className="lux-kicker">إدارة الأكاديمية</div><h1>أهلاً بك، مدير الأكاديمية</h1><p>تنظيم واضح لكل ما يجري في النادي.</p><div className="lux-tiles"><i/><i/><i/></div></div>
      </main>
      {open && <button className="lux-scrim" type="button" aria-label="إغلاق القائمة" onClick={() => setOpen(false)} />}
      <aside className={`lux-sidebar ${open ? "is-open" : ""}`} aria-label="القائمة الرئيسية" aria-hidden={!open}>
        <div className="lux-brand-row">
          <a href="/dashboard" className="lux-brand">
            <span className="lux-logo-frame"><img src="/__mockup/images/prime-logo.svg" alt="" /></span>
            <span className="lux-brand-copy"><strong dir="ltr">PRIME BOXING</strong><small dir="ltr">ACADEMY MANAGEMENT</small></span>
          </a>
          <button className="lux-close" type="button" aria-label="إغلاق القائمة" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <div className="lux-section-label"><span>القائمة الرئيسية</span><i /></div>
        <nav className="lux-nav">
          {items.map(({ href, title, icon: Icon }, index) => {
            const selected = active === href;
            return <a key={href} href={href} className={`lux-link ${selected ? "active" : ""}`} aria-current={selected ? "page" : undefined} onClick={event => { event.preventDefault(); setActive(href); setOpen(false); }}>
              <span className="lux-link-icon"><Icon size={18} strokeWidth={1.8} /></span>
              <span className="lux-link-label">{title}</span>
              <span className="lux-link-index">{String(index + 1).padStart(2, "0")}</span>
              {selected && <ChevronLeft className="lux-link-arrow" size={15} />}
            </a>;
          })}
        </nav>
        <div className="lux-footer">
          <div className="lux-account">
            <span className="lux-avatar"><UserRound size={18} /></span>
            <span className="lux-account-copy"><strong>مدير الأكاديمية</strong><small><ShieldCheck size={12} /> حساب المدير</small></span>
            <span className="lux-online" aria-label="متصل" />
          </div>
          <button className="lux-logout" type="button" onClick={() => setOpen(false)}><LogOut size={17} /><span>تسجيل الخروج</span><ChevronLeft size={14} /></button>
          <div className="lux-footer-mark"><span>PRIME</span><i />ACADEMY MANAGEMENT</div>
        </div>
      </aside>
    </div>
  );
}
