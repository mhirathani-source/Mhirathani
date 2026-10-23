export const PLANS = {
  monthly: { label: 'شهري', months: 1, price: 35000 },
  quarterly: { label: '3 أشهر', months: 3, price: 90000 },
  semiannual: { label: '6 أشهر', months: 6, price: 150000 },
} as const;
export type PlanId = keyof typeof PLANS;
export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export type Role = 'admin' | 'staff';
export interface Employee { id: string; username: string; displayName: string; password: string; role: Role }
export interface HistoryItem { id: string; kind: 'new' | 'renew' | 'edit' | 'pause' | 'resume'; date: string; planId: PlanId; start: string; end: string }
export interface Member { id: string; code: string; name: string; phone: string; planId: PlanId; start: string; end: string; pausedOn: string | null; history: HistoryItem[] }
export interface Tx { id: string; date: string; type: 'income' | 'expense'; amount: number; label: string; source: 'seed' | 'demo-subscription' | 'manual' }
export interface Attendance { date: string; code: string; time: string }
export interface SentItem { key: string; code: string; name: string; date: string; time: string; kind: string }

/* money: integer fils, 1 JD = 1000 fils */
export const fmtMoney = (fils: number) => {
  const sign = fils < 0 ? '-' : '';
  const a = Math.abs(fils);
  const jd = Math.floor(a / 1000);
  const f = a % 1000;
  return `${sign}${jd.toLocaleString('en-US')}${f ? '.' + String(f).padStart(3, '0').replace(/0+$/, '') : ''} د.أ`;
};
export const parseJd = (s: string): number | null => {
  const t = s.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  const [a, b = ''] = t.split('.');
  const fils = Number(a) * 1000 + Number(b.padEnd(3, '0'));
  return Number.isSafeInteger(fils) ? fils : null;
};

/* date-only helpers (YYYY-MM-DD) */
export const jordanToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman' }).format(new Date());
const utc = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => fmt(utc(s) + n * 864e5);
export const diffDays = (a: string, b: string) => Math.round((utc(a) - utc(b)) / 864e5);
export const addMonths = (s: string, n: number) => {
  const [y, m, d] = s.split('-').map(Number);
  const t = m - 1 + n;
  const ty = y + Math.floor(t / 12);
  const tm = ((t % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return fmt(Date.UTC(ty, tm, Math.min(d, last)));
};
export const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && fmt(utc(s)) === s;
export const endFor = (start: string, planId: PlanId) => {
  // Native date fields can emit empty or partial years while being edited.
  // Never pass those intermediate values to toISOString().
  if (!isValidDate(start) || !PLANS[planId]) return '';
  const following = addMonths(start, PLANS[planId].months);
  if (!isValidDate(following)) return '';
  const end = addDays(following, -1);
  return isValidDate(end) ? end : '';
};
export const maxDate = (a: string, b: string) => (a >= b ? a : b);

export type Status = 'active' | 'soon' | 'expired';
export const statusOf = (m: Member, today: string): Status => {
  if (m.end < today) return 'expired';
  return diffDays(m.end, today) <= 7 ? 'soon' : 'active';
};
export const STATUS_LABEL: Record<Status, string> = { active: 'نشط', soon: 'ينتهي قريباً', expired: 'منتهي' };

export const PHONE_RE = /^07[0-9]{8}$/;
export interface MemberInput { name: string; phone: string; planId: PlanId; start: string }
export const validateMember = (v: MemberInput, members: Member[], excludeId?: string) => {
  const e: Partial<Record<keyof MemberInput, string>> = {};
  if (!v.name.trim()) e.name = 'الاسم مطلوب';
  if (!v.phone.trim()) e.phone = 'رقم الهاتف مطلوب';
  else if (!PHONE_RE.test(v.phone.trim())) e.phone = 'رقم غير صالح، يجب أن يبدأ بـ 07 ويتكون من 10 أرقام';
  else if (members.some((m) => m.phone === v.phone.trim() && m.id !== excludeId)) e.phone = 'رقم الهاتف مسجل لمشترك آخر';
  if (!PLANS[v.planId]) e.planId = 'اختر الباقة';
  if (!v.start) e.start = 'تاريخ البدء مطلوب';
  else if (!isValidDate(v.start)) e.start = 'تاريخ غير صالح';
  else if (PLANS[v.planId] && !endFor(v.start, v.planId)) e.start = 'تاريخ الاشتراك خارج النطاق المدعوم';
  return e;
};

/* seed data, derived relative to Jordan today */
const SEED: [string, string, PlanId, number][] = [
  ['أحمد الخطيب', '0791234501', 'quarterly', 20],
  ['محمد العمرو', '0782345602', 'semiannual', 45],
  ['خالد الحداد', '0773456703', 'monthly', 2],
  ['يوسف النعيمي', '0794567804', 'monthly', 0],
  ['عمر الزعبي', '0785678905', 'quarterly', 5],
  ['سامر المومني', '0796789006', 'monthly', -3],
  ['ليث البطاينة', '0777890107', 'quarterly', -20],
  ['زيد القضاة', '0798901208', 'semiannual', 90],
  ['رامي الطراونة', '0789012309', 'monthly', 6],
  ['طارق العبادي', '0790123410', 'semiannual', 150],
];
export const seedEmployees = (): Employee[] => [
  { id: 'e1', username: 'admin', displayName: 'مدير النادي', password: 'admin123', role: 'admin' },
  { id: 'e2', username: 'staff1', displayName: 'موظف الاستقبال', password: 'staff123', role: 'staff' },
];
export const seedData = (today: string) => {
  const members: Member[] = [];
  const txs: Tx[] = [];
  SEED.forEach(([name, phone, planId, off], i) => {
    const end = addDays(today, off);
    const start = addMonths(addDays(end, 1), -PLANS[planId].months);
    const code = `PB-${String(i + 1).padStart(3, '0')}`;
    members.push({ id: `m${i + 1}`, code, name, phone, planId, start, end, pausedOn: null, history: [{ id: `h${i + 1}`, kind: 'new', date: start, planId, start, end }] });
    txs.push({ id: `t${i + 1}`, date: start, type: 'income', amount: PLANS[planId].price, label: `إيصال اشتراك ${PLANS[planId].label} - ${code}`, source: 'seed' });
  });
  txs.push(
    { id: 'x1', date: addDays(today, -12), type: 'expense', amount: 120000, label: 'إيجار الصالة (تجريبي)', source: 'seed' },
    { id: 'x2', date: addDays(today, -8), type: 'expense', amount: 28500, label: 'أدوات وقفازات (تجريبي)', source: 'seed' },
    { id: 'x3', date: addDays(today, -3), type: 'expense', amount: 17250, label: 'فواتير كهرباء (تجريبي)', source: 'seed' },
  );
  const attendance: Attendance[] = [
    { date: today, code: 'PB-001', time: '17:05' },
    { date: today, code: 'PB-002', time: '17:40' },
    { date: addDays(today, -1), code: 'PB-001', time: '18:10' },
  ];
  return { members, txs, attendance };
};

export const DEFAULT_TEMPLATE =
  'مرحباً {الاسم}، نذكرك بأن اشتراكك ({الباقة}) في أكاديمية برايم للملاكمة {الحالة} بتاريخ {تاريخ_الانتهاء}. رقم العضوية {الكود}. نسعد بتجديدك.';
export const reminderKind = (m: Member, today: string): string | null => {
  if (m.pausedOn) return null;
  const d = diffDays(m.end, today);
  if (d === 2) return 'قبل يومين من الانتهاء';
  if (d === 0) return 'يوم الانتهاء';
  if (d < 0) return 'منتهي';
  return null;
};
export const renderTemplate = (t: string, m: Member, today: string) => {
  const d = diffDays(m.end, today);
  const state = d < 0 ? 'انتهى' : d === 0 ? 'ينتهي اليوم' : `ينتهي بعد ${d} يوم`;
  return t
    .replaceAll('{الاسم}', m.name).replaceAll('{الكود}', m.code).replaceAll('{الباقة}', PLANS[m.planId].label)
    .replaceAll('{تاريخ_الانتهاء}', m.end).replaceAll('{الحالة}', state);
};
