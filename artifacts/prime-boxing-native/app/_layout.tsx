import React, { useEffect } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  useFonts,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ClerkLoaded, ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { StatusBar } from 'expo-status-bar';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const apiDomain = process.env.EXPO_PUBLIC_DOMAIN;
if (apiDomain) {
  setBaseUrl(/^https?:\/\//i.test(apiDomain) ? apiDomain : `https://${apiDomain}`);
}

function AuthTokenBridge({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, userId } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(isSignedIn ? () => getToken() : null);
    return () => setAuthTokenGetter(null);
  }, [getToken, isSignedIn]);

  useEffect(() => {
    queryClient.clear();
  }, [isSignedIn, userId]);

  return <>{children}</>;
}

function RootLayoutNav() {
  const colors = useColors();
  return (
    <Stack screenOptions={{ headerBackTitle: 'رجوع', headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="member/[id]" />
      <Stack.Screen name="add-member" options={{ presentation: 'modal' }} />
      <Stack.Screen name="create-subscription" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colors = useColors();
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: colors.background }}>
        <Image source={require('@/assets/images/icon.png')} style={{ width: 124, height: 124, borderRadius: 26 }} accessibilityLabel="شعار أكاديمية برايم للملاكمة" />
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''}
      tokenCache={tokenCache}
      proxyUrl={process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined}
    >
      <ClerkLoaded>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <AuthTokenBridge>
                <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
                  <KeyboardProvider>
                    <StatusBar style="light" />
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </AuthTokenBridge>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
