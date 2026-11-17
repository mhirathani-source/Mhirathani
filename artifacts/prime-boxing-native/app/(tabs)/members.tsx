import React, { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useListMembers } from '@workspace/api-client-react';
import { ActionButton, AppScreen, Card, EmptyState, ErrorState, Field, IconBadge, LoadingState, SectionTitle, StatusBadge, Text, formatJordanDate } from '@/components/prime-ui';
import { useClubAccess } from '@/src/access';
import { useColors } from '@/hooks/useColors';

export default function MembersScreen() {
  const router = useRouter();
  const colors = useColors();
  const { can } = useClubAccess();
  const [search, setSearch] = useState('');
  const members = useListMembers(
    { search: search.trim() || undefined, limit: 50 },
    { query: { enabled: can('members.view') } },
  );

  if (!can('members.view')) {
    return <AppScreen><ErrorState message="ليس لديك صلاحية لعرض المشتركين." /></AppScreen>;
  }

  return (
    <AppScreen
      refreshControl={
        <RefreshControl
          refreshing={members.isFetching}
          onRefresh={() => void members.refetch()}
          tintColor={colors.gold}
        />
      }
    >
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text muted style={styles.eyebrow}>إدارة الأعضاء</Text>
          <Text weight="bold" style={styles.title}>المشتركون</Text>
          <Text muted style={styles.subtitle}>{members.data?.length ?? 0} نتيجة ظاهرة</Text>
        </View>
        <IconBadge name="people-outline" size={23} />
      </View>

      {can('members.create') ? (
        <ActionButton title="إضافة مشترك" icon="person-add-outline" onPress={() => router.push('/add-member')} />
      ) : null}

      <Card style={styles.listCard}>
        <SectionTitle title="قائمة المشتركين" subtitle="يمكن استخدام رقم هاتف ولي الأمر لأكثر من مشترك." />
        <Field
          label="ابحث بالاسم أو الهاتف"
          value={search}
          onChangeText={setSearch}
          placeholder="اكتب الاسم أو رقم الهاتف"
          returnKeyType="search"
          accessibilityLabel="البحث عن المشتركين بالاسم أو رقم الهاتف"
        />
        {members.isLoading ? <LoadingState /> : members.error ? (
          <ErrorState message="تعذر تحميل قائمة المشتركين." onRetry={() => void members.refetch()} />
        ) : members.data?.length ? members.data.map((member) => (
          <Pressable
            key={member.id}
            onPress={() => router.push(`/member/${member.id}`)}
            style={({ pressed }) => [styles.memberRow, { borderTopColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={`فتح ملف ${member.name}`}
          >
            <IconBadge name="person-outline" size={18} />
            <View style={styles.memberInfo}>
              <View style={styles.nameLine}>
                <Text weight="semibold" style={styles.memberName}>{member.name}</Text>
                <StatusBadge label={`PB-${String(member.id).padStart(3, '0')}`} />
              </View>
              <Text muted style={styles.phone}>{member.phone}</Text>
              <Text muted style={styles.joined}>تاريخ التسجيل: {formatJordanDate(member.joinedAt)}</Text>
            </View>
            <IconBadge name="chevron-back" size={16} color={colors.mutedForeground} backgroundColor="transparent" />
          </Pressable>
        )) : (
          <EmptyState title="لا توجد نتائج" message={search ? 'جرّب البحث برقم الهاتف كاملًا أو جزء من الاسم.' : 'لم تُسجّل مشتركين بعد.'} icon="people-outline" />
        )}
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 3 },
  eyebrow: { fontSize: 11, textAlign: 'right' },
  title: { fontSize: 24, textAlign: 'right', marginTop: 2 },
  subtitle: { fontSize: 12, textAlign: 'right', marginTop: 2 },
  listCard: { padding: 14 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13, paddingBottom: 3 },
  memberInfo: { flex: 1, gap: 3 },
  nameLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8 },
  memberName: { fontSize: 14, textAlign: 'right', flexShrink: 1 },
  phone: { textAlign: 'right', fontSize: 12, writingDirection: 'ltr' },
  joined: { textAlign: 'right', fontSize: 10 },
});
