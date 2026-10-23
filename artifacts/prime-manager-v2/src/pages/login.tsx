import { useState } from 'react';
import { useLocation } from 'wouter';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { Btn, Field, TextInput, Wordmark } from '@/components/kit';
import { useStore } from '@/lib/store';

export default function Login() {
  const { a } = useStore();
  const [, nav] = useLocation();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const submit = () => {
    if (!u.trim() || !p) { setErr('أدخل اسم المستخدم وكلمة المرور'); return; }
    const r = a.login(u, p);
    if (!r.ok) { setErr(r.error); setP(''); return; }
    nav('/members');
  };
  return (
    <div className="bg-grid flex min-h-[100dvh] flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="rise w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-2 text-center">
            <Wordmark size="lg" />
            <p className="text-sm text-mute">نظام إدارة النادي - نسخة تجريبية</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate className="space-y-4 rounded-2xl border border-line bg-panel p-6">
            <h1 className="text-xl font-black">تسجيل الدخول</h1>
            {err && (
              <div role="alert" data-testid="text-login-error" className="flex items-center gap-2 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm font-medium text-bad">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />{err}
              </div>
            )}
            <Field label="اسم المستخدم"><TextInput data-testid="input-username" dir="ltr" className="text-end" autoComplete="username" autoCapitalize="none" invalid={!!err} value={u} onChange={(e) => { setU(e.target.value); setErr(''); }} /></Field>
            <Field label="كلمة المرور"><TextInput data-testid="input-password" type="password" dir="ltr" className="text-end" autoComplete="current-password" invalid={!!err} value={p} onChange={(e) => { setP(e.target.value); setErr(''); }} /></Field>
            <Btn v="gold" type="submit" className="w-full" data-testid="button-login">دخول</Btn>
          </form>
          <aside className="mt-4 rounded-2xl border border-gold/30 bg-gold/5 p-4 text-sm" data-testid="panel-demo-credentials">
            <div className="mb-2 flex items-center gap-2 font-bold text-gold"><ShieldCheck className="h-4 w-4" aria-hidden />حسابات تجريبية علنية</div>
            <ul className="space-y-1 text-fg">
              <li className="flex justify-between gap-2"><span>مدير (صلاحيات كاملة)</span><span dir="ltr" className="font-mono">admin / admin123</span></li>
              <li className="flex justify-between gap-2"><span>استقبال (موظف)</span><span dir="ltr" className="font-mono">staff1 / staff123</span></li>
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-mute">هذه بيانات دخول عرض تجريبي معلنة للجميع وليست مصادقة آمنة للإنتاج. البيانات وهمية وتُعاد عند تحديث الصفحة.</p>
          </aside>
        </div>
      </main>
      <footer className="py-5 text-center text-sm text-mute">للمدراء والموظفين فقط</footer>
    </div>
  );
}
