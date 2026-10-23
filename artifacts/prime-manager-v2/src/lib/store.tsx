import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  type Attendance, type Employee, type Member, type MemberInput, type PlanId, type SentItem, type Tx,
  DEFAULT_TEMPLATE, PLANS, addDays, diffDays, endFor, isValidDate, jordanToday, maxDate, reminderKind,
  seedData, seedEmployees, validateMember,
} from './domain';

interface DB {
  employees: Employee[]; members: Member[]; txs: Tx[]; attendance: Attendance[];
  sent: SentItem[]; whatsOn: boolean; template: string; sessionId: string | null;
}
type R = { ok: true } | { ok: false; error: string };
const OK: R = { ok: true };
const fail = (error: string): R => ({ ok: false, error });

export const SIM_MSG = 'محاكاة إرسال، لم تُرسل رسالة فعلية';

function useStoreImpl() {
  const [db, setDb] = useState<DB>(() => {
    const s = seedData(jordanToday());
    return { employees: seedEmployees(), ...s, sent: [], whatsOn: false, template: DEFAULT_TEMPLATE, sessionId: null };
  });
  const ref = useRef(db);
  const [toast, setToast] = useState<{ id: number; msg: string; tone: 'ok' | 'warn' } | null>(null);
  const toastT = useRef<number | undefined>(undefined);
  const locks = useRef(new Set<string>());

  const commit = useCallback((patch: Partial<DB>) => {
    ref.current = { ...ref.current, ...patch };
    setDb(ref.current);
  }, []);
  const notify = useCallback((msg: string, tone: 'ok' | 'warn' = 'ok') => {
    window.clearTimeout(toastT.current);
    setToast({ id: Date.now(), msg, tone });
    toastT.current = window.setTimeout(() => setToast(null), 5000);
  }, []);
  const lock = (k: string) => {
    if (locks.current.has(k)) return false;
    locks.current.add(k);
    window.setTimeout(() => locks.current.delete(k), 900);
    return true;
  };
  const today = jordanToday();
  const me = db.employees.find((e) => e.id === db.sessionId) ?? null;
  const isAdmin = () => ref.current.employees.find((e) => e.id === ref.current.sessionId)?.role === 'admin';
  const nowTime = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit' }).format(new Date());
  const seq = useRef(100);
  const uid = (p: string) => `${p}${++seq.current}`;

  const actions = {
    login(username: string, password: string): R {
      const u = ref.current.employees.find((e) => e.username.toLowerCase() === username.trim().toLowerCase() && e.password === password);
      if (!u) return fail('اسم المستخدم أو كلمة المرور غير صحيحة');
      commit({ sessionId: u.id });
      return OK;
    },
    logout() { window.clearTimeout(toastT.current); setToast(null); commit({ sessionId: null }); },

    addMember(v: MemberInput): R {
      const d = ref.current;
      const errs = validateMember(v, d.members);
      if (Object.keys(errs).length) return fail(Object.values(errs)[0]!);
      if (!lock('add' + v.phone)) return OK;
      const n = Math.max(0, ...d.members.map((m) => Number(m.code.slice(3)))) + 1;
      const code = `PB-${String(n).padStart(3, '0')}`;
      const end = endFor(v.start, v.planId);
      const m: Member = { id: uid('m'), code, name: v.name.trim(), phone: v.phone.trim(), planId: v.planId, start: v.start, end, pausedOn: null,
        history: [{ id: uid('h'), kind: 'new', date: jordanToday(), planId: v.planId, start: v.start, end }] };
      const tx: Tx = { id: uid('t'), date: jordanToday(), type: 'income', amount: PLANS[v.planId].price, label: `اشتراك تجريبي (محاكاة) - ${PLANS[v.planId].label} - ${code}`, source: 'demo-subscription' };
      commit({ members: [...d.members, m], txs: [...d.txs, tx] });
      notify(`تمت إضافة ${m.name} برقم ${code}`);
      return OK;
    },
    updateMember(id: string, v: MemberInput): R {
      const d = ref.current;
      const errs = validateMember(v, d.members, id);
      if (Object.keys(errs).length) return fail(Object.values(errs)[0]!);
      commit({ members: d.members.map((m) => m.id !== id ? m : {
        ...m, name: v.name.trim(), phone: v.phone.trim(), planId: v.planId, start: v.start, end: endFor(v.start, v.planId),
        history: [...m.history, { id: uid('h'), kind: 'edit', date: jordanToday(), planId: v.planId, start: v.start, end: endFor(v.start, v.planId) }] }) });
      notify('تم حفظ بيانات المشترك. سجل المالية القديم لم يتغير.');
      return OK;
    },
    setSubscription(id: string, planId: PlanId, start: string, end: string): R {
      if (!isValidDate(start) || !isValidDate(end)) return fail('تاريخ غير صالح');
      if (end < start) return fail('تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء');
      commit({ members: ref.current.members.map((m) => m.id !== id ? m : { ...m, planId, start, end,
        history: [...m.history, { id: uid('h'), kind: 'edit', date: jordanToday(), planId, start, end }] }) });
      notify('تم تعديل الاشتراك. سجل المالية القديم لم يتغير.');
      return OK;
    },
    renew(id: string, planId: PlanId): R {
      if (!lock('renew' + id)) return OK;
      const d = ref.current;
      const m = d.members.find((x) => x.id === id);
      if (!m) return fail('المشترك غير موجود');
      if (m.pausedOn) return fail('استأنف الاشتراك قبل التجديد');
      const start = maxDate(jordanToday(), addDays(m.end, 1));
      const end = endFor(start, planId);
      if (!end) return fail('تاريخ التجديد خارج النطاق المدعوم');
      const tx: Tx = { id: uid('t'), date: jordanToday(), type: 'income', amount: PLANS[planId].price, label: `تجديد تجريبي (محاكاة) - ${PLANS[planId].label} - ${m.code}`, source: 'demo-subscription' };
      commit({
        members: d.members.map((x) => x.id !== id ? x : { ...x, planId, start, end, history: [...x.history, { id: uid('h'), kind: 'renew', date: jordanToday(), planId, start, end }] }),
        txs: [...d.txs, tx],
      });
      notify(`تم تجديد اشتراك ${m.name} حتى ${end}`);
      return OK;
    },
    togglePause(id: string): R {
      const d = ref.current;
      const m = d.members.find((x) => x.id === id);
      if (!m) return fail('المشترك غير موجود');
      const t = jordanToday();
      if (m.pausedOn) {
        const days = Math.max(0, diffDays(t, m.pausedOn));
        const end = addDays(m.end, days);
        commit({ members: d.members.map((x) => x.id !== id ? x : { ...x, pausedOn: null, end, history: [...x.history, { id: uid('h'), kind: 'resume', date: t, planId: x.planId, start: x.start, end }] }) });
        notify(`تم استئناف اشتراك ${m.name}، أُضيفت ${days} يوم`);
      } else {
        if (m.end < t) return fail('لا يمكن إيقاف اشتراك منتهي');
        commit({ members: d.members.map((x) => x.id !== id ? x : { ...x, pausedOn: t, history: [...x.history, { id: uid('h'), kind: 'pause', date: t, planId: x.planId, start: x.start, end: x.end }] }) });
        notify(`تم إيقاف اشتراك ${m.name} مؤقتاً`);
      }
      return OK;
    },

    mark(date: string, code: string): R {
      const d = ref.current;
      if (!isValidDate(date)) return fail('تاريخ غير صالح');
      if (d.attendance.some((a) => a.date === date && a.code === code)) return fail('الحضور مسجل مسبقاً لهذا اليوم');
      commit({ attendance: [...d.attendance, { date, code, time: nowTime() }] });
      return OK;
    },
    unmark(date: string, code: string) {
      commit({ attendance: ref.current.attendance.filter((a) => !(a.date === date && a.code === code)) });
    },

    addTx(type: 'income' | 'expense', amount: number, label: string, date: string): R {
      if (!isAdmin()) return fail('غير مصرح');
      if (!label.trim()) return fail('البيان مطلوب');
      if (!Number.isSafeInteger(amount) || amount <= 0) return fail('أدخل مبلغاً صحيحاً أكبر من صفر');
      if (!isValidDate(date)) return fail('تاريخ غير صالح');
      if (!lock('tx' + label + amount)) return OK;
      commit({ txs: [...ref.current.txs, { id: uid('t'), date, type, amount, label: label.trim(), source: 'manual' }] });
      notify(type === 'income' ? 'تمت إضافة الإيراد' : 'تمت إضافة المصروف');
      return OK;
    },

    addEmployee(username: string, displayName: string, password: string): R {
      if (!isAdmin()) return fail('غير مصرح');
      const u = username.trim(), n = displayName.trim();
      if (!u || !n || !password) return fail('جميع الحقول مطلوبة');
      if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) return fail('اسم المستخدم: 3 إلى 20 حرفاً إنجليزياً أو أرقاماً أو _');
      if (password.length < 6) return fail('كلمة المرور 6 أحرف على الأقل');
      const d = ref.current;
      if (d.employees.some((e) => e.username.toLowerCase() === u.toLowerCase())) return fail('اسم المستخدم مستخدم مسبقاً');
      if (d.employees.some((e) => e.displayName === n)) return fail('الاسم المعروض مستخدم مسبقاً');
      commit({ employees: [...d.employees, { id: uid('e'), username: u, displayName: n, password, role: 'staff' }] });
      notify(`تمت إضافة الموظف ${n}`);
      return OK;
    },
    deleteEmployee(id: string): R {
      if (!isAdmin()) return fail('غير مصرح');
      const d = ref.current;
      const e = d.employees.find((x) => x.id === id);
      if (!e) return fail('الموظف غير موجود');
      if (e.id === d.sessionId) return fail('لا يمكنك حذف حسابك الحالي');
      if (e.role === 'admin' && d.employees.filter((x) => x.role === 'admin').length <= 1) return fail('لا يمكن حذف آخر مدير');
      commit({ employees: d.employees.filter((x) => x.id !== id) });
      notify(`تم حذف الموظف ${e.displayName}`);
      return OK;
    },

    setWhatsOn(v: boolean) { commit({ whatsOn: v }); },
    setTemplate(t: string) { commit({ template: t }); },
    sendReminders(codes: string[]): number {
      const d = ref.current;
      if (!d.whatsOn) { notify('فعّل خيار واتساب المحلي أولاً', 'warn'); return 0; }
      if (!d.template.trim()) { notify('اكتب قالب التذكير قبل محاكاة الإرسال', 'warn'); return 0; }
      const t = jordanToday();
      const fresh: SentItem[] = [];
      for (const code of codes) {
        const m = d.members.find((x) => x.code === code);
        const kind = m && reminderKind(m, t);
        if (!m || !kind) continue;
        const key = `${code}|${t}`;
        if (d.sent.some((s) => s.key === key) || fresh.some((s) => s.key === key)) continue;
        fresh.push({ key, code, name: m.name, date: t, time: nowTime(), kind });
      }
      if (!fresh.length) { notify('لا توجد رسائل جديدة: تمت محاكاة الجميع اليوم', 'warn'); return 0; }
      commit({ sent: [...fresh, ...d.sent] });
      notify(`${SIM_MSG} (${fresh.length})`);
      return fresh.length;
    },
  };
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const stable = useMemo(() => new Proxy({} as typeof actions, { get: (_, k) => (actionsRef.current as never)[k] }), []);
  return { db, me, today, toast, dismissToast: () => setToast(null), notify, a: stable };
}

type Store = ReturnType<typeof useStoreImpl>;
const Ctx = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const s = useStoreImpl();
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}
export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
