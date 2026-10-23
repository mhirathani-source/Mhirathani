import { useState } from 'react';
import { Btn, Field, Num, SelectInput, TextInput } from './kit';
import { PLANS, PLAN_IDS, endFor, fmtMoney, isValidDate, validateMember, type Member, type MemberInput, type PlanId } from '@/lib/domain';
import { useStore } from '@/lib/store';

export function MemberForm({ member, onDone }: { member?: Member; onDone: () => void }) {
  const { db, today, a } = useStore();
  const [v, setV] = useState<MemberInput>({ name: member?.name ?? '', phone: member?.phone ?? '', planId: member?.planId ?? 'monthly', start: member?.start ?? today });
  const [errs, setErrs] = useState<Partial<Record<keyof MemberInput, string>>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof MemberInput>(k: K, x: MemberInput[K]) => setV((p) => ({ ...p, [k]: x }));
  const submit = () => {
    if (busy) return;
    const e = validateMember(v, db.members, member?.id);
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const r = member ? a.updateMember(member.id, v) : a.addMember(v);
    if (r.ok) onDone(); else { setBusy(false); setErrs({ phone: r.error }); }
  };
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
      <Field label="الاسم الكامل" error={errs.name}><TextInput data-testid="input-member-name" value={v.name} invalid={!!errs.name} onChange={(e) => set('name', e.target.value)} /></Field>
      <Field label="رقم الهاتف" error={errs.phone} hint="مثال: 0791234567"><TextInput data-testid="input-member-phone" dir="ltr" inputMode="numeric" maxLength={10} className="text-end" value={v.phone} invalid={!!errs.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الباقة" error={errs.planId}>
          <SelectInput data-testid="select-member-plan" value={v.planId} onChange={(e) => set('planId', e.target.value as PlanId)}>
            {PLAN_IDS.map((p) => <option key={p} value={p}>{PLANS[p].label} - {fmtMoney(PLANS[p].price)}</option>)}
          </SelectInput>
        </Field>
        <Field label="تاريخ البدء" error={errs.start}><TextInput data-testid="input-member-start" type="date" dir="ltr" value={v.start} invalid={!!errs.start} onChange={(e) => set('start', e.target.value)} /></Field>
      </div>
      <div className="rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-sm text-mute">
        تاريخ الانتهاء: <b className="text-gold"><Num>{isValidDate(v.start) ? endFor(v.start, v.planId) : '--'}</Num></b>
        {!member && <> | سيُسجَّل إيراد اشتراك تجريبي بقيمة <b className="text-gold">{fmtMoney(PLANS[v.planId].price)}</b></>}
        {member && <> | تعديل البيانات لا يغيّر سجل المالية القديم.</>}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Btn onClick={onDone}>إلغاء</Btn>
        <Btn v="gold" type="submit" disabled={busy} data-testid="button-save-member">{member ? 'حفظ التعديلات' : 'إضافة المشترك'}</Btn>
      </div>
    </form>
  );
}
