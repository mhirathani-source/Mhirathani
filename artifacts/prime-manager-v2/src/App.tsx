import { useEffect, type ReactNode } from 'react';
import { Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { Shell, Denied } from '@/components/shell';
import { StoreProvider, useStore } from '@/lib/store';
import Login from '@/pages/login';
import Members from '@/pages/members';
import Subscriptions from '@/pages/subscriptions';
import Reminders from '@/pages/reminders';
import Finance from '@/pages/finance';
import Employees from '@/pages/employees';
import Attendance from '@/pages/attendance';

const TITLES: Record<string, string> = {
  '/login': 'تسجيل الدخول', '/members': 'المشتركين', '/subscriptions': 'الاشتراكات', '/reminders': 'التذكيرات',
  '/finance': 'المالية', '/employees': 'الموظفين', '/attendance': 'الحضور',
};

function Guard({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { me } = useStore();
  if (!me) return <Redirect to="/login" />;
  return <Shell>{admin && me.role !== 'admin' ? <Denied /> : children}</Shell>;
}

function Toast() {
  const { toast, dismissToast } = useStore();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      {toast && (
        <button key={toast.id} onClick={dismissToast} data-testid="toast" className={`rise pointer-events-auto max-w-md rounded-xl border px-4 py-3 text-sm font-bold shadow-2xl ${toast.tone === 'warn' ? 'border-bad/50 bg-[#2a1816] text-bad' : 'border-gold/50 bg-panel text-gold'}`}>
          {toast.msg}
        </button>
      )}
    </div>
  );
}

function Routes() {
  const { me } = useStore();
  const [loc] = useLocation();
  useEffect(() => { document.title = `PRIME BOXING ACADEMY | ${TITLES[loc] ?? 'غير موجود'}`; }, [loc]);
  return (
    <Switch>
      <Route path="/login">{me ? <Redirect to="/members" /> : <Login />}</Route>
      <Route path="/"><Redirect to={me ? '/members' : '/login'} /></Route>
      <Route path="/members"><Guard><Members /></Guard></Route>
      <Route path="/subscriptions"><Guard><Subscriptions /></Guard></Route>
      <Route path="/reminders"><Guard><Reminders /></Guard></Route>
      <Route path="/finance"><Guard admin><Finance /></Guard></Route>
      <Route path="/employees"><Guard admin><Employees /></Guard></Route>
      <Route path="/attendance"><Guard><Attendance /></Guard></Route>
      <Route><Redirect to={me ? '/members' : '/login'} /></Route>
    </Switch>
  );
}

function App() {
  return (
    <StoreProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Routes />
      </WouterRouter>
      <Toast />
    </StoreProvider>
  );
}

export default App;
