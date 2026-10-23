import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Btn, Empty, Field, Modal, Num, PageHead, Panel, SelectInput, TextInput, td, th } from '@/components/kit';
import { fmtMoney, parseJd } from '@/lib/domain';
import { useStore } from '@/lib/store';

const SRC = { seed: 'تجريبي', 'demo-subscription': 'اشتراك تجريبي', manual: 'يدوي' } as const;

export default function Finance() {
  const { db, today, a } = useStore();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amt, setAmt] = useState('');
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(today);
  const [err, setErr] = useState('');
  const income = db.txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = db.txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const rows = [...db.txs].sort((x, y) => (y.date.localeCompare(x.date)));
  const submit = () => {
    const n = parseJd(amt);
    if (n === null) { setErr('أدخل مبلغاً صحيحاً (حتى 3 خانات عشرية)'); return; }
    const r = a.addTx(type, n, label, date);
    if (!r.ok) { setErr(r.error); return; }
    setOpen(false); setAmt(''); setLabel(''); setErr('');
  };
  const sum = [['الإيرادات', income, 'text-good'], ['المصروفات', expense, 'text-bad'], ['الصافي', income - expense, 'text-gold']] as const;
  return (
    <>
      <PageHead title="المالية" sub="الإيرادات تشمل إيصالات الاشتراكات التجريبية وتطابق بطاقة الإيرادات">
        <Btn v="gold" data-testid="button-add-tx" onClick={() => { setErr(''); setOpen(true); }}><Plus className="h-4 w-4" />إضافة حركة</Btn>
      </PageHead>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {sum.map(([l, v, c]) => (
          <div key={l} data-testid={`text-fin-${l}`} className="rounded-2xl border border-line bg-panel p-4">
            <div className="text-sm text-mute">{l}</div><div className={`mt-1 text-2xl font-black ${c}`}><Num>{fmtMoney(v)}</Num></div>
          </div>
        ))}
      </div>
      <Panel className="scroll-x">
        {rows.length === 0 ? <Empty text="لا توجد حركات مالية" /> : (
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-line"><tr>{['التاريخ', 'البيان', 'المصدر', 'النوع', 'المبلغ'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((t) => (
                <tr key={t.id} data-testid={`row-tx-${t.id}`} className="hover:bg-panel2">
                  <td className={td}><Num>{t.date}</Num></td><td className={td + ' whitespace-normal'}>{t.label}</td>
                  <td className={td + ' text-mute'}>{SRC[t.source]}</td>
                  <td className={td}>{t.type === 'income' ? 'إيراد' : 'مصروف'}</td>
                  <td className={td + ` font-bold ${t.type === 'income' ? 'text-good' : 'text-bad'}`}><Num>{t.type === 'income' ? '+' : '-'}{fmtMoney(t.amount)}</Num></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <Modal open={open} onClose={() => setOpen(false)} title="إضافة حركة مالية" desc="تُضاف إلى السجل المحلي التجريبي فقط">
        <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Field label="النوع"><SelectInput data-testid="select-tx-type" value={type} onChange={(e) => setType(e.target.value as 'income' | 'expense')}><option value="income">إيراد</option><option value="expense">مصروف</option></SelectInput></Field>
          <Field label="المبلغ (دينار)"><TextInput data-testid="input-tx-amount" dir="ltr" inputMode="decimal" className="text-end" value={amt} onChange={(e) => setAmt(e.target.value)} /></Field>
          <Field label="البيان"><TextInput data-testid="input-tx-label" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
          <Field label="التاريخ"><TextInput type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          {err && <p role="alert" className="text-sm font-medium text-bad">{err}</p>}
          <div className="flex justify-end gap-2"><Btn onClick={() => setOpen(false)}>إلغاء</Btn><Btn v="gold" type="submit" data-testid="button-save-tx">حفظ</Btn></div>
        </form>
      </Modal>
    </>
  );
}
