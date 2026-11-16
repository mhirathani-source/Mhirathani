import "./_group.css";
import { BadgeCheck, ChartNoAxesCombined, ClipboardList, LayoutDashboard, LogOut, MessageCircle, PanelLeftClose, Settings, UserRound, Users, Wallet } from "lucide-react";

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

export function Current() {
  return (
    <div className="prime-sidebar-preview" dir="rtl">
      <aside className="sidebar" aria-label="القائمة الرئيسية">
        <a href="/dashboard" className="brand">
          <img className="brand-mark-image" src="/__mockup/images/prime-logo.svg" alt="شعار Prime Boxing Academy" />
          <span className="brand-copy">
            Prime Boxing Academy
            <small>إدارة الأكاديمية</small>
          </span>
        </a>
        <p className="nav-label">القائمة الرئيسية</p>
        <nav>
          {items.map(({ href, title, icon: Icon }) => (
            <a key={href} href={href} aria-current={href === "/dashboard" ? "page" : undefined} className={`nav-link ${href === "/dashboard" ? "active" : ""}`}>
              <Icon size={18} /><span>{title}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">م</div>
            <div><strong>مدير الأكاديمية</strong><small>حساب الإدارة</small></div>
          </div>
          <a className="nav-link" href="/account"><UserRound size={18} /><span>إعدادات حسابي</span></a>
          <button className="nav-link sidebar-toggle" type="button"><PanelLeftClose size={18} /><span>طي القائمة</span></button>
          <button className="nav-link logout" type="button"><LogOut size={18} /><span>تسجيل الخروج</span></button>
        </div>
      </aside>
    </div>
  );
}
