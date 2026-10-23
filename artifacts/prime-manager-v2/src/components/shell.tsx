import { type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { CalendarCheck, Banknote, BellRing, ClipboardList, LogOut, ShieldCheck, Users, UserCog, Info } from 'lucide-react';
import { Btn, Num, Wordmark } from './kit';
import { fmtMoney, statusOf, diffDays } from '@/lib/domain';
import { useStore } from '@/lib/store';

export const TABS = [
  { href: '/members', label: 'المشتركين', icon: Users, admin: false },
  { href: '/subscriptions', label: 'الاشتراكات', icon: ClipboardList, admin: false },
  { href: '/reminders', label: 'التذكيرات', icon: BellRing, admin: false },
  { href: '/finance', label: 'المالية', icon: Banknote, admin: true },
  { href: '/employees', label: 'الموظفين', icon: UserCog, admin: true },
  { href: '/attendance', label: 'الحضور', icon: CalendarCheck, admin: false },
];

function Cards() {
  const { db, me, today } = useStore();
  const active = db.members.filter((m) => !m.pausedOn && statusOf(m, today) !== 'expired').length;
  const week = db.members.filter((m) => !m.pausedOn && m.end >= today && diffDays(m.end, today) <= 7).length;
  const revenue = db.txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const cards = [
    ...(me?.role === 'admin' ? [{ k: 'revenue', label: 'إجمالي الإيرادات', v: fmtMoney(revenue), gold: true }] : []),
    { k: 'active', label: 'اشتراكات نشطة', v: String(active) },
    { k: 'week', label: 'تنتهي هذا الأسبوع', v: String(week) },
    { k: 'total', label: 'إجمالي الأعضاء', v: String(db.members.length) },
  ];
  return (
    <div className={`grid grid-cols-2 gap-3 ${cards.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
      {cards.map((c, i) => (
        <div key={c.k} data-testid={`card-${c.k}`} style={{ animationDelay: `${i * 60}ms` }} className={`rise rounded-2xl border p-4 ${c.gold ? 'border-gold/50 bg-gold/10' : 'border-line bg-panel'}`}>
          <div className="text-xs font-medium text-mute sm:text-sm">{c.label}</div>
          <div className={`mt-2 text-2xl font-black sm:text-3xl ${c.gold ? 'text-gold' : 'text-fg'}`}><Num>{c.v}</Num></div>
        </div>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { me, a } = useStore();
  const [loc, nav] = useLocation();
  const tabs = TABS.filter((t) => !t.admin || me?.role === 'admin');
  return (
    <div className="bg-grid min-h-[100dvh]">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Wordmark />
          <div className="flex items-center gap-3">
            <div className="hidden text-end sm:block">
              <div className="text-sm font-bold" data-testid="text-user">{me?.displayName}</div>
              <div className="text-xs text-gold">{me?.role === 'admin' ? 'مدير' : 'استقبال'}</div>
            </div>
            <Btn sm data-testid="button-logout" onClick={() => { a.logout(); nav('/login'); }}><LogOut className="h-4 w-4" />خروج</Btn>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5">
        <div className="flex items-start gap-2 rounded-xl border border-gold/25 bg-gold/5 px-3 py-2 text-xs text-mute sm:text-sm" data-testid="text-demo-note">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
          <span>نسخة تجريبية ببيانات وهمية. كل شيء محفوظ في ذاكرة الصفحة فقط ويُعاد ضبطه عند التحديث. ليست نظاماً إنتاجياً ولا تقدّم حماية حقيقية للبيانات.</span>
        </div>
        <Cards />
        <nav aria-label="التبويبات" className="scroll-x rounded-xl border border-line bg-panel p-1">
          <ul className="flex min-w-max gap-1">
            {tabs.map((t) => {
              const on = loc === t.href;
              return (
                <li key={t.href}>
                  <Link href={t.href} data-testid={`tab-${t.href.slice(1)}`} aria-current={on ? 'page' : undefined}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${on ? 'bg-gold text-ink' : 'text-mute hover:text-gold'}`}>
                    <t.icon className="h-4 w-4" aria-hidden />{t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main className="min-w-0">{children}</main>
      </div>
      <footer className="mt-8 border-t border-line py-6 text-center text-sm text-mute">
        <div className="flex items-center justify-center gap-2"><ShieldCheck className="h-4 w-4 text-gold" aria-hidden />للمدراء والموظفين فقط</div>
      </footer>
    </div>
  );
}

export function Denied() {
  return (
    <div className="rounded-2xl border border-bad/30 bg-bad/5 px-4 py-14 text-center" role="alert" data-testid="text-access-denied">
      <h2 className="text-xl font-black text-bad">غير مصرح بالدخول</h2>
      <p className="mt-2 text-sm text-mute">هذه الصفحة متاحة للمدراء فقط. حسابك لا يملك صلاحية عرضها.</p>
    </div>
  );
}
