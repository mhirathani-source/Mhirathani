import React, { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useActOnOperationalSubscription, useListOperationalSubscriptions } from '@workspace/api-client-react';
import { ActionButton, AppScreen, Card, EmptyState, ErrorState, Field, IconBadge, LoadingState, SectionTitle, StatusBadge, Text, formatJordanDate, errorMessage } from '@/components/prime-ui';
import { useClubAccess } from '@/src/access';
import { useColors } from '@/hooks/useColors';
import { getMembershipNotificationsEnabled, syncMembershipNotifications } from '@/src/notifications';

const statusLabel: Record<string, string> = { active: 'نشط', paused: 'متوقف مؤقتًا', expired: 'منتهي', cancelled: 'ملغي' };

export default function SubscriptionsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useColors();
  const { can } = useClubAccess();
  const [search, setSearch] = useState('');
  const subscriptions = useListOperationalSubscriptions(undefined, { query: { enabled: can('subscriptions.view') } });
  const action = useActOnOperationalSubscription();
  const filtered = useMemo(
    () => (subscriptions.data ?? []).filter((row) => `${row.memberName} ${row.planName}`.toLowerCase().includes(search.trim().toLowerCase())),
    [subscriptions.data, search],
  );

  React.useEffect(() => {
    if (!subscriptions.data) return;
    void getMembershipNotificationsEnabled().then((enabled) => {
      if (enabled) void syncMembershipNotifications(subscriptions.data.map((item) => ({ subscriptionId: item.id, endDate: item.endDate })));
    });
  }, [subscriptions.data]);

  if (!can('subscriptions.view')) {
    return <AppScreen><ErrorState message="ليس لديك صلاحية لعرض الاشتراكات." /></AppScreen>;
  }

  const runAction = (id: number, command: 'pause' | 'resume' | 'renew' | 'cancel', planId?: number) => {
    const perform = () => action.mutate(
      { id, data: { action: command, ...(planId ? { planId } : {}) } },
      {
        onSuccess: () => void queryClient.invalidateQueries(),
        onError: (error) => Alert.alert('تعذر تنفيذ العملية', errorMessage(error)),
      },
    );
    if (command === 'cancel') {
      Alert.alert('إلغاء الاشتراك', 'هل تريد إلغاء هذا الاشتراك؟ لن تُحذف بياناته أو سجل دفعاته.', [
        { text: 'رجوع', style: 'cancel' },
        { text: 'إلغاء الاشتراك', style: 'destructive', onPress: perform },
      ]);
    } else perform();
  };

  return (
    <AppScreen
      refreshControl={
        <RefreshControl refreshing={subscriptions.isFetching} onRefresh={() => void subscriptions.refetch()} tintColor={colors.gold} />
      }
    >
      <View style={styles.headingRow}>
        <View style={{ flex: 1 }}>
          <Text muted style={styles.eyebrow}>إدارة العضويات</Text>
          <Text weight="bold" style={styles.title}>الاشتراكات</Text>
          <Text muted style={styles.subtitle}>{subscriptions.data?.length ?? 0} اشتراك</Text>
        </View>
        <IconBadge name="ribbon-outline" size={23} />
      </View>
      {can('subscriptions.create') ? <ActionButton title="بدء اشتراك جديد" icon="add-circle-outline" onPress={() => router.push('/create-subscription')} /> : null}
      <Card>
        <SectionTitle title="قائمة الاشتراكات" subtitle="الإجراءات المتاحة تعتمد على صلاحية حسابك." />
        <Field label="ابحث باسم المشترك أو الباقة" value={search} onChangeText={setSearch} placeholder="اسم المشترك أو الباقة" />
        {subscriptions.isLoading ? <LoadingState /> : subscriptions.error ? (
          <ErrorState message="تعذر تحميل الاشتراكات." onRetry={() => void subscriptions.refetch()} />
        ) : filtered.length ? filtered.map((item) => (
          <View key={item.id} style={[styles.subscriptionCard, { borderColor: colors.border }]}>
            <View style={styles.subscriptionHeading}>
              <View style={{ flex: 1 }}>
                <Text weight="semibold" style={styles.memberName}>{item.memberName}</Text>
                <Text muted style={styles.planName}>{item.planName} · رقم {item.id}</Text>
              </View>
              <StatusBadge
                label={statusLabel[item.status] ?? item.status}
                tone={item.status === 'active' ? 'success' : item.status === 'expired' ? 'danger' : 'warning'}
              />
            </View>
            <View style={styles.dates}>
              <Text muted style={styles.dateText}>من {formatJordanDate(item.startDate)}</Text>
              <Text muted style={styles.dateText}>إلى {formatJordanDate(item.endDate)}</Text>
            </View>
            <Pressable onPress={() => router.push(`/member/${item.memberId}`)} style={styles.profileLink}>
              <Text weight="semibold" color={colors.gold} style={styles.linkText}>فتح ملف المشترك</Text>
            </Pressable>
            <View style={styles.actions}>
              {item.status === 'active' && can('subscriptions.edit') ? <ActionButton title="إيقاف مؤقت" variant="outline" icon="pause-outline" onPress={() => runAction(item.id, 'pause')} /> : null}
              {item.status === 'paused' && can('subscriptions.edit') ? <ActionButton title="استئناف" variant="outline" icon="play-outline" onPress={() => runAction(item.id, 'resume')} /> : null}
              {can('subscriptions.create') ? <ActionButton title="تجديد" icon="refresh-outline" onPress={() => runAction(item.id, 'renew', item.planId)} /> : null}
              {item.status !== 'cancelled' && can('subscriptions.delete') ? <ActionButton title="إلغاء" variant="danger" icon="close-outline" onPress={() => runAction(item.id, 'cancel')} /> : null}
            </View>
          </View>
        )) : <EmptyState title="لا توجد اشتراكات" message={search ? 'لم يطابق البحث أي اشتراك.' : 'ستظهر الاشتراكات بعد تسجيلها من النظام.'} icon="ribbon-outline" />}
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 3 },
  eyebrow: { fontSize: 11, textAlign: 'right' },
  title: { fontSize: 24, textAlign: 'right', marginTop: 2 },
  subtitle: { fontSize: 12, textAlign: 'right', marginTop: 2 },
  subscriptionCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, padding: 12, gap: 10, marginTop: 3 },
  subscriptionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { textAlign: 'right', fontSize: 14 },
  planName: { textAlign: 'right', fontSize: 11, marginTop: 2 },
  dates: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  dateText: { fontSize: 10 },
  profileLink: { alignSelf: 'flex-end', paddingVertical: 2 },
  linkText: { fontSize: 11 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});
