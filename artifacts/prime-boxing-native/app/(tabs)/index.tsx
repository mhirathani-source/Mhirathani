import React, { useEffect, useMemo } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useGetClubDashboard, useGetClubOverview } from '@workspace/api-client-react';
import { ActionButton, AppScreen, Card, ErrorState, IconBadge, LoadingState, SectionTitle, StatusBadge, Text, formatJod, formatJordanDate } from '@/components/prime-ui';
import { useClubAccess } from '@/src/access';
import { useColors } from '@/hooks/useColors';
import { getMembershipNotificationsEnabled, syncMembershipNotifications } from '@/src/notifications';

function MetricCard({ title, value, icon, tone }: { title: string; value: string | number; icon: React.ComponentProps<typeof IconBadge>['name']; tone?: 'gold' | 'green' | 'red' }) {
  const colors = useColors();
  const iconColor = tone === 'red' ? colors.destructive : tone === 'green' ? colors.success : colors.gold;
  return (
    <Card style={styles.metricCard}>
      <IconBadge name={icon} color={iconColor} />
      <Text muted style={styles.metricTitle}>{title}</Text>
      <Text weight="bold" style={styles.metricValue}>{value}</Text>
    </Card>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, can } = useClubAccess();
  const colors = useColors();
  const financialDashboard = can('dashboard.view', 'members.view', 'payments.view', 'reports.view');
  const overview = useGetClubOverview({ query: { enabled: !financialDashboard && can('dashboard.view') } });
  const dashboard = useGetClubDashboard({ query: { enabled: financialDashboard } });
  const data = dashboard.data;
  const loading = financialDashboard ? dashboard.isLoading : overview.isLoading;
  const error = financialDashboard ? dashboard.error : overview.error;

  useEffect(() => {
    if (!data?.expiringSubscriptions) return;
    void getMembershipNotificationsEnabled().then((enabled) => {
      if (enabled) void syncMembershipNotifications(data.expiringSubscriptions);
    });
  }, [data?.expiringSubscriptions]);

  const month = useMemo(() => data?.monthlySeries?.at(-1), [data?.monthlySeries]);
  const maximumBar = useMemo(
    () => Math.max(1, ...(data?.monthlySeries ?? []).map((item) => item.incomeFils + item.expensesFils)),
    [data?.monthlySeries],
  );

  if (!can('dashboard.view')) {
    return <AppScreen><ErrorState message="ليس لديك صلاحية لعرض لوحة التحكم." /></AppScreen>;
  }

  return (
    <AppScreen
      refreshControl={
        <RefreshControl
          refreshing={financialDashboard ? dashboard.isFetching : overview.isFetching}
          onRefresh={() => void queryClient.invalidateQueries()}
          tintColor={colors.gold}
        />
      }
    >
      <View style={styles.welcomeRow}>
        <View style={{ flex: 1 }}>
          <Text muted style={styles.eyebrow}>PRIME BOXING ACADEMY</Text>
          <Text weight="bold" style={styles.welcome}>أهلاً، {session?.email?.split('@')[0] || 'مرحباً'}</Text>
          <Text muted style={styles.date}>{formatJordanDate(new Date())} · إدارة الأكاديمية</Text>
        </View>
        <IconBadge name="shield-checkmark-outline" size={23} />
      </View>

      <Card style={styles.hero}>
        <View style={styles.heroDecor} />
        <Text weight="semibold" color={colors.gold} style={styles.heroKicker}>ملخص الأكاديمية</Text>
        <Text weight="bold" style={styles.heroTitle}>إدارة واضحة، أداء أقوى</Text>
        <Text muted style={styles.heroBody}>بيانات مباشرة من نظام Prime Boxing Academy، مع صلاحيات محفوظة على الخادم.</Text>
        <View style={styles.heroActions}>
          {can('members.create') ? <ActionButton title="إضافة مشترك" icon="person-add-outline" onPress={() => router.push('/add-member')} /> : null}
          {can('subscriptions.create') ? <ActionButton title="اشتراك جديد" variant="outline" icon="add-circle-outline" onPress={() => router.push('/create-subscription')} /> : null}
        </View>
      </Card>

      {loading ? <LoadingState /> : error ? (
        <ErrorState message="تعذر تحميل ملخص الأكاديمية من الخادم." onRetry={() => void queryClient.invalidateQueries()} />
      ) : financialDashboard && data ? (
        <>
          <SectionTitle title="مؤشرات اليوم" subtitle="الأرقام محدثة من قاعدة بيانات الأكاديمية" />
          <View style={styles.metrics}>
            <MetricCard title="الإيرادات المحصلة" value={formatJod(data.collectedFils)} icon="cash-outline" />
            <MetricCard title="المشتركون النشطون" value={data.activeMembers} icon="people-outline" tone="green" />
            <MetricCard title="تنتهي خلال أسبوع" value={data.endingWithin7Days} icon="calendar-outline" tone="gold" />
            <MetricCard title="إجمالي المشتركين" value={data.totalMembers} icon="person-outline" />
          </View>

          <Card>
            <SectionTitle title="حركة الشهر" subtitle={month?.month ?? 'لا توجد بيانات شهرية'} />
            {month ? (
              <>
                <View style={styles.chartRow}>
                  <View style={styles.chartLegend}>
                    <Text muted style={styles.legendText}>الإيرادات</Text>
                    <Text weight="semibold" style={styles.legendValue}>{formatJod(month.incomeFils)}</Text>
                  </View>
                  <View style={styles.chartLegend}>
                    <Text muted style={styles.legendText}>المصاريف</Text>
                    <Text weight="semibold" style={styles.legendValue}>{formatJod(month.expensesFils)}</Text>
                  </View>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.incomeBar, { width: `${Math.max(4, (month.incomeFils / maximumBar) * 100)}%` }]} />
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.expenseBar, { width: `${Math.max(4, (month.expensesFils / maximumBar) * 100)}%` }]} />
                </View>
                <Text muted style={styles.netText}>صافي الشهر: {formatJod(month.netFils)}</Text>
              </>
            ) : <Text muted>لا توجد حركات مسجلة لهذا الشهر.</Text>}
          </Card>

          <Card>
            <SectionTitle title="اشتراكات قريبة من الانتهاء" subtitle={`${data.expiringSubscriptions.length} اشتراك`} />
            {data.expiringSubscriptions.length ? data.expiringSubscriptions.slice(0, 5).map((item) => (
              <View key={item.subscriptionId} style={styles.alertRow}>
                <View style={{ flex: 1 }}>
                  <Text weight="semibold" style={styles.rowTitle}>{item.memberName}</Text>
                  <Text muted style={styles.rowDetail}>{item.planName} · ينتهي {formatJordanDate(item.endDate)}</Text>
                </View>
                <StatusBadge label={item.daysRemaining === 0 ? 'اليوم' : `${item.daysRemaining} يوم`} tone={item.daysRemaining <= 2 ? 'warning' : 'neutral'} />
              </View>
            )) : <Text muted>لا توجد اشتراكات قريبة من الانتهاء.</Text>}
          </Card>
        </>
      ) : (
        <>
          <SectionTitle title="حالة الأكاديمية" subtitle="لا تُعرض بيانات مالية لهذا الدور" />
          <View style={styles.metrics}>
            <MetricCard title="المشتركون النشطون" value={overview.data?.activeMembers ?? 0} icon="people-outline" tone="green" />
            <MetricCard title="تنتهي قريبًا" value={overview.data?.endingSoon ?? 0} icon="calendar-outline" tone="gold" />
            <MetricCard title="اشتراكات منتهية" value={overview.data?.expiredSubscriptions ?? 0} icon="alert-circle-outline" tone="red" />
          </View>
          <Card>
            <SectionTitle title="العمليات اليومية" subtitle="اختصارات حسب الصلاحيات الممنوحة لحسابك" />
            <View style={styles.quickLinks}>
              {can('members.view') ? <ActionButton title="المشتركون" variant="outline" icon="people-outline" onPress={() => router.push('/(tabs)/members')} /> : null}
              {can('subscriptions.view') ? <ActionButton title="الاشتراكات" variant="outline" icon="ribbon-outline" onPress={() => router.push('/(tabs)/subscriptions')} /> : null}
            </View>
          </Card>
        </>
      )}

      <Text muted style={styles.footer}>تتطلب مزامنة البيانات والعمليات اتصالًا بالإنترنت.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 3, paddingBottom: 3 },
  eyebrow: { fontSize: 10, letterSpacing: 1.5, textAlign: 'right' },
  welcome: { fontSize: 23, textAlign: 'right', marginTop: 3 },
  date: { fontSize: 12, textAlign: 'right', marginTop: 2 },
  hero: { overflow: 'hidden', padding: 19, backgroundColor: '#1b3026' },
  heroDecor: { position: 'absolute', width: 170, height: 170, borderRadius: 100, borderWidth: 1, borderColor: '#dbb96133', left: -35, top: -50 },
  heroKicker: { textAlign: 'right', fontSize: 11, letterSpacing: 1 },
  heroTitle: { textAlign: 'right', fontSize: 22, marginTop: 5 },
  heroBody: { textAlign: 'right', lineHeight: 22, fontSize: 12, marginTop: 4 },
  heroActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', flexGrow: 1, minHeight: 132, padding: 13, gap: 4 },
  metricTitle: { fontSize: 11, textAlign: 'right' },
  metricValue: { fontSize: 18, textAlign: 'right', writingDirection: 'rtl' },
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 },
  chartLegend: { flex: 1, gap: 2 },
  legendText: { fontSize: 11, textAlign: 'right' },
  legendValue: { fontSize: 13, textAlign: 'right' },
  barTrack: { height: 9, width: '100%', borderRadius: 99, backgroundColor: '#35463d', overflow: 'hidden' },
  incomeBar: { height: '100%', backgroundColor: '#dbb961', borderRadius: 99, alignSelf: 'flex-end' },
  expenseBar: { height: '100%', backgroundColor: '#d46c68', borderRadius: 99, alignSelf: 'flex-end' },
  netText: { textAlign: 'right', fontSize: 12 },
  alertRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#35463d', paddingTop: 11, gap: 8 },
  rowTitle: { textAlign: 'right', fontSize: 13 },
  rowDetail: { textAlign: 'right', fontSize: 11, marginTop: 3 },
  quickLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { textAlign: 'center', fontSize: 11, paddingVertical: 4 },
});
