import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Btn, Confirm, Field, Modal, Num, PageHead, Panel, TextInput, td, th } from '@/components/kit';
import { useStore } from '@/lib/store';
import type { Employee } from '@/lib/domain';

export default function Employees() {
  const { db, me, a, notify } = useStore();
  const [open, setOpen] = useState(false);
  const [u, setU] = useState(''); const [n, setN] = useState(''); const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [del, setDel] = useState<Employee | null>(null);
  const admins = db.employees.filter((e) => e.role === 'admin').length;
  const submit = () => {
    const r = a.addEmployee(u, n, p);
    if (!r.ok) { setErr(r.error); return; }
    setOpen(false); setU(''); setN(''); setP(''); setErr('');
  };
  const why = (e: Employee) => e.id === me?.id ? 'حسابك الحالي' : e.role === 'admin' && admins <= 1 ? 'آخر مدير' : '';
  return (
    <>
      <PageHead title="الموظفين" sub="حسابات تجريبية داخل الجلسة الحالية فقط">
        <Btn v="gold" data-testid="button-add-employee" onClick={() => { setErr(''); setOpen(true); }}><Plus className="h-4 w-4" />إضافة موظف استقبال</Btn>
      </PageHead>
      <Panel className="scroll-x">
        <table className="w-full min-w-[620px]">
          <thead className="border-b border-line"><tr>{['الاسم المعروض', 'اسم المستخدم', 'الدور', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {db.employees.map((e) => (
              <tr key={e.id} data-testid={`row-employee-${e.username}`} className="hover:bg-panel2">
                <td className={td + ' font-medium'}>{e.displayName}</td>
                <td className={td}><Num>{e.username}</Num></td>
                <td className={td}>{e.role === 'admin' ? 'مدير' : 'استقبال'}</td>
                <td className={td}>
                  {why(e) ? <span className="text-xs text-mute">محمي ({why(e)})</span> :
                    <Btn sm v="danger" data-testid={`button-delete-${e.username}`} onClick={() => setDel(e)}><Trash2 className="h-3.5 w-3.5" />حذف</Btn>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Modal open={open} onClose={() => setOpen(false)} title="إضافة موظف استقبال" desc="يستطيع الدخول فوراً خلال هذه الجلسة">
        <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Field label="الاسم المعروض"><TextInput data-testid="input-emp-name" value={n} onChange={(e) => setN(e.target.value)} /></Field>
          <Field label="اسم المستخدم"><TextInput data-testid="input-emp-username" dir="ltr" className="text-end" autoCapitalize="none" value={u} onChange={(e) => setU(e.target.value)} /></Field>
          <Field label="كلمة المرور" hint="6 أحرف على الأقل. بيانات تجريبية فقط."><TextInput data-testid="input-emp-password" type="password" dir="ltr" className="text-end" value={p} onChange={(e) => setP(e.target.value)} /></Field>
          {err && <p role="alert" className="text-sm font-medium text-bad">{err}</p>}
          <div className="flex justify-end gap-2"><Btn onClick={() => setOpen(false)}>إلغاء</Btn><Btn v="gold" type="submit" data-testid="button-save-employee">إضافة</Btn></div>
        </form>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} danger label="تأكيد الحذف" title={`حذف الموظف ${del?.displayName ?? ''}؟`}
        desc={`سيتم حذف حساب ${del?.username ?? ''} ولن يتمكن من تسجيل الدخول بعد ذلك.`}
        onConfirm={() => { if (del) { const r = a.deleteEmployee(del.id); if (!r.ok) notify(r.error, 'warn'); } setDel(null); }} />
    </>
  );
}
