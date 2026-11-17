import { useClerk } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { ActionButton, AppScreen, Card, IconBadge, Text } from '@/components/prime-ui';
import { useColors } from '@/hooks/useColors';

export default function PendingAccessScreen() {
  const { signOut } = useClerk();
  const router = useRouter();
  const colors = useColors();
  const logout = async () => {
    await signOut();
    router.replace('/');
  };
  return (
    <AppScreen contentContainerStyle={styles.page}>
      <Card style={styles.card}>
        <IconBadge name="time-outline" size={28} />
        <Text weight="bold" style={styles.title}>الحساب قيد المراجعة</Text>
        <Text muted style={styles.body}>تم تسجيل الدخول، لكن حسابك لم يُمنح صلاحية الوصول إلى بيانات الأكاديمية بعد. تواصل مع المدير لتفعيل الحساب.</Text>
        <ActionButton title="تسجيل الخروج" variant="outline" icon="log-out-outline" onPress={() => void logout()} />
        <Text color={colors.mutedForeground} style={styles.note}>لن تظهر بيانات المشتركين أو المالية قبل تفعيل الصلاحيات.</Text>
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center' },
  card: { alignItems: 'center', paddingVertical: 24 },
  title: { fontSize: 20, textAlign: 'center' },
  body: { fontSize: 13, lineHeight: 23, textAlign: 'center' },
  note: { fontSize: 11, textAlign: 'center' },
});
