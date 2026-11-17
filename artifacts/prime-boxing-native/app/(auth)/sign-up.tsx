import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSignUp } from '@clerk/expo';
import { ActionButton, AppScreen, Card, Field, Text, errorMessage } from '@/components/prime-ui';
import { useColors } from '@/hooks/useColors';

export default function SignUpScreen() {
  const router = useRouter();
  const colors = useColors();
  const { signUp, errors, fetchStatus } = useSignUp();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [started, setStarted] = useState(false);
  const [message, setMessage] = useState('');
  const busy = fetchStatus === 'fetching';
  const needsCode = signUp.status === 'missing_requirements' && signUp.unverifiedFields.includes('email_address');

  const start = async () => {
    setMessage('');
    const { error } = await signUp.password({ emailAddress: emailAddress.trim(), password });
    if (error) {
      setMessage(errorMessage(error, 'تعذر إنشاء طلب الحساب.'));
      return;
    }
    const sent = await signUp.verifications.sendEmailCode();
    if (sent.error) {
      setMessage(errorMessage(sent.error, 'تعذر إرسال رمز التحقق.'));
      return;
    }
    setStarted(true);
  };

  const verify = async () => {
    setMessage('');
    const { error } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (error) {
      setMessage(errorMessage(error, 'رمز التحقق غير صحيح.'));
      return;
    }
    if (signUp.status === 'complete') {
      await signUp.finalize({ navigate: () => router.replace('/') });
    } else {
      setMessage('تم التحقق من البريد. أكمل إعداد الحساب من دعم الأكاديمية.');
    }
  };

  return (
    <AppScreen contentContainerStyle={styles.page}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Card style={styles.card}>
          <Text weight="bold" style={styles.title}>طلب حساب موظف</Text>
          <Text muted style={styles.description}>بعد التحقق من البريد، يراجع المدير طلب الوصول قبل تفعيل صلاحيات النادي.</Text>
          {!started && !needsCode ? (
            <>
              <Field label="البريد الإلكتروني" value={emailAddress} onChangeText={setEmailAddress} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
              <Field label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
              <ActionButton title="إرسال رمز التحقق" loading={busy} disabled={!emailAddress || password.length < 8} onPress={start} />
            </>
          ) : (
            <>
              <Field label="رمز التحقق" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" />
              <ActionButton title="تأكيد البريد وإرسال الطلب" loading={busy} disabled={!code} onPress={verify} />
            </>
          )}
          {message ? <Text color={colors.destructive} style={styles.error}>{message}</Text> : null}
          {errors?.fields?.emailAddress?.message ? <Text color={colors.destructive} style={styles.error}>{errors.fields.emailAddress.message}</Text> : null}
          <View style={styles.linkRow}>
            <Text muted>لديك حساب بالفعل؟ </Text>
            <Link href="/(auth)/sign-in" style={{ color: colors.gold, fontFamily: 'IBMPlexSansArabic_600SemiBold' }}>تسجيل الدخول</Link>
          </View>
          <View nativeID="clerk-captcha" />
        </Card>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center' },
  card: { padding: 20 },
  title: { textAlign: 'right', fontSize: 21 },
  description: { textAlign: 'right', fontSize: 13, lineHeight: 22 },
  error: { textAlign: 'center' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
