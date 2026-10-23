import { useState } from 'react';
import { History, Pause, Play, RefreshCw, SquarePen } from 'lucide-react';
import { Btn, Empty, Field, Modal, Num, PageHead, Panel, SelectInput, StatusBadge, TextInput, td, th } from '@/components/kit';
import { PLANS, PLAN_IDS, endFor, fmtMoney, maxDate, addDays, isValidDate, statusOf, type Member, type PlanId } from '@/lib/domain';
import { useStore } from '@/lib/store';

const KIND = { new: 'اشتراك جديد', renew: 'تجديد', edit: 'تعديل', pause: 'إيقاف مؤقت', resume: 'استئناف' } as const;

function Renew({ m, onClose }: { m: Member; onClose: () => void }) {
  const { a, today } = useStore();
  const [plan, setPlan] = useState<PlanId>(m.planId);
  const [busy, setBusy] = useState(false);
  const start = maxDate(today, addDays(m.end, 1));
  return (
    <div className="space-y-4">
      <Field label="الباقة"><SelectInput data-testid="select-renew-plan" value={plan} onChange={(e) => setPlan(e.target.value as PlanId)}>
        {PLAN_IDS.map((p) => <option key={p} value={p}>{PLANS[p].label} - {fmtMoney(PLANS[p].price)}</option>)}</SelectInput></Field>
      <div className="rounded-lg border border-gold/25 bg-gold/5 p-3 text-sm text-mute">
        بداية الفترة الجديدة <b className="text-gold"><Num>{start}</Num></b> ونهايتها <b className="text-gold"><Num>{endFor(start, plan)}</Num></b>.
        <br />سيُسجَّل إيراد تجديد تجريبي بقيمة {fmtMoney(PLANS[plan].price)}. رقم العضوية {m.code} لا يتغير.
      </div>
      <div className="flex justify-end gap-2">
        <Btn onClick={onClose}>إلغاء</Btn>
        <Btn v="gold" disabled={busy} data-testid="button-confirm-renew" onClick={() => { if (busy) return; setBusy(true); a.renew(m.id, plan); onClose(); }}>تأكيد التجديد</Btn>
      </div>
    </div>
  );
}

function EditSub({ m, onClose }: { m: Member; onClose: () => void }) {
  const { a } = useStore();
  const [plan, setPlan] = useState<PlanId>(m.planId);
  const [start, setStart] = useState(m.start);
  const [end, setEnd] = useState(m.end);
  const [err, setErr] = useState('');
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const r = a.setSubscription(m.id, plan, start, end); if (r.ok) onClose(); else setErr(r.error); }}>
      <Field label="الباقة"><SelectInput value={plan} onChange={(e) => { const p = e.target.value as PlanId; setPlan(p); if (isValidDate(start)) setEnd(endFor(start, p)); }}>
        {PLAN_IDS.map((p) => <option key={p} value={p}>{PLANS[p].label}</option>)}</SelectInput></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="تاريخ البدء"><TextInput type="date" dir="ltr" value={start} onChange={(e) => { setStart(e.target.value); if (isValidDate(e.target.value)) setEnd(endFor(e.target.value, plan)); }} /></Field>
        <Field label="تاريخ الانتهاء"><TextInput data-testid="input-sub-end" type="date" dir="ltr" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      {err && <p role="alert" className="text-sm font-medium text-bad">{err}</p>}
      <p className="text-xs text-mute">التعديل لا يغيّر سجل المالية القديم.</p>
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>إلغاء</Btn><Btn v="gold" type="submit" data-testid="button-save-sub">حفظ</Btn></div>
    </form>
  );
}

export default function Subscriptions() {
  const { db, today, a, notify } = useStore();
  const [modal, setModal] = useState<{ kind: 'renew' | 'edit' | 'history'; m: Member } | null>(null);
  const live = modal ? db.members.find((x) => x.id === modal.m.id) ?? modal.m : null;
  return (
    <>
      <PageHead title="الاشتراكات" sub="التجديد يبدأ من اليوم أو اليوم التالي لانتهاء الاشتراك أيهما أحدث" />
      <Panel className="scroll-x">
        {db.members.length === 0 ? <Empty text="لا توجد اشتراكات" /> : (
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-line"><tr>{['الكود', 'الاسم', 'الباقة', 'الفترة', 'الحالة', 'إجراءات'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {db.members.map((m) => (
                <tr key={m.id} data-testid={`row-sub-${m.code}`} className="hover:bg-panel2">
                  <td className={td + ' font-bold text-gold'}><Num>{m.code}</Num></td>
                  <td className={td + ' font-medium'}>{m.name}</td>
                  <td className={td}>{PLANS[m.planId].label}</td>
                  <td className={td}><Num>{m.start}</Num> <span className="text-mute">إلى</span> <Num>{m.end}</Num></td>
                  <td className={td}><StatusBadge s={statusOf(m, today)} paused={!!m.pausedOn} /></td>
                  <td className={td}>
                    <div className="flex gap-1.5">
                      <Btn sm data-testid={`button-renew-${m.code}`} disabled={!!m.pausedOn} onClick={() => setModal({ kind: 'renew', m })}><RefreshCw className="h-3.5 w-3.5" />تجديد</Btn>
                      <Btn sm data-testid={`button-pause-${m.code}`} onClick={() => { const r = a.togglePause(m.id); if (!r.ok) notify(r.error, 'warn'); }}>
                        {m.pausedOn ? <><Play className="h-3.5 w-3.5" />استئناف</> : <><Pause className="h-3.5 w-3.5" />إيقاف</>}
                      </Btn>
                      <Btn sm data-testid={`button-edit-sub-${m.code}`} onClick={() => setModal({ kind: 'edit', m })}><SquarePen className="h-3.5 w-3.5" />تعديل</Btn>
                      <Btn sm aria-label={`سجل ${m.name}`} data-testid={`button-history-${m.code}`} onClick={() => setModal({ kind: 'history', m })}><History className="h-3.5 w-3.5" /></Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <Modal open={!!modal} onClose={() => setModal(null)} wide={modal?.kind === 'history'}
        title={modal?.kind === 'renew' ? `تجديد ${live?.name}` : modal?.kind === 'edit' ? `تعديل اشتراك ${live?.name}` : `سجل ${live?.name}`}
        desc={live?.code}>
        {modal && live && modal.kind === 'renew' && <Renew key={live.id} m={live} onClose={() => setModal(null)} />}
        {modal && live && modal.kind === 'edit' && <EditSub key={live.id} m={live} onClose={() => setModal(null)} />}
        {modal && live && modal.kind === 'history' && (
          <ul className="space-y-2" data-testid="list-history">
            {[...live.history].reverse().map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-ink px-3 py-2 text-sm">
                <span className="font-bold text-gold">{KIND[h.kind]}</span><span>{PLANS[h.planId].label}</span>
                <span className="text-mute"><Num>{h.start}</Num> - <Num>{h.end}</Num></span><span className="text-xs text-mute"><Num>{h.date}</Num></span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
