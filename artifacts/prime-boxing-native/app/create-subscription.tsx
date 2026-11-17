import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateOperationalSubscription, useListMembers, useListOperationalPlans } from '@workspace/api-client-react';
import { ActionButton, AppScreen, Card, ErrorState, Field, LoadingState, SectionTitle, StatusBadge, Text, errorMessage } from '@/components/prime-ui';
import { useClubAccess } from '@/src/access';
import { useColors } from '@/hooks/useColors';

function jordanToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Amman',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default function CreateSubscriptionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useColors();
  const { can } = useClubAccess();
  const [memberId, setMemberId] = useState<number | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [startDate, setStartDate] = useState(jordanToday());
  const [message, setMessage] = useState('');
  const members = useListMembers({ search: memberSearch.trim() || undefined, limit: 50 }, { query: { enabled: can('members.view') } });
  const plans = useListOperationalPlans({ query: { enabled: can('subscriptions.view') } });
  const create = useCreateOperationalSubscription();
  const selectedMember = useMemo(() => members.data?.find((member) => member.id === memberId), [members.data, memberId]);

  if (!can('subscriptions.create')) {
    return <AppScreen><ErrorState message="ليس لديك صلاحية لإنشاء اشتراك." /></AppScreen>;
  }

  const submit = () => {
    setMessage('');
    if (!memberId || !planId || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      setMessage('اختر مشتركًا وباقة وأدخل تاريخ بداية صحيحًا.');
      return;
    }
    create.mutate(
      { data: { memberId, planId, startDate } },
      {
        onSuccess: async (subscription) => {
          await queryClient.invalidateQueries();
          Alert.alert('تم بدء الاشتراك', `تم حفظ اشتراك ${subscription.memberName} بنجاح.`);
          router.replace('/(tabs)/subscriptions');
        },
        onError: (error) => setMessage(errorMessage(error, 'تعذر تسجيل الاشتراك.')),
      },
    );
  };

  return (
    <AppScreen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Card>
          <SectionTitle title="اشتراك جديد" subtitle="يُسجّل الاشتراك دون دفعة. سجّل أي مبلغ من ملف المشترك." />
          <Field label="ابحث عن المشترك" value={memberSearch} onChangeText={setMemberSearch} placeholder="الاسم أو الهاتف" />
          {members.isLoading ? <LoadingState label="تحميل المشتركين..." /> : members.data?.length ? (
            <View style={styles.choices}>
              {members.data.slice(0, 20).map((member) => (
                <Pressable
                  key={member.id}
                  onPress={() => setMemberId(member.id)}
                  style={[styles.choice, { borderColor: memberId === member.id ? colors.gold : colors.border, backgroundColor: memberId === member.id ? colors.accent : colors.background }]}
                >
                  <Text weight={memberId === member.id ? 'bold' : 'medium'} style={styles.choiceTitle}>{member.name}</Text>
                  <Text muted style={styles.choiceDetail}>{member.phone}</Text>
                  {memberId === member.id ? <StatusBadge label="محدد" tone="warning" /> : null}
                </Pressable>
              ))}
            </View>
          ) : <Text muted style={styles.help}>لا توجد نتائج. أضف المشترك أولًا من صفحة المشتركين.</Text>}

          <Text weight="semibold" style={styles.groupTitle}>الباقة</Text>
          {plans.isLoading ? <LoadingState label="تحميل الباقات..." /> : plans.data?.length ? (
            <View style={styles.choices}>
              {plans.data.filter((plan) => plan.active).map((plan) => (
                <Pressable
                  key={plan.id}
                  onPress={() => setPlanId(plan.id)}
                  style={[styles.choice, { borderColor: planId === plan.id ? colors.gold : colors.border, backgroundColor: planId === plan.id ? colors.accent : colors.background }]}
                >
                  <Text weight={planId === plan.id ? 'bold' : 'medium'} style={styles.choiceTitle}>{plan.name}</Text>
                  <Text muted style={styles.choiceDetail}>{plan.durationDays} يوم</Text>
                  {planId === plan.id ? <StatusBadge label="محدد" tone="warning" /> : null}
                </Pressable>
              ))}
            </View>
          ) : <Text muted style={styles.help}>لا توجد باقات فعّالة؛ تواصل مع المدير لإضافتها.</Text>}

          <Field label="تاريخ البداية" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
          {selectedMember ? <Text muted style={styles.help}>سيُضاف الاشتراك إلى ملف {selectedMember.name} فقط.</Text> : null}
          {message ? <Text color={colors.destructive} style={styles.error}>{message}</Text> : null}
          <ActionButton title="حفظ الاشتراك" icon="save-outline" loading={create.isPending} disabled={!memberId || !planId} onPress={submit} />
          <ActionButton title="إلغاء" variant="outline" onPress={() => router.back()} />
        </Card>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  choices: { gap: 8 },
  choice: { borderWidth: 1, borderRadius: 13, padding: 11, gap: 3 },
  choiceTitle: { textAlign: 'right', fontSize: 13 },
  choiceDetail: { textAlign: 'right', fontSize: 11 },
  groupTitle: { textAlign: 'right', fontSize: 13, marginTop: 4 },
  help: { textAlign: 'right', fontSize: 11, lineHeight: 19 },
  error: { textAlign: 'center', fontSize: 12 },
});
