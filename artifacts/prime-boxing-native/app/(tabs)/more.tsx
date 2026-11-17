import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useClerk } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  useCreateEmployeeV2,
  useCreatePayrollV2,
  useCreatePlan,
  useGetFinancePeriodReport,
  useListEmployeesV2,
  useListMembers,
  useListOperationalSubscriptions,
  useListPayrollV2,
  useListPlans,
  useRecordPayrollPayment,
  useUpdatePlan,
} from '@workspace/api-client-react';
import {
  ActionButton,
  AppScreen,
  Card,
  EmptyState,
  ErrorState,
  Field,
  IconBadge,
  LoadingState,
  SectionTitle,
  StatusBadge,
  Text,
  errorMessage,
  formatJod,
  formatJordanDate,
} from '@/components/prime-ui';
import { useClubAccess } from '@/src/access';
import { useColors } from '@/hooks/useColors';
import {
  getMembershipNotificationsEnabled,
  requestMembershipNotificationPermission,
  setMembershipNotificationsEnabled,
  syncMembershipNotifications,
} from '@/src/notifications';
import { shareFinanceReport } from '@/src/exports';

type Section = 'home' | 'plans' | 'reports' | 'staff' | 'reminders' | 'settings';

function jordanToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Amman',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function currentPeriod() {
  return jordanToday().slice(0, 7);
}

function MenuItem({
  title,
  description,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, { borderColor: colors.border, opacity: pressed ? 0.76 : 1 }]}>
      <IconBadge name={icon} />
      <View style={{ flex: 1 }}>
        <Text weight="semibold" style={styles.menuTitle}>{title}</Text>
        <Text muted style={styles.menuDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-back" size={17} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const queryClient = useQueryClient();
  const { signOut } = useClerk();
  const router = useRouter();
  const colors = useColors();
  const { session, can } = useClubAccess();
  const [section, setSection] = useState<Section>('home');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showPayrollForm, setShowPayrollForm] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planDays, setPlanDays] = useState('30');
  const [planPrice, setPlanPrice] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeePosition, setEmployeePosition] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');
  const [employeeSalary, setEmployeeSalary] = useState('');
  const [payrollEmployeeId, setPayrollEmployeeId] = useState<number | null>(null);
  const [payrollAmount, setPayrollAmount] = useState('');
  const [payrollPeriod, setPayrollPeriod] = useState(currentPeriod());
  const [payrollDueDate, setPayrollDueDate] = useState(jordanToday());
  const [formError, setFormError] = useState('');
  const logout = async () => {
    await signOut();
    queryClient.clear();
    router.replace('/');
  };

  const plans = useListPlans({ query: { enabled: section === 'plans' && can('plans.view') } });
  const financeReport = useGetFinancePeriodReport(
    { period: 'month', date: jordanToday() },
    { query: { enabled: section === 'reports' && can('reports.view') } },
  );
  const employees = useListEmployeesV2({ query: { enabled: section === 'staff' && can('employees.view') } });
  const payroll = useListPayrollV2({ query: { enabled: section === 'staff' && can('payroll.view') } });
  const subscriptions = useListOperationalSubscriptions(undefined, {
    query: { enabled: (section === 'reminders' || notificationsEnabled) && can('subscriptions.view') },
  });
  const members = useListMembers(undefined, {
    query: { enabled: section === 'reminders' && can('members.view') },
  });
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const createEmployee = useCreateEmployeeV2();
  const createPayroll = useCreatePayrollV2();
  const payPayroll = useRecordPayrollPayment();
  const employeeChoices = employees.data ?? [];

  useEffect(() => {
    void getMembershipNotificationsEnabled().then(setNotificationsEnabled);
  }, []);

  useEffect(() => {
    if (notificationsEnabled && subscriptions.data) {
      void syncMembershipNotifications(subscriptions.data.map((item) => ({ subscriptionId: item.id, endDate: item.endDate })));
    }
  }, [notificationsEnabled, subscriptions.data]);

  const refresh = () => void queryClient.invalidateQueries();
  const hasSectionPermission = {
    plans: can('plans.view'),
    reports: can('reports.view'),
    staff: can('employees.view') || can('payroll.view'),
    reminders: can('subscriptions.view') && can('members.view'),
    settings: true,
  };

  const toggleNotifications = async (next: boolean) => {
    setFormError('');
    if (!next) {
      await setMembershipNotificationsEnabled(false);
      setNotificationsEnabled(false);
      return;
    }
    try {
      const granted = await requestMembershipNotificationPermission();
      if (!granted) {
        Alert.alert('الإشعارات غير مفعّلة', 'اسمح بإشعارات التطبيق من إعدادات الهاتف ثم أعد المحاولة.');
        return;
      }
      await setMembershipNotificationsEnabled(true);
      setNotificationsEnabled(true);
      if (subscriptions.data) await syncMembershipNotifications(subscriptions.data.map((item) => ({ subscriptionId: item.id, endDate: item.endDate })));
    } catch (error) {
      setFormError(errorMessage(error, 'تعذر تفعيل إشعارات الاشتراك.'));
    }
  };

  const submitPlan = () => {
    const days = Number(planDays);
    const price = Number(planPrice.replace(',', '.'));
    if (planName.trim().length < 2 || !Number.isInteger(days) || days < 1 || !Number.isFinite(price) || price < 0) {
      setFormError('أدخل اسم الباقة ومدتها وسعرًا صحيحًا.');
      return;
    }
    createPlan.mutate(
      { data: { name: planName.trim(), durationDays: days, priceFils: Math.round(price * 1000), active: true } },
      {
        onSuccess: async () => {
          setPlanName('');
          setPlanDays('30');
          setPlanPrice('');
          setShowPlanForm(false);
          setFormError('');
          await queryClient.invalidateQueries();
          Alert.alert('تمت الإضافة', 'تم حفظ الباقة في قاعدة البيانات.');
        },
        onError: (error) => setFormError(errorMessage(error, 'تعذر حفظ الباقة.')),
      },
    );
  };

  const submitEmployee = () => {
    const salary = Number(employeeSalary.replace(',', '.'));
    if (employeeName.trim().length < 2 || employeePosition.trim().length < 2 || !Number.isFinite(salary) || salary < 0) {
      setFormError('أدخل اسم الموظف والمسمى والراتب الأساسي بشكل صحيح.');
      return;
    }
    createEmployee.mutate(
      {
        data: {
          name: employeeName.trim(),
          position: employeePosition.trim(),
          phone: employeePhone.trim() || null,
          baseSalaryFils: Math.round(salary * 1000),
        },
      },
      {
        onSuccess: async () => {
          setEmployeeName('');
          setEmployeePosition('');
          setEmployeePhone('');
          setEmployeeSalary('');
          setShowEmployeeForm(false);
          setFormError('');
          await queryClient.invalidateQueries();
          Alert.alert('تمت الإضافة', 'تم حفظ الموظف.');
        },
        onError: (error) => setFormError(errorMessage(error, 'تعذر حفظ الموظف.')),
      },
    );
  };

  const submitPayroll = () => {
    const amount = Number(payrollAmount.replace(',', '.'));
    if (!payrollEmployeeId || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(payrollPeriod) || !/^\d{4}-\d{2}-\d{2}$/.test(payrollDueDate)) {
      setFormError('اختر الموظف وأدخل الفترة والمبلغ وتاريخ الاستحقاق بشكل صحيح.');
      return;
    }
    createPayroll.mutate(
      { data: { employeeId: payrollEmployeeId, period: payrollPeriod, amountFils: Math.round(amount * 1000), dueDate: payrollDueDate } },
      {
        onSuccess: async () => {
          setPayrollAmount('');
          setShowPayrollForm(false);
          setFormError('');
          await queryClient.invalidateQueries();
          Alert.alert('تم التسجيل', 'تمت إضافة استحقاق الراتب.');
        },
        onError: (error) => setFormError(errorMessage(error, 'تعذر تسجيل الراتب.')),
      },
    );
  };

  const sendManualReminder = async (memberId: number, name: string, phone: string, endDate: string) => {
    const digits = phone.replace(/\D/g, '');
    const international = digits.startsWith('0') ? `962${digits.slice(1)}` : digits.startsWith('962') ? digits : `962${digits}`;
    const message = `مرحبًا ${name}، نذكّرك بأن موعد انتهاء الاشتراك هو ${endDate}. يسعدنا تجديد اشتراكك في Prime Boxing Academy.`;
    const url = `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('تعذر فتح واتساب', 'تأكد من تثبيت واتساب أو توفر متصفح على الجهاز.');
    }
  };

  const shareReport = async () => {
    if (!financeReport.data) return;
    try {
      await shareFinanceReport(financeReport.data);
    } catch (error) {
      Alert.alert('تعذر مشاركة التقرير', errorMessage(error, 'حاول مرة أخرى.'));
    }
  };

  const payFullPayroll = (id: number, amount: number) => {
    Alert.alert('تأكيد دفع الراتب', `سيتم تسجيل دفعة بمبلغ ${formatJod(amount)}.`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تأكيد الدفع',
        onPress: () => payPayroll.mutate(
          { id, data: { amountFils: amount, method: 'cash' } },
          { onSuccess: refresh, onError: (error) => Alert.alert('تعذر الدفع', errorMessage(error)) },
        ),
      },
    ]);
  };

  const goBack = () => setSection('home');
  return (
    <AppScreen
      refreshControl={
        <RefreshControl
          refreshing={plans.isFetching || financeReport.isFetching || employees.isFetching || payroll.isFetching || subscriptions.isFetching}
          onRefresh={refresh}
          tintColor={colors.gold}
        />
      }
    >
      <View style={styles.heading}>
        <View style={{ flex: 1 }}>
          <Text muted style={styles.eyebrow}>{section === 'home' ? 'حساب الأكاديمية' : 'إدارة الأكاديمية'}</Text>
          <Text weight="bold" style={styles.title}>{section === 'home' ? 'المزيد والإعدادات' : sectionTitle(section)}</Text>
        </View>
        {section !== 'home' ? <ActionButton title="رجوع" variant="outline" icon="arrow-forward-outline" onPress={goBack} /> : <IconBadge name="settings-outline" size={23} />}
      </View>

      {section === 'home' ? (
        <>
          <Card style={styles.profileCard}>
            <IconBadge name="person-circle-outline" size={24} />
            <View style={{ flex: 1 }}>
              <Text weight="semibold" style={styles.profileName}>{session?.email || 'حساب الأكاديمية'}</Text>
              <Text muted style={styles.profileRole}>{session?.isOwner ? 'مدير الأكاديمية' : session?.role || 'موظف'}</Text>
            </View>
            <StatusBadge label={session?.isOwner ? 'مدير' : 'حساب مفعل'} tone="success" />
          </Card>

          {hasSectionPermission.plans ? <MenuItem title="الباقات" description="عرض الباقات وأسعارها" icon="layers-outline" onPress={() => setSection('plans')} /> : null}
          {hasSectionPermission.reports ? <MenuItem title="التقارير المالية" description="تقارير PDF حسب الفترة" icon="bar-chart-outline" onPress={() => setSection('reports')} /> : null}
          {hasSectionPermission.staff ? <MenuItem title="الموظفون والرواتب" description="ملفات الموظفين والاستحقاقات" icon="briefcase-outline" onPress={() => setSection('staff')} /> : null}
          {hasSectionPermission.reminders ? <MenuItem title="تذكيرات واتساب" description="إرسال يدوي عبر واتساب العادي" icon="logo-whatsapp" onPress={() => setSection('reminders')} /> : null}
          <MenuItem title="الإشعارات على الهاتف" description="تذكيرات محلية للاشتراكات فقط" icon="notifications-outline" onPress={() => setSection('settings')} />
          <MenuItem title="إعدادات الحساب" description="الصلاحيات محفوظة على الخادم" icon="shield-checkmark-outline" onPress={() => setSection('settings')} />
          <ActionButton
            title="تسجيل الخروج"
            variant="outline"
            icon="log-out-outline"
            onPress={() => Alert.alert('تسجيل الخروج', 'هل تريد إنهاء الجلسة؟', [
              { text: 'إلغاء', style: 'cancel' },
              { text: 'تسجيل الخروج', style: 'destructive', onPress: () => void logout() },
            ])}
          />
        </>
      ) : null}

      {section === 'plans' ? (
        can('plans.view') ? (
          <>
            {can('plans.create') ? <ActionButton title={showPlanForm ? 'إخفاء النموذج' : 'إضافة باقة'} icon="add-outline" onPress={() => setShowPlanForm((value) => !value)} /> : null}
            {showPlanForm ? (
              <Card>
                <Field label="اسم الباقة" value={planName} onChangeText={setPlanName} placeholder="مثال: شهري" />
                <Field label="المدة بالأيام" value={planDays} onChangeText={setPlanDays} keyboardType="number-pad" />
                <Field label="السعر بالدينار" value={planPrice} onChangeText={setPlanPrice} keyboardType="decimal-pad" placeholder="0.000" />
                {formError ? <Text color={colors.destructive} style={styles.error}>{formError}</Text> : null}
                <ActionButton title="حفظ الباقة" loading={createPlan.isPending} onPress={submitPlan} />
              </Card>
            ) : null}
            <Card>
              <SectionTitle title="الباقات الحالية" subtitle="الأسعار والمدد من قاعدة البيانات" />
              {plans.isLoading ? <LoadingState /> : plans.error ? <ErrorState message="تعذر تحميل الباقات." onRetry={() => void plans.refetch()} /> : plans.data?.length ? plans.data.map((plan) => (
                <View key={plan.id} style={[styles.listRow, { borderTopColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text weight="semibold" style={styles.rowTitle}>{plan.name}</Text>
                    <Text muted style={styles.rowSub}>{plan.durationDays} يوم · {formatJod(plan.priceFils)}</Text>
                  </View>
                  <StatusBadge label={plan.active ? 'فعالة' : 'موقوفة'} tone={plan.active ? 'success' : 'neutral'} />
                  {can('plans.edit') ? <Pressable onPress={() => updatePlan.mutate({ id: plan.id, data: { active: !plan.active } }, { onSuccess: refresh, onError: (error) => Alert.alert('تعذر تحديث الباقة', errorMessage(error)) })}><Text color={colors.gold} style={styles.smallLink}>{plan.active ? 'إيقاف' : 'تفعيل'}</Text></Pressable> : null}
                </View>
              )) : <EmptyState title="لا توجد باقات" message="لم تُسجل باقات في النظام." icon="layers-outline" />}
            </Card>
          </>
        ) : <ErrorState message="ليس لديك صلاحية لعرض الباقات." />
      ) : null}

      {section === 'reports' ? (
        can('reports.view') ? (
          <Card>
            <SectionTitle title="التقرير المالي الشهري" subtitle="يُنشأ من بيانات الفترة المختارة في النظام." />
            {financeReport.isLoading ? <LoadingState /> : financeReport.error ? <ErrorState message="تعذر تحميل التقرير." onRetry={() => void financeReport.refetch()} /> : financeReport.data ? (
              <>
                <Text muted style={styles.reportPeriod}>{formatJordanDate(financeReport.data.fromDate)} — {formatJordanDate(financeReport.data.toDate)}</Text>
                <View style={styles.reportRows}>
                  <ReportRow label="الإيرادات" value={formatJod(financeReport.data.incomeFils)} />
                  <ReportRow label="المصاريف" value={formatJod(financeReport.data.expenseFils)} />
                  <ReportRow label="صافي النتيجة" value={formatJod(financeReport.data.netFils)} />
                  <ReportRow label="رواتب مستحقة" value={formatJod(financeReport.data.payrollOutstandingFils)} />
                  <ReportRow label="رصيد الصندوق" value={formatJod(financeReport.data.cashBalanceFils)} />
                </View>
                <ActionButton title="تصدير ومشاركة PDF" icon="share-outline" onPress={shareReport} />
              </>
            ) : <EmptyState title="لا توجد بيانات للتقرير" message="سجّل الحركات المالية لعرضها هنا." icon="bar-chart-outline" />}
          </Card>
        ) : <ErrorState message="ليس لديك صلاحية لعرض التقارير المالية." />
      ) : null}

      {section === 'staff' ? (
        <>
          {can('employees.create') ? <ActionButton title={showEmployeeForm ? 'إخفاء نموذج الموظف' : 'إضافة موظف'} icon="person-add-outline" onPress={() => setShowEmployeeForm((value) => !value)} /> : null}
          {showEmployeeForm ? (
            <Card>
              <SectionTitle title="موظف جديد" />
              <Field label="الاسم" value={employeeName} onChangeText={setEmployeeName} />
              <Field label="المسمى الوظيفي" value={employeePosition} onChangeText={setEmployeePosition} />
              <Field label="رقم الهاتف" value={employeePhone} onChangeText={setEmployeePhone} keyboardType="phone-pad" />
              <Field label="الراتب الأساسي بالدينار" value={employeeSalary} onChangeText={setEmployeeSalary} keyboardType="decimal-pad" />
              {formError ? <Text color={colors.destructive} style={styles.error}>{formError}</Text> : null}
              <ActionButton title="حفظ الموظف" loading={createEmployee.isPending} onPress={submitEmployee} />
            </Card>
          ) : null}
          {can('employees.view') ? (
            <Card>
              <SectionTitle title="الموظفون" subtitle={`${employees.data?.length ?? 0} موظف`} />
              {employees.isLoading ? <LoadingState /> : employees.error ? <ErrorState message="تعذر تحميل الموظفين." onRetry={() => void employees.refetch()} /> : employees.data?.length ? employees.data.map((employee) => (
                <View key={employee.id} style={[styles.listRow, { borderTopColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text weight="semibold" style={styles.rowTitle}>{employee.name}</Text>
                    <Text muted style={styles.rowSub}>{employee.position} · {formatJod(employee.baseSalaryFils)} شهريًا</Text>
                  </View>
                  <StatusBadge label={employee.active ? 'فعال' : 'موقوف'} tone={employee.active ? 'success' : 'neutral'} />
                </View>
              )) : <EmptyState title="لا يوجد موظفون" message="أضف الموظفين المخولين لإدارة النظام." icon="briefcase-outline" />}
            </Card>
          ) : null}
          {can('payroll.view') ? (
            <>
              {can('payroll.create') ? <ActionButton title={showPayrollForm ? 'إخفاء نموذج الراتب' : 'إضافة استحقاق راتب'} icon="add-outline" variant="outline" onPress={() => setShowPayrollForm((value) => !value)} /> : null}
              {showPayrollForm ? (
                <Card>
                  <SectionTitle title="استحقاق راتب جديد" />
                  <Text weight="semibold" style={styles.formLabel}>اختر الموظف</Text>
                  <View style={styles.choiceList}>
                    {employeeChoices.filter((employee) => employee.active).map((employee) => (
                      <Pressable key={employee.id} onPress={() => setPayrollEmployeeId(employee.id)} style={[styles.choice, { borderColor: payrollEmployeeId === employee.id ? colors.gold : colors.border, backgroundColor: payrollEmployeeId === employee.id ? colors.accent : colors.background }]}>
                        <Text style={styles.choiceText}>{employee.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Field label="الفترة (YYYY-MM)" value={payrollPeriod} onChangeText={setPayrollPeriod} />
                  <Field label="المبلغ بالدينار" value={payrollAmount} onChangeText={setPayrollAmount} keyboardType="decimal-pad" />
                  <Field label="تاريخ الاستحقاق" value={payrollDueDate} onChangeText={setPayrollDueDate} />
                  {formError ? <Text color={colors.destructive} style={styles.error}>{formError}</Text> : null}
                  <ActionButton title="حفظ الاستحقاق" loading={createPayroll.isPending} onPress={submitPayroll} />
                </Card>
              ) : null}
              <Card>
                <SectionTitle title="الرواتب المستحقة" subtitle={`${payroll.data?.length ?? 0} سجل`} />
                {payroll.isLoading ? <LoadingState /> : payroll.error ? <ErrorState message="تعذر تحميل الرواتب." onRetry={() => void payroll.refetch()} /> : payroll.data?.length ? payroll.data.map((item) => (
                  <View key={item.id} style={[styles.listRow, { borderTopColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text weight="semibold" style={styles.rowTitle}>{item.employeeName}</Text>
                      <Text muted style={styles.rowSub}>{item.period} · مستحق {formatJordanDate(item.dueDate)}</Text>
                      <Text muted style={styles.rowSub}>متبقي: {formatJod(item.outstandingFils)}</Text>
                    </View>
                    <View style={styles.payActions}>
                      <StatusBadge label={item.status === 'paid' ? 'مدفوع' : item.status === 'partial' ? 'جزئي' : 'مستحق'} tone={item.status === 'paid' ? 'success' : 'warning'} />
                      {item.outstandingFils > 0 && can('payroll.approve') ? <Pressable onPress={() => payFullPayroll(item.id, item.outstandingFils)}><Text color={colors.gold} style={styles.smallLink}>دفع المتبقي</Text></Pressable> : null}
                    </View>
                  </View>
                )) : <EmptyState title="لا توجد رواتب" message="لم تُسجل استحقاقات في النظام." icon="cash-outline" />}
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      {section === 'reminders' ? (
        can('members.view') && can('subscriptions.view') ? (
          <Card>
            <SectionTitle title="تذكيرات واتساب اليدوية" subtitle="لا يوجد إرسال تلقائي أو إرسال من الخادم." />
            <Text muted style={styles.help}>اختيار التذكير يفتح واتساب العادي مع رسالة جاهزة؛ راجعها ثم أرسلها بنفسك.</Text>
            {subscriptions.isLoading || members.isLoading ? <LoadingState /> : subscriptions.error || members.error ? <ErrorState message="تعذر تحميل بيانات التذكيرات." onRetry={refresh} /> : (() => {
              const now = new Date();
              const near = (subscriptions.data ?? []).filter((subscription) => {
                if (subscription.status !== 'active') return false;
                const end = new Date(`${subscription.endDate}T12:00:00.000Z`);
                const days = Math.ceil((end.getTime() - now.getTime()) / 86400000);
                return days >= 0 && days <= 2;
              });
              const membersById = new Map((members.data ?? []).map((member) => [member.id, member]));
              return near.length ? near.map((subscription) => {
                const member = membersById.get(subscription.memberId);
                if (!member) return null;
                return (
                  <View key={subscription.id} style={[styles.listRow, { borderTopColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text weight="semibold" style={styles.rowTitle}>{member.name}</Text>
                      <Text muted style={styles.rowSub}>{member.phone} · ينتهي {formatJordanDate(subscription.endDate)}</Text>
                    </View>
                    <ActionButton title="فتح واتساب" icon="logo-whatsapp" onPress={() => void sendManualReminder(member.id, member.name, member.phone, subscription.endDate)} />
                  </View>
                );
              }) : <EmptyState title="لا توجد تذكيرات مستحقة" message="لا توجد اشتراكات نشطة تنتهي خلال اليومين القادمين." icon="logo-whatsapp" />;
            })()}
          </Card>
        ) : <ErrorState message="تحتاج صلاحية عرض المشتركين والاشتراكات." />
      ) : null}

      {section === 'settings' ? (
        <>
          {can('subscriptions.view') ? (
            <Card>
              <SectionTitle title="إشعارات انتهاء الاشتراك" subtitle="تنبيه محلي على هذا الجهاز فقط، وليس رسالة واتساب." />
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text weight="semibold" style={styles.rowTitle}>تنبيه قبل يومين ويوم الانتهاء</Text>
                  <Text muted style={styles.rowSub}>يُجدول بعد السماح بالإشعارات وتحديث بيانات الاشتراكات.</Text>
                </View>
                <Switch value={notificationsEnabled} onValueChange={toggleNotifications} thumbColor={notificationsEnabled ? colors.gold : colors.mutedForeground} trackColor={{ true: colors.primary, false: colors.border }} />
              </View>
              {formError ? <Text color={colors.destructive} style={styles.error}>{formError}</Text> : null}
              <Text muted style={styles.privacyNote}>تظهر الإشعارات بصياغة عامة ولا تعرض اسم المشترك أو رقم هاتفه على شاشة القفل.</Text>
            </Card>
          ) : null}
          <Card>
            <SectionTitle title="حماية الحساب" subtitle="كل طلب بيانات يمر عبر API وصلاحيات الخادم." />
            <Text muted style={styles.help}>لا تُخزن بيانات مالية أو سجلات المشتركين على الهاتف للعمل دون اتصال. يلزم الإنترنت لعرض البيانات وتعديلها.</Text>
            <ActionButton title="تسجيل الخروج" variant="outline" icon="log-out-outline" onPress={() => void logout()} />
          </Card>
        </>
      ) : null}

      {section !== 'home' && !hasSectionPermission[section] && section !== 'settings' ? <ErrorState message="ليس لديك صلاحية لهذا القسم." /> : null}
    </AppScreen>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.reportRow, { borderTopColor: colors.border }]}>
      <Text weight="semibold" style={styles.reportValue}>{value}</Text>
      <Text muted style={styles.reportLabel}>{label}</Text>
    </View>
  );
}

function sectionTitle(section: Section) {
  return {
    home: 'المزيد والإعدادات',
    plans: 'الباقات',
    reports: 'التقارير المالية',
    staff: 'الموظفون والرواتب',
    reminders: 'تذكيرات واتساب',
    settings: 'الإعدادات',
  }[section];
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 3 },
  eyebrow: { textAlign: 'right', fontSize: 11 },
  title: { textAlign: 'right', fontSize: 22, marginTop: 2 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileName: { textAlign: 'right', fontSize: 12 },
  profileRole: { textAlign: 'right', fontSize: 11, marginTop: 3 },
  menuItem: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderWidth: 1, borderRadius: 17, backgroundColor: '#1b2722' },
  menuTitle: { textAlign: 'right', fontSize: 13 },
  menuDescription: { textAlign: 'right', fontSize: 10, marginTop: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 11, gap: 9 },
  rowTitle: { textAlign: 'right', fontSize: 12 },
  rowSub: { textAlign: 'right', fontSize: 10, marginTop: 3 },
  smallLink: { fontSize: 11, paddingHorizontal: 3 },
  reportPeriod: { textAlign: 'right', fontSize: 11 },
  reportRows: { gap: 0 },
  reportRow: { minHeight: 43, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  reportValue: { fontSize: 12 },
  reportLabel: { fontSize: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  privacyNote: { textAlign: 'right', fontSize: 10, lineHeight: 18 },
  help: { textAlign: 'right', fontSize: 12, lineHeight: 21 },
  error: { textAlign: 'center', fontSize: 12 },
  formLabel: { textAlign: 'right', fontSize: 12 },
  choiceList: { gap: 7 },
  choice: { borderWidth: 1, borderRadius: 12, padding: 9 },
  choiceText: { textAlign: 'right', fontSize: 12 },
  payActions: { alignItems: 'flex-end', gap: 7 },
});
