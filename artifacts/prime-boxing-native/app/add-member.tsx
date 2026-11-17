import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateMember } from '@workspace/api-client-react';
import { ActionButton, AppScreen, Card, ErrorState, Field, SectionTitle, Text, errorMessage } from '@/components/prime-ui';
import { useClubAccess } from '@/src/access';
import { useColors } from '@/hooks/useColors';

export default function AddMemberScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useColors();
  const { can } = useClubAccess();
  const createMember = useCreateMember();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  if (!can('members.create')) {
    return <AppScreen><ErrorState message="ليس لديك صلاحية لإضافة مشترك." /></AppScreen>;
  }

  const submit = () => {
    setMessage('');
    if (name.trim().length < 2 || phone.trim().length < 7) {
      setMessage('أدخل اسمًا صحيحًا ورقم هاتف لا يقل عن 7 أرقام.');
      return;
    }
    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      setMessage('اكتب تاريخ الميلاد بصيغة YYYY-MM-DD.');
      return;
    }
    createMember.mutate(
      {
        data: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          birthDate: birthDate.trim() || null,
          notes: notes.trim() || null,
        },
      },
      {
        onSuccess: async (member) => {
          await queryClient.invalidateQueries();
          Alert.alert('تمت الإضافة', 'تم حفظ المشترك في قاعدة بيانات الأكاديمية.');
          router.replace(`/member/${member.id}`);
        },
        onError: (error) => setMessage(errorMessage(error, 'تعذر حفظ بيانات المشترك.')),
      },
    );
  };

  return (
    <AppScreen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Card>
          <SectionTitle title="مشترك جديد" subtitle="تُحفظ بيانات كل مشترك بصورة مستقلة." />
          <Field label="الاسم الكامل *" value={name} onChangeText={setName} placeholder="اسم المشترك" autoComplete="name" />
          <Field label="رقم الهاتف *" value={phone} onChangeText={setPhone} placeholder="07XXXXXXXX" keyboardType="phone-pad" autoComplete="tel" />
          <Text muted style={styles.note}>يمكن مشاركة رقم ولي الأمر مع الإخوة؛ لكل مشترك ملف واشتراك مستقل.</Text>
          <Field label="البريد الإلكتروني (اختياري)" value={email} onChangeText={setEmail} placeholder="name@example.com" autoCapitalize="none" keyboardType="email-address" />
          <Field label="تاريخ الميلاد (اختياري)" value={birthDate} onChangeText={setBirthDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
          <Field label="ملاحظات (اختياري)" value={notes} onChangeText={setNotes} placeholder="ملاحظات عن المشترك" multiline numberOfLines={3} style={styles.multiline} />
          {message ? <Text color={colors.destructive} style={styles.error}>{message}</Text> : null}
          <ActionButton title="حفظ المشترك" icon="save-outline" loading={createMember.isPending} disabled={!name.trim() || !phone.trim()} onPress={submit} />
          <ActionButton title="إلغاء" variant="outline" onPress={() => router.back()} />
        </Card>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  note: { textAlign: 'right', fontSize: 11, lineHeight: 18 },
  error: { textAlign: 'center', fontSize: 12 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
});
