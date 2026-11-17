import React, { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateFinanceTransactionV2,
  useGetCashRegister,
  useGetFinancePeriodReport,
  useListFinanceCategoriesV2,
  useListFinanceTransactionsV2,
  useRecordCashMovement,
} from '@workspace/api-client-react';
import { ActionButton, AppScreen, Card, EmptyState, ErrorState, Field, IconBadge, LoadingState, SectionTitle, StatusBadge, Text, formatJod, formatJordanDate, errorMessage } from '@/components/prime-ui';
import { useClubAccess } from '@/src/access';
import { useColors } from '@/hooks/useColors';
import { shareFinanceReport } from '@/src/exports';

function jordanToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export default function FinanceScreen() {
  const queryClient = useQueryClient();
  const colors = useColors();
  const { can } = useClubAccess();
  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('month');
  const [showTransaction, setShowTransaction] = useState(false);
  const [showCashMovement, setShowCashMovement] = useState(false);
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(jordanToday());
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [method, setMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'wallet'>('cash');
  const [cashDirection, setCashDirection] = useState<'in' | 'out'>('out');
  const [cashDescription, setCashDescription] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [formError, setFormError] = useState('');

  const today = jordanToday();
  const fromDate = period === 'day'
    ? today
    : period === 'month'
      ? `${today.slice(0, 7)}-01`
      : `${today.slice(0, 4)}-01-01`;
  const report = useGetFinancePeriodReport({ period, date: jordanToday() }, { query: { enabled: can('reports.view') } });
  const categories = useListFinanceCategoriesV2({ query: { enabled: can('finance.view') } });
  const transactions = useListFinanceTransactionsV2(
    { startDate: fromDate, endDate: today },
    { query: { enabled: can('finance.view') } },
  );
  const cashRegister = useGetCashRegister({ query: { enabled: can('finance.view') } });
  const createTransaction = useCreateFinanceTransactionV2();
  const recordCash = useRecordCashMovement();
  const categoryOptions = useMemo(
    () => (categories.data ?? []).filter((item) => item.active && item.kind === kind),
    [categories.data, kind],
  );

  if (!can('finance.view') && !can('reports.view')) {
    return <AppScreen><ErrorState message="ليس لديك صلاحية لعرض المعلومات المالية." /></AppScreen>;
  }

  const recordTransaction = () => {
    setFormError('');
    const numeric = Number(amount.replace(',', '.'));
    if (!Number.isFinite(numeric) || numeric <= 0 || !description.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
      setFormError('أدخل مبلغًا ووصفًا وتاريخًا صحيحًا.');
      return;
    }
    createTransaction.mutate(
      {
        data: {
          kind,
          amountFils: Math.round(numeric * 1000),
          description: description.trim(),
          transactionDate,
          method,
          categoryId,
        },
      },
      {
        onSuccess: async () => {
          setAmount('');
          setDescription('');
          setShowTransaction(false);
          await queryClient.invalidateQueries();
          Alert.alert('تم الحفظ', kind === 'income' ? 'تم تسجيل الإيراد.' : 'تم تسجيل المصروف.');
        },
        onError: (error) => setFormError(errorMessage(error, 'تعذر تسجيل الحركة المالية.')),
      },
    );
  };

  const recordCashChange = () => {
    setFormError('');
    const numeric = Number(cashAmount.replace(',', '.'));
    if (!Number.isFinite(numeric) || numeric <= 0 || cashDescription.trim().length < 2) {
      setFormError('أدخل مبلغًا ووصفًا صحيحين.');
      return;
    }
    recordCash.mutate(
      { data: { direction: cashDirection, amountFils: Math.round(numeric * 1000), description: cashDescription.trim() } },
      {
        onSuccess: async () => {
          setCashAmount('');
          setCashDescription('');
          setShowCashMovement(false);
          await queryClient.invalidateQueries();
          Alert.alert('تم التسجيل', 'تم حفظ حركة الصندوق.');
        },
        onError: (error) => setFormError(errorMessage(error, 'تعذر تسجيل حركة الصندوق.')),
      },
    );
  };

  const shareReport = async () => {
    if (!report.data) return;
    try {
      await shareFinanceReport(report.data);
    } catch (error) {
      Alert.alert('تعذر إنشاء التقرير', errorMessage(error, 'تعذر مشاركة ملف PDF.'));
    }
  };

  const totals = report.data;
  const displayTransactions = totals?.transactions ?? transactions.data ?? [];
  const incomeTotal = totals?.incomeFils ?? displayTransactions.filter((item) => item.kind === 'income').reduce((sum, item) => sum + item.amountFils, 0);
  const expenseTotal = totals?.expenseFils ?? displayTransactions.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + item.amountFils, 0);
  const cashBalance = totals?.cashBalanceFils ?? cashRegister.data?.balanceFils;
  return (
    <AppScreen
      refreshControl={<RefreshControl refreshing={report.isFetching || categories.isFetching} onRefresh={() => void queryClient.invalidateQueries()} tintColor={colors.gold} />}
    >
      <View style={styles.heading}>
        <View style={{ flex: 1 }}>
          <Text muted style={styles.eyebrow}>إدارة المال والتشغيل</Text>
          <Text weight="bold" style={styles.title}>المالية والصندوق</Text>
          <Text muted style={styles.subtitle}>الأرقام من سجلات النظام الفعلية</Text>
        </View>
        <IconBadge name="wallet-outline" size={23} />
      </View>

      <View style={styles.periods}>
        {([['day', 'يومي'], ['month', 'شهري'], ['year', 'سنوي']] as const).map(([value, label]) => (
          <Pressable key={value} onPress={() => setPeriod(value)} style={[styles.periodButton, { borderColor: period === value ? colors.gold : colors.border, backgroundColor: period === value ? colors.accent : colors.card }]}>
            <Text weight={period === value ? 'bold' : 'medium'} style={styles.periodText}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {report.isLoading && can('reports.view') || transactions.isLoading && can('finance.view') ? <LoadingState /> : report.error && can('reports.view') ? <ErrorState message="تعذر تحميل التقرير المالي." onRetry={() => void report.refetch()} /> : totals || displayTransactions.length || can('reports.view') || can('finance.view') ? (
        <>
          <View style={styles.summaryGrid}>
            <Card style={styles.summaryCard}><Text muted style={styles.metricLabel}>الإيرادات</Text><Text weight="bold" style={styles.metric}>{formatJod(incomeTotal)}</Text></Card>
            <Card style={styles.summaryCard}><Text muted style={styles.metricLabel}>المصاريف</Text><Text weight="bold" style={styles.metric}>{formatJod(expenseTotal)}</Text></Card>
            <Card style={styles.summaryCard}><Text muted style={styles.metricLabel}>صافي النتيجة</Text><Text weight="bold" style={styles.metric}>{formatJod(totals?.netFils ?? incomeTotal - expenseTotal)}</Text></Card>
            <Card style={styles.summaryCard}><Text muted style={styles.metricLabel}>رصيد الصندوق</Text><Text weight="bold" style={styles.metric}>{formatJod(cashBalance)}</Text></Card>
          </View>
          {totals ? (
            <Card>
              <SectionTitle title="الفترة المحددة" subtitle={`${formatJordanDate(totals.fromDate)} — ${formatJordanDate(totals.toDate)}`} />
              <Text muted style={styles.outstanding}>رواتب مستحقة: {formatJod(totals.payrollOutstandingFils)}</Text>
              <ActionButton title="مشاركة التقرير PDF" icon="share-outline" variant="outline" onPress={shareReport} />
            </Card>
          ) : null}
        </>
      ) : null}

      {can('finance.create') ? (
        <>
          <View style={styles.actionRow}>
            <ActionButton title="تسجيل حركة مالية" icon="add-circle-outline" onPress={() => setShowTransaction((value) => !value)} />
            <ActionButton title="حركة صندوق" variant="outline" icon="cash-outline" onPress={() => setShowCashMovement((value) => !value)} />
          </View>

          {showTransaction ? (
            <Card>
              <SectionTitle title="حركة مالية جديدة" subtitle="تُسجل كإيراد أو مصروف مع طريقة الدفع والتاريخ." />
              <View style={styles.actionRow}>
                <ActionButton title="مصروف" variant={kind === 'expense' ? 'primary' : 'outline'} onPress={() => setKind('expense')} />
                <ActionButton title="إيراد" variant={kind === 'income' ? 'primary' : 'outline'} onPress={() => setKind('income')} />
              </View>
              <Field label="المبلغ بالدينار" value={amount} onChangeText={setAmount} placeholder="0.000" keyboardType="decimal-pad" />
              <Field label="الوصف" value={description} onChangeText={setDescription} placeholder="سبب الحركة أو تفاصيلها" />
              <Field label="التاريخ" value={transactionDate} onChangeText={setTransactionDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
              <Text weight="semibold" style={styles.choiceLabel}>التصنيف</Text>
              <View style={styles.chips}>
                {categoryOptions.map((category) => (
                  <Pressable key={category.id} onPress={() => setCategoryId(category.id)} style={[styles.chip, { borderColor: categoryId === category.id ? colors.gold : colors.border, backgroundColor: categoryId === category.id ? colors.accent : colors.background }]}>
                    <Text style={styles.chipText}>{category.name}</Text>
                  </Pressable>
                ))}
                {!categoryOptions.length ? <Text muted style={styles.help}>لا توجد تصنيفات متاحة لهذا النوع.</Text> : null}
              </View>
              <Text weight="semibold" style={styles.choiceLabel}>طريقة الدفع</Text>
              <View style={styles.chips}>
                {([
                  ['cash', 'نقدًا'],
                  ['card', 'بطاقة'],
                  ['bank_transfer', 'تحويل'],
                  ['wallet', 'محفظة'],
                ] as const).map(([value, label]) => (
                  <Pressable key={value} onPress={() => setMethod(value)} style={[styles.chip, { borderColor: method === value ? colors.gold : colors.border, backgroundColor: method === value ? colors.accent : colors.background }]}>
                    <Text style={styles.chipText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              {formError ? <Text color={colors.destructive} style={styles.error}>{formError}</Text> : null}
              <ActionButton title="حفظ الحركة" icon="save-outline" loading={createTransaction.isPending} onPress={recordTransaction} />
            </Card>
          ) : null}

          {showCashMovement ? (
            <Card>
              <SectionTitle title="تسوية الصندوق" subtitle="تسجيل قبض أو صرف يدوي موثق." />
              <View style={styles.actionRow}>
                <ActionButton title="صرف" variant={cashDirection === 'out' ? 'primary' : 'outline'} onPress={() => setCashDirection('out')} />
                <ActionButton title="قبض" variant={cashDirection === 'in' ? 'primary' : 'outline'} onPress={() => setCashDirection('in')} />
              </View>
              <Field label="المبلغ بالدينار" value={cashAmount} onChangeText={setCashAmount} placeholder="0.000" keyboardType="decimal-pad" />
              <Field label="الوصف" value={cashDescription} onChangeText={setCashDescription} placeholder="سبب التسوية" />
              {formError ? <Text color={colors.destructive} style={styles.error}>{formError}</Text> : null}
              <ActionButton title="حفظ حركة الصندوق" icon="save-outline" loading={recordCash.isPending} onPress={recordCashChange} />
            </Card>
          ) : null}
        </>
      ) : null}

      <Card>
        <SectionTitle title="حركات الفترة" subtitle={`${displayTransactions.length} حركة`} />
        {displayTransactions.length ? displayTransactions.slice(0, 50).map((transaction) => (
          <View key={`${transaction.id}-${transaction.transactionDate}`} style={[styles.transactionRow, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text weight="semibold" style={styles.transactionDescription}>{transaction.description}</Text>
              <Text muted style={styles.transactionMeta}>{formatJordanDate(transaction.transactionDate)} · {transaction.categoryName ?? 'بدون تصنيف'}</Text>
            </View>
            <View style={styles.amountArea}>
              <Text weight="bold" color={transaction.kind === 'income' ? colors.success : colors.destructive} style={styles.amountText}>{formatJod(transaction.amountFils)}</Text>
              <StatusBadge label={transaction.kind === 'income' ? 'إيراد' : 'مصروف'} tone={transaction.kind === 'income' ? 'success' : 'danger'} />
            </View>
          </View>
        )) : <EmptyState title="لا توجد حركات" message="ستظهر الحركات المسجلة ضمن الفترة المحددة هنا." icon="receipt-outline" />}
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { fontSize: 11, textAlign: 'right' },
  title: { fontSize: 23, textAlign: 'right', marginTop: 2 },
  subtitle: { fontSize: 12, textAlign: 'right', marginTop: 2 },
  periods: { flexDirection: 'row', gap: 8 },
  periodButton: { flex: 1, borderWidth: 1, borderRadius: 12, minHeight: 40, justifyContent: 'center' },
  periodText: { textAlign: 'center', fontSize: 12 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  summaryCard: { flex: 1, minWidth: '46%', padding: 12, gap: 7 },
  metricLabel: { textAlign: 'right', fontSize: 11 },
  metric: { textAlign: 'right', fontSize: 15 },
  outstanding: { textAlign: 'right', fontSize: 13 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceLabel: { textAlign: 'right', fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 7 },
  chipText: { fontSize: 11 },
  help: { textAlign: 'right', fontSize: 11 },
  error: { textAlign: 'center', fontSize: 12 },
  transactionRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 11, gap: 8 },
  transactionDescription: { textAlign: 'right', fontSize: 12 },
  transactionMeta: { textAlign: 'right', fontSize: 10, marginTop: 3 },
  amountArea: { alignItems: 'flex-end', gap: 5 },
  amountText: { fontSize: 12 },
});
