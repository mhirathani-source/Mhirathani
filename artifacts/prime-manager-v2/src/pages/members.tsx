import { useMemo, useState } from 'react';
import { Pencil, Plus, Search } from 'lucide-react';
import { Btn, Empty, Modal, Num, PageHead, Panel, SelectInput, StatusBadge, TextInput, td, th } from '@/components/kit';
import { MemberForm } from '@/components/member-form';
import { PLANS, PLAN_IDS, fmtMoney, statusOf, type Member, type Status } from '@/lib/domain';
import { useStore } from '@/lib/store';

export default function Members() {
  const { db, today } = useStore();
  const [q, setQ] = useState('');
  const [st, setSt] = useState<'all' | Status>('all');
  const [plan, setPlan] = useState('all');
  const [form, setForm] = useState<{ member?: Member } | null>(null);
  const rows = useMemo(() => db.members.filter((m) => {
    const t = q.trim().toLowerCase();
    return (!t || m.name.includes(t) || m.phone.includes(t) || m.code.toLowerCase().includes(t))
      && (st === 'all' || statusOf(m, today) === st) && (plan === 'all' || m.planId === plan);
  }), [db.members, q, st, plan, today]);
  return (
    <>
      <PageHead title="المشتركين" sub={`${rows.length} من ${db.members.length} مشترك`}>
        <Btn v="gold" data-testid="button-add-member" onClick={() => setForm({})}><Plus className="h-4 w-4" />إضافة مشترك</Btn>
      </PageHead>
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" aria-hidden />
          <TextInput data-testid="input-search" aria-label="بحث" className="ps-9" placeholder="بحث بالاسم أو الهاتف أو الكود" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <SelectInput aria-label="الحالة" data-testid="select-status" value={st} onChange={(e) => setSt(e.target.value as 'all' | Status)}>
          <option value="all">كل الحالات</option><option value="active">نشط</option><option value="soon">ينتهي قريباً</option><option value="expired">منتهي</option>
        </SelectInput>
        <SelectInput aria-label="الباقة" data-testid="select-plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="all">كل الباقات</option>{PLAN_IDS.map((p) => <option key={p} value={p}>{PLANS[p].label}</option>)}
        </SelectInput>
      </div>
      <Panel className="scroll-x">
        {rows.length === 0 ? <Empty text="لا يوجد مشتركون مطابقون للبحث" /> : (
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-line"><tr>{['الكود', 'الاسم', 'الهاتف', 'الباقة', 'البدء', 'الانتهاء', 'الحالة', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((m) => (
                <tr key={m.id} data-testid={`row-member-${m.code}`} className="hover:bg-panel2">
                  <td className={td + ' font-bold text-gold'}><Num>{m.code}</Num></td>
                  <td className={td + ' font-medium'}>{m.name}</td>
                  <td className={td}><Num>{m.phone}</Num></td>
                  <td className={td}>{PLANS[m.planId].label} <span className="text-xs text-mute">({fmtMoney(PLANS[m.planId].price)})</span></td>
                  <td className={td}><Num>{m.start}</Num></td>
                  <td className={td}><Num>{m.end}</Num></td>
                  <td className={td}><StatusBadge s={statusOf(m, today)} paused={!!m.pausedOn} /></td>
                  <td className={td}><Btn sm aria-label={`تعديل ${m.name}`} data-testid={`button-edit-${m.code}`} onClick={() => setForm({ member: m })}><Pencil className="h-3.5 w-3.5" />تعديل</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.member ? `تعديل ${form.member.code}` : 'إضافة مشترك جديد'} desc="جميع الحقول مطلوبة. تاريخ الانتهاء يُحسب تلقائياً.">
        {form && <MemberForm key={form.member?.id ?? 'new'} member={form.member} onDone={() => setForm(null)} />}
      </Modal>
    </>
  );
}
