import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import SignInScreen from './(auth)/sign-in';

export default function IndexRoute() {
  const { isSignedIn } = useAuth();
  return isSignedIn ? <Redirect href="/(tabs)/dashboard" /> : <SignInScreen />;
}
