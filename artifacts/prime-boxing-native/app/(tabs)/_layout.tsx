import { ActivityIndicator, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useClubAccess } from '@/src/access';
import { useColors } from '@/hooks/useColors';
import { Text } from '@/components/prime-ui';

export default function TabsLayout() {
  const { isSignedIn } = useAuth();
  const { data: session, isLoading, error, can } = useClubAccess(isSignedIn === true);
  const colors = useColors();

  if (!isSignedIn) return <Redirect href="/sign-in" />;
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <ActivityIndicator color={colors.gold} />
        <Text muted>جارٍ التحقق من صلاحيات النادي...</Text>
      </View>
    );
  }
  if (error) return <Redirect href="/sign-in" />;
  if (session?.status !== 'active') return <Redirect href="/(auth)/pending" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: Platform.OS === 'web' ? 84 : 72,
          paddingTop: 7,
          paddingBottom: Platform.OS === 'web' ? 0 : 8,
        },
        tabBarLabelStyle: { fontFamily: 'IBMPlexSansArabic_500Medium', fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'الرئيسية',
          href: can('dashboard.view') ? undefined : null,
          tabBarIcon: ({ focused, size }) => <Ionicons name="grid-outline" color={focused ? colors.gold : colors.mutedForeground} size={size} />,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: 'المشتركون',
          href: can('members.view') ? undefined : null,
          tabBarIcon: ({ focused, size }) => <Ionicons name="people-outline" color={focused ? colors.gold : colors.mutedForeground} size={size} />,
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: 'الاشتراكات',
          href: can('subscriptions.view') ? undefined : null,
          tabBarIcon: ({ focused, size }) => <Ionicons name="ribbon-outline" color={focused ? colors.gold : colors.mutedForeground} size={size} />,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'المالية',
          href: can('finance.view') ? undefined : null,
          tabBarIcon: ({ focused, size }) => <Ionicons name="wallet-outline" color={focused ? colors.gold : colors.mutedForeground} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'المزيد',
          tabBarIcon: ({ focused, size }) => <Ionicons name="ellipsis-horizontal-circle-outline" color={focused ? colors.gold : colors.mutedForeground} size={size} />,
        }}
      />
    </Tabs>
  );
}
