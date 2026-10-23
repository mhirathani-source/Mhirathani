import { useState } from 'react';
import { Check, Undo2 } from 'lucide-react';
import { Btn, Empty, Num, PageHead, Panel, TextInput, td, th } from '@/components/kit';
import { isValidDate } from '@/lib/domain';
import { useStore } from '@/lib/store';

export default function Attendance() {
  const { db, today, a, notify } = useStore();
  const [date, setDate] = useState(today);
  const [q, setQ] = useState('');
  const ok = isValidDate(date);
  const day = db.attendance.filter((x) => x.date === date);
  const rows = db.members.filter((m) => !q.trim() || m.name.includes(q.trim()) || m.code.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <PageHead title="الحضور" sub="تسجيل الحضور اليومي، مرة واحدة لكل مشترك في اليوم">
        <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-bold text-gold" data-testid="text-attendance-count">حضور اليوم المحدد: <Num>{day.length}</Num></div>
      </PageHead>
      <div className="mb-3 grid gap-2 sm:grid-cols-[auto_1fr]">
        <TextInput type="date" dir="ltr" aria-label="التاريخ" data-testid="input-attendance-date" value={date} onChange={(e) => setDate(e.target.value)} />
        <TextInput aria-label="بحث" placeholder="بحث بالاسم أو الكود" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Panel className="scroll-x">
        {!ok ? <Empty text="اختر تاريخاً صالحاً" /> : rows.length === 0 ? <Empty text="لا يوجد مشتركون مطابقون" /> : (
          <table className="w-full min-w-[520px]">
            <thead className="border-b border-line"><tr>{['الكود', 'الاسم', 'الحضور', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((m) => {
                const rec = day.find((x) => x.code === m.code);
                return (
                  <tr key={m.id} data-testid={`row-att-${m.code}`} className="hover:bg-panel2">
                    <td className={td + ' font-bold text-gold'}><Num>{m.code}</Num></td>
                    <td className={td + ' font-medium'}>{m.name}</td>
                    <td className={td}>{rec ? <span className="font-bold text-good">حاضر <span className="text-xs font-normal text-mute"><Num>{rec.time}</Num></span></span> : <span className="text-mute">لم يسجَّل</span>}</td>
                    <td className={td}>
                      {rec ? <Btn sm data-testid={`button-undo-${m.code}`} onClick={() => a.unmark(date, m.code)}><Undo2 className="h-3.5 w-3.5" />تراجع</Btn>
                        : <Btn sm v="gold" data-testid={`button-mark-${m.code}`} onClick={() => { const r = a.mark(date, m.code); if (!r.ok) notify(r.error, 'warn'); }}><Check className="h-3.5 w-3.5" />تسجيل حضور</Btn>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
