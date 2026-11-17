import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getPaymentReceipt,
  useCreateSubscriptionPayment,
  useGetMember,
  useGetMemberProfile,
  useListOperationalSubscriptions,
  useUpdateMember,
} from '@workspace/api-client-react';
import { ActionButton, AppScreen, Card, EmptyState, ErrorState, Field, IconBadge, LoadingState, SectionTitle, StatusBadge, Text, errorMessage, formatJod, formatJordanDate } from '@/components/prime-ui';
import { useClubAccess } from '@/src/access';
import { useColors } from '@/hooks/useColors';
import { sharePaymentReceipt } from '@/src/exports';

const paymentMethods = [
  ['cash', 'نقدًا'],
  ['card', 'بطاقة'],
  ['bank_transfer', 'تحويل'],
  ['wallet', 'محفظة'],
] as const;

export default function MemberDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useColors();
  const { can } = useClubAccess();
  const canReadPayments = can('payments.view');
  const canReadSubscriptions = can('subscriptions.view');
  const profileQuery = useGetMemberProfile(id, { query: { enabled: Number.isInteger(id) && id > 0 && !canReadPayments && can('members.view') } });
  const detailQuery = useGetMember(id, { query: { enabled: Number.isInteger(id) && id > 0 && canReadPayments && can('members.view') } });
  const operationalSubscriptions = useListOperationalSubscriptions(
    { memberId: id },
    { query: { enabled: Number.isInteger(id) && id > 0 && canReadSubscriptions && !canReadPayments } },
  );
  const updateMember = useUpdateMember();
  const createPayment = useCreateSubscriptionPayment();

  const member = canReadPayments ? detailQuery.data?.member : profileQuery.data;
  const subscriptionRows = canReadPayments ? detailQuery.data?.subscriptions ?? [] : operationalSubscriptions.data ?? [];
  const payments = canReadPayments ? detailQuery.data?.payments ?? [] : [];
  const queryError = canReadPayments ? detailQuery.error : profileQuery.error ?? operationalSubscriptions.error;
  const loading = canReadPayments ? detailQuery.isLoading : profileQuery.isLoading || (canReadSubscriptions && operationalSubscriptions.isLoading);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentSubscriptionId, setPaymentSubscriptionId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'wallet'>('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [formError, setFormError] = useState('');

  React.useEffect(() => {
    if (!member) return;
    setName(member.name);
    setPhone(member.phone);
    setNotes(member.notes ?? '');
  }, [member?.id, member?.name, member?.phone, member?.notes]);

  const activeSubscription = useMemo(
    () => subscriptionRows.find((subscription) => subscription.status === 'active' || subscription.status === 'paused'),
    [subscriptionRows],
  );

  if (!can('members.view')) {
    return <AppScreen><ErrorState message="ليس لديك صلاحية لعرض ملف المشترك." /></AppScreen>;
  }
  if (!Number.isInteger(id) || id < 1) {
    return <AppScreen><ErrorState message="رابط ملف المشترك غير صحيح." onRetry={() => router.back()} /></AppScreen>;
  }

  const saveMember = () => {
    setFormError('');
    if (name.trim().length < 2 || phone.trim().length < 7) {
      setFormError('أدخل اسمًا ورقم هاتف صحيحين.');
      return;
    }
    updateMember.mutate(
      { id, data: { name: name.trim(), phone: phone.trim(), notes: notes.trim() || null } },
      {
        onSuccess: async () => {
          setEditing(false);
          await queryClient.invalidateQueries();
          Alert.alert('تم التعديل', 'تم تحديث بيانات هذا المشترك فقط.');
        },
        onError: (error) => setFormError(errorMessage(error, 'تعذر تحديث بيانات المشترك.')),
      },
    );
  };

  const submitPayment = () => {
    setFormError('');
    const amount = Number(paymentAmount.replace(',', '.'));
    if (!paymentSubscriptionId || !Number.isFinite(amount) || amount <= 0) {
      setFormError('اختر الاشتراك وأدخل مبلغًا صحيحًا.');
      return;
    }
    createPayment.mutate(
      {
        id: paymentSubscriptionId,
        data: { amountFils: Math.round(amount * 1000), method: paymentMethod, note: paymentNote.trim() || null },
      },
      {
        onSuccess: async () => {
          setPaymentAmount('');
          setPaymentNote('');
          setPaymentSubscriptionId(null);
          await queryClient.invalidateQueries();
          Alert.alert('تم تسجيل الدفعة', 'تم حفظ الدفعة ضمن سجل الاشتراك المحدد.');
        },
        onError: (error) => setFormError(errorMessage(error, 'تعذر تسجيل الدفعة.')),
      },
    );
  };

  const openWhatsApp = async () => {
    if (!member) return;
    const digits = member.phone.replace(/\D/g, '');
    const international = digits.startsWith('0') ? `962${digits.slice(1)}` : digits.startsWith('962') ? digits : `962${digits}`;
    const ending = activeSubscription?.endDate;
    const message = ending
      ? `مرحبًا ${member.name}، نذكّرك بأن موعد انتهاء اشتراكك هو ${ending}. يسعدنا تجديد اشتراكك في Prime Boxing Academy.`
      : `مرحبًا ${member.name}، تحياتنا من Prime Boxing Academy.`;
    try {
      await Linking.openURL(`https://wa.me/${international}?text=${encodeURIComponent(message)}`);
    } catch {
      Alert.alert('تعذر فتح واتساب', 'تأكد من تثبيت واتساب أو توفر متصفح على الجهاز.');
    }
  };

  const printReceipt = async (paymentId: number) => {
    try {
      const receipt = await getPaymentReceipt(paymentId);
      await sharePaymentReceipt(receipt);
    } catch (error) {
      Alert.alert('تعذر إصدار الإيصال', errorMessage(error, 'حاول مرة أخرى.'));
    }
  };

  const statusTone = (status: string) => status === 'active' ? 'success' : status === 'expired' || status === 'cancelled' ? 'danger' : 'warning';
  const statusTitle = (status: string) => ({ active: 'نشط', paused: 'متوقف مؤقتًا', expired: 'منتهي', cancelled: 'ملغي' }[status] ?? status);

  if (loading) return <AppScreen><LoadingState label="تحميل ملف المشترك..." /></AppScreen>;
  if (queryError || !member) return <AppScreen><ErrorState message="تعذر تحميل ملف المشترك أو لم يعد موجودًا." onRetry={() => void queryClient.invalidateQueries()} /></AppScreen>;

  return (
    <AppScreen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text muted style={styles.eyebrow}>ملف المشترك · PB-{String(member.id).padStart(3, '0')}</Text>
          <Text weight="bold" style={styles.title}>{member.name}</Text>
          <Text muted style={styles.phone}>{member.phone}</Text>
        </View>
        <View style={styles.headerActions}>
          <IconBadge name="person-circle-outline" size={23} />
          <ActionButton title="رجوع" variant="outline" icon="arrow-forward-outline" onPress={() => router.back()} />
        </View>
      </View>

      <View style={styles.actions}>
        {can('members.edit') ? <ActionButton title={editing ? 'إغلاق التعديل' : 'تعديل البيانات'} variant="outline" icon="create-outline" onPress={() => setEditing((value) => !value)} /> : null}
        {can('whatsapp.create') ? <ActionButton title="تذكير واتساب يدوي" icon="logo-whatsapp" onPress={() => void openWhatsApp()} /> : null}
      </View>

      {editing ? (
        <Card>
          <SectionTitle title="تعديل بيانات المشترك" subtitle="يؤثر التعديل على هذا الملف فقط." />
          <Field label="الاسم" value={name} onChangeText={setName} />
          <Field label="رقم الهاتف" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label="ملاحظات" value={notes} onChangeText={setNotes} multiline style={styles.multiline} />
          {formError ? <Text color={colors.destructive} style={styles.error}>{formError}</Text> : null}
          <ActionButton title="حفظ التغييرات" icon="save-outline" loading={updateMember.isPending} onPress={saveMember} />
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="البيانات الأساسية" />
        <DetailRow label="رقم العضوية" value={`PB-${String(member.id).padStart(3, '0')}`} />
        <DetailRow label="تاريخ التسجيل" value={formatJordanDate(member.joinedAt)} />
        <DetailRow label="الحالة" value={member.active ? 'نشط' : 'مؤرشف'} />
        {member.email ? <DetailRow label="البريد الإلكتروني" value={member.email} /> : null}
        {member.notes ? <DetailRow label="ملاحظات" value={member.notes} /> : null}
      </Card>

      {canReadSubscriptions ? (
        <Card>
          <SectionTitle title="الاشتراكات" subtitle={`${subscriptionRows.length} سجل`} />
          {subscriptionRows.length ? subscriptionRows.map((subscription) => (
            <View key={subscription.id} style={[styles.subscription, { borderTopColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text weight="semibold" style={styles.subName}>{subscription.planName}</Text>
                <Text muted style={styles.subDate}>{formatJordanDate(subscription.startDate)} — {formatJordanDate(subscription.endDate)}</Text>
                {canReadPayments && 'balanceFils' in subscription && typeof subscription.balanceFils === 'number' ? <Text muted style={styles.subDate}>المتبقي: {formatJod(subscription.balanceFils)}</Text> : null}
              </View>
              <StatusBadge label={statusTitle(subscription.status)} tone={statusTone(subscription.status)} />
            </View>
          )) : <EmptyState title="لا توجد اشتراكات" message="يمكن بدء اشتراك من تبويب الاشتراكات." icon="ribbon-outline" />}
        </Card>
      ) : null}

      {can('payments.create') && canReadSubscriptions ? (
        <Card>
          <SectionTitle title="تسجيل دفعة" subtitle="تُربط الدفعة باشتراك واحد دون التأثير على ملفات أخرى." />
          {subscriptionRows.length ? (
            <>
              <View style={styles.selectList}>
                {subscriptionRows.filter((item) => item.status !== 'cancelled').map((subscription) => (
                  <Pressable
                    key={subscription.id}
                    onPress={() => setPaymentSubscriptionId(subscription.id)}
                    style={[styles.selectItem, { borderColor: paymentSubscriptionId === subscription.id ? colors.gold : colors.border, backgroundColor: paymentSubscriptionId === subscription.id ? colors.accent : colors.background }]}
                  >
                    <Text style={styles.selectText}>{subscription.planName} · {formatJordanDate(subscription.endDate)}</Text>
                  </Pressable>
                ))}
              </View>
              <Field label="المبلغ بالدينار" value={paymentAmount} onChangeText={setPaymentAmount} placeholder="0.000" keyboardType="decimal-pad" />
              <View style={styles.methodRow}>
                {paymentMethods.map(([value, label]) => (
                  <Pressable key={value} onPress={() => setPaymentMethod(value)} style={[styles.method, { borderColor: paymentMethod === value ? colors.gold : colors.border, backgroundColor: paymentMethod === value ? colors.accent : colors.background }]}>
                    <Text style={styles.methodText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <Field label="ملاحظة (اختياري)" value={paymentNote} onChangeText={setPaymentNote} placeholder="تفاصيل إضافية" />
              {formError ? <Text color={colors.destructive} style={styles.error}>{formError}</Text> : null}
              <ActionButton title="حفظ الدفعة" icon="cash-outline" loading={createPayment.isPending} disabled={!paymentSubscriptionId || !paymentAmount} onPress={submitPayment} />
            </>
          ) : <Text muted style={styles.help}>لا يوجد اشتراك لربط الدفعة به.</Text>}
        </Card>
      ) : null}

      {canReadPayments ? (
        <Card>
          <SectionTitle title="سجل الدفعات" subtitle={`${payments.length} حركة`} />
          {payments.length ? payments.map((payment) => (
            <View key={payment.id} style={[styles.paymentRow, { borderTopColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text weight="semibold" style={styles.paymentAmount}>{formatJod(payment.amountFils)}</Text>
                <Text muted style={styles.paymentMeta}>{payment.kind === 'refund' ? 'استرداد' : payment.kind === 'discount' ? 'خصم' : 'دفعة'} · {formatJordanDate(payment.createdAt)}</Text>
                <Text muted style={styles.paymentMeta}>إيصال {payment.receiptNumber}</Text>
              </View>
              <ActionButton title="إيصال PDF" variant="outline" icon="print-outline" onPress={() => void printReceipt(payment.id)} />
            </View>
          )) : <EmptyState title="لا توجد دفعات" message="سيظهر سجل المدفوعات عند تسجيلها." icon="receipt-outline" />}
        </Card>
      ) : null}
    </AppScreen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.detailRow, { borderTopColor: colors.border }]}>
      <Text weight="semibold" style={styles.detailValue}>{value}</Text>
      <Text muted style={styles.detailLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerActions: { alignItems: 'center', gap: 7 },
  eyebrow: { textAlign: 'right', fontSize: 11 },
  title: { textAlign: 'right', fontSize: 23, marginTop: 3 },
  phone: { textAlign: 'right', fontSize: 13, writingDirection: 'ltr', marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  error: { textAlign: 'center', fontSize: 12 },
  detailRow: { minHeight: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  detailValue: { textAlign: 'left', fontSize: 12, flexShrink: 1 },
  detailLabel: { textAlign: 'right', fontSize: 12 },
  subscription: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  subName: { textAlign: 'right', fontSize: 12 },
  subDate: { textAlign: 'right', fontSize: 10, marginTop: 3 },
  selectList: { gap: 7 },
  selectItem: { borderWidth: 1, borderRadius: 12, padding: 9 },
  selectText: { textAlign: 'right', fontSize: 11 },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  method: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 7 },
  methodText: { fontSize: 11 },
  help: { textAlign: 'right', fontSize: 11 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 8 },
  paymentAmount: { textAlign: 'right', fontSize: 13 },
  paymentMeta: { textAlign: 'right', fontSize: 10, marginTop: 3 },
});
