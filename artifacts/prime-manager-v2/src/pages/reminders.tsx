import { useState } from 'react';
import { Eye, Send } from 'lucide-react';
import { Area, Btn, Empty, Modal, Num, PageHead, Panel, td, th } from '@/components/kit';
import { DEFAULT_TEMPLATE, PLANS, reminderKind, renderTemplate, type Member } from '@/lib/domain';
import { SIM_MSG, useStore } from '@/lib/store';

export default function Reminders() {
  const { db, today, a } = useStore();
  const [prev, setPrev] = useState<Member | null>(null);
  const due = db.members.map((m) => ({ m, kind: reminderKind(m, today) })).filter((x): x is { m: Member; kind: string } => !!x.kind);
  const sentToday = (code: string) => db.sent.some((s) => s.key === `${code}|${today}`);
  const pending = due.filter((d) => !sentToday(d.m.code));
  return (
    <>
      <PageHead title="التذكيرات" sub="مستلمون مستحقون: قبل يومين من الانتهاء، يوم الانتهاء، والاشتراكات المنتهية" />
      <div className="mb-4 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm font-bold text-gold" role="status" data-testid="text-sim-banner">
        وضع المحاكاة فقط: {SIM_MSG}. لا يوجد اتصال بواتساب ولا يتم فتحه.
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div><div className="font-bold">تفعيل واتساب المحلي</div><div className="text-xs text-mute">مفتاح محلي لتمكين زر المحاكاة، وليس اتصالاً حقيقياً</div></div>
            <button role="switch" aria-checked={db.whatsOn} aria-label="تفعيل واتساب المحلي" data-testid="switch-whatsapp" onClick={() => a.setWhatsOn(!db.whatsOn)}
              className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${db.whatsOn ? 'border-gold bg-gold' : 'border-line bg-ink'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${db.whatsOn ? 'end-0.5 bg-ink' : 'end-6 bg-mute'}`} />
            </button>
          </div>
          <div className="text-sm text-mute" data-testid="text-whatsapp-state">{db.whatsOn ? 'مفعّل محلياً: الإرسال محاكاة فقط' : 'معطّل: لا يمكن الإرسال'}</div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-mute">قالب الرسالة</span>
            <Area data-testid="input-template" rows={6} value={db.template} onChange={(e) => a.setTemplate(e.target.value)} />
          </label>
          <p className="text-xs leading-relaxed text-mute">المتغيرات: {'{الاسم} {الكود} {الباقة} {تاريخ_الانتهاء} {الحالة}'}</p>
          <Btn sm onClick={() => a.setTemplate(DEFAULT_TEMPLATE)}>استعادة القالب الافتراضي</Btn>
        </Panel>
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
            <div className="font-bold">المستلمون ({due.length})</div>
            <Btn v="gold" sm disabled={!db.whatsOn || pending.length === 0} data-testid="button-send-all" onClick={() => a.sendReminders(pending.map((p) => p.m.code))}>
              <Send className="h-4 w-4" />محاكاة إرسال للجميع ({pending.length})
            </Btn>
          </div>
          <div className="scroll-x">
            {due.length === 0 ? <Empty text="لا يوجد مستلمون مستحقون اليوم" /> : (
              <table className="w-full min-w-[560px]">
                <thead className="border-b border-line"><tr>{['المشترك', 'السبب', 'الانتهاء', 'إجراء'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-line">
                  {due.map(({ m, kind }) => (
                    <tr key={m.id} data-testid={`row-reminder-${m.code}`}>
                      <td className={td}><b>{m.name}</b> <span className="text-xs text-gold"><Num>{m.code}</Num></span></td>
                      <td className={td}>{kind}</td>
                      <td className={td}><Num>{m.end}</Num></td>
                      <td className={td}>
                        <div className="flex gap-1.5">
                          <Btn sm data-testid={`button-preview-${m.code}`} onClick={() => setPrev(m)}><Eye className="h-3.5 w-3.5" />معاينة</Btn>
                          <Btn sm disabled={!db.whatsOn || sentToday(m.code)} data-testid={`button-send-${m.code}`} onClick={() => a.sendReminders([m.code])}>
                            {sentToday(m.code) ? 'تمت المحاكاة' : 'محاكاة إرسال'}
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>
      </div>
      <Panel className="mt-4">
        <div className="border-b border-line p-4 font-bold">سجل المحاكاة المحلي ({db.sent.length})</div>
        {db.sent.length === 0 ? <Empty text="لم تتم أي محاكاة بعد" /> : (
          <ul className="divide-y divide-line" data-testid="list-sent">
            {db.sent.map((s) => (
              <li key={s.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span><b>{s.name}</b> <Num>{s.code}</Num> - {s.kind}</span>
                <span className="text-mute"><Num>{s.date} {s.time}</Num> - محاكاة، لم تُرسل رسالة فعلية</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Modal open={!!prev} onClose={() => setPrev(null)} title={`معاينة رسالة ${prev?.name ?? ''}`} desc={prev ? `${prev.phone} - ${PLANS[prev.planId].label}` : ''}>
        {prev && <p className="whitespace-pre-wrap rounded-xl border border-line bg-ink p-4 text-sm leading-loose" data-testid="text-preview">{renderTemplate(db.template, prev, today)}</p>}
        <p className="mt-3 text-xs text-mute">معاينة فقط. لن تُرسل أي رسالة.</p>
      </Modal>
    </>
  );
}
