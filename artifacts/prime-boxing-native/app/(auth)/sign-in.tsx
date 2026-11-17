import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth, useSignIn } from '@clerk/expo';
import { ActionButton, AppScreen, Card, Field, Text, errorMessage } from '@/components/prime-ui';
import { useColors } from '@/hooks/useColors';

function AuthForm({
  children,
  onSubmit,
}: {
  children: React.ReactNode;
  onSubmit: () => Promise<void>;
}) {
  if (Platform.OS !== 'web') return <View>{children}</View>;
  return React.createElement(
    'form',
    {
      onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void onSubmit();
      },
      style: { display: 'flex', flexDirection: 'column', gap: 12 },
    },
    children,
  );
}

export default function SignInScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isSignedIn } = useAuth();
  const { signIn, errors, fetchStatus } = useSignIn();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [clientTrust, setClientTrust] = useState(false);
  const [message, setMessage] = useState('');
  const busy = fetchStatus === 'fetching';

  useEffect(() => {
    if (isSignedIn) router.replace('/(tabs)/dashboard');
  }, [isSignedIn, router]);

  const finishSignIn = async () => {
    await signIn.finalize({
      navigate: () => router.replace('/'),
    });
  };

  const submit = async () => {
    setMessage('');
    const { error } = await signIn.password({ emailAddress: emailAddress.trim(), password });
    if (error) {
      setMessage(errorMessage(error, 'تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.'));
      return;
    }
    if (signIn.status === 'complete') {
      await finishSignIn();
      return;
    }
    if (signIn.status === 'needs_client_trust') {
      const emailFactor = signIn.supportedSecondFactors.find((factor) => factor.strategy === 'email_code');
      if (emailFactor) {
        await signIn.mfa.sendEmailCode();
        setClientTrust(true);
      } else {
        setMessage('يتطلب الحساب تحققًا إضافيًا غير متاح في هذه الجلسة. تواصل مع مدير الأكاديمية.');
      }
      return;
    }
    if (signIn.status === 'needs_second_factor') {
      const emailFactor = signIn.supportedSecondFactors.find((factor) => factor.strategy === 'email_code');
      if (emailFactor) {
        await signIn.mfa.sendEmailCode();
        setClientTrust(true);
      } else {
        setMessage('يتطلب الحساب تحققًا إضافيًا. تواصل مع مدير الأكاديمية لإكمال الدخول.');
      }
      return;
    }
    setMessage('لم يكتمل تسجيل الدخول. تحقق من متطلبات التحقق الخاصة بالحساب.');
  };

  const verifyCode = async () => {
    setMessage('');
    const { error } = await signIn.mfa.verifyEmailCode({ code: code.trim() });
    if (error) {
      setMessage(errorMessage(error, 'رمز التحقق غير صحيح.'));
      return;
    }
    if (signIn.status === 'complete') await finishSignIn();
  };

  return (
    <AppScreen contentContainerStyle={styles.page}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.brand}>
          <Image source={require('@/assets/images/icon.png')} style={styles.logo} accessibilityLabel="شعار أكاديمية برايم للملاكمة" />
          <Text weight="bold" style={styles.brandTitle}>PRIME BOXING ACADEMY</Text>
          <Text muted style={styles.brandSubtitle}>نظام إدارة الأكاديمية</Text>
        </View>
        <Card style={styles.formCard}>
          <Text weight="bold" style={styles.heading}>{clientTrust ? 'تحقق من هويتك' : 'تسجيل الدخول'}</Text>
          <Text muted style={styles.description}>
            {clientTrust ? 'أدخل رمز التحقق الذي أُرسل إلى بريدك الإلكتروني.' : 'استخدم بيانات حساب الأكاديمية للوصول الآمن.'}
          </Text>
          <AuthForm onSubmit={clientTrust ? verifyCode : submit}>
            {!clientTrust ? (
              <>
              <Field
                label="البريد الإلكتروني"
                value={emailAddress}
                onChangeText={setEmailAddress}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="name@example.com"
                accessibilityLabel="البريد الإلكتروني"
              />
              <Field
                label="كلمة المرور"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                placeholder="أدخل كلمة المرور"
                accessibilityLabel="كلمة المرور"
              />
              <ActionButton title="دخول آمن" icon="lock-closed-outline" loading={busy} disabled={!emailAddress || !password} onPress={submit} />
            </>
            ) : (
              <>
              <Field
                label="رمز التحقق"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={8}
                placeholder="أدخل الرمز"
                accessibilityLabel="رمز التحقق"
              />
              <ActionButton title="تأكيد الرمز" icon="shield-checkmark-outline" loading={busy} disabled={!code} onPress={verifyCode} />
              <ActionButton title="إعادة إرسال الرمز" variant="outline" disabled={busy} onPress={() => signIn.mfa.sendEmailCode()} />
            </>
            )}
            {message || errors?.fields?.identifier?.message ? (
              <Text color={colors.destructive} style={styles.error}>
                {message || errors?.fields?.identifier?.message}
              </Text>
            ) : null}
          </AuthForm>
          {!clientTrust ? (
            <View style={styles.signUpLine}>
              <Text muted>لا تملك حسابًا؟ </Text>
              <Link href="/(auth)/sign-up" style={{ color: colors.gold, fontFamily: 'IBMPlexSansArabic_600SemiBold' }}>
                طلب حساب
              </Link>
            </View>
          ) : null}
        </Card>
        <Text muted style={styles.footer}>الدخول مخصص لموظفي ومديري Prime Boxing Academy</Text>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', paddingTop: 34, paddingBottom: 34 },
  brand: { alignItems: 'center', marginBottom: 28, gap: 5 },
  logo: { width: 104, height: 104, borderRadius: 24, marginBottom: 8 },
  brandTitle: { fontSize: 17, letterSpacing: 1.2, textAlign: 'center' },
  brandSubtitle: { fontSize: 13, textAlign: 'center' },
  formCard: { padding: 20 },
  heading: { fontSize: 21, textAlign: 'right' },
  description: { textAlign: 'right', fontSize: 13, lineHeight: 22, marginBottom: 2 },
  error: { textAlign: 'center', fontSize: 13, lineHeight: 21 },
  signUpLine: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 5 },
  footer: { textAlign: 'center', fontSize: 11, marginTop: 22 },
});
