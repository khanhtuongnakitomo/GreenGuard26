/**
 * GreenGuard — App Entry (index.tsx)
 * Redirects directly to sign-in, skipping the splash screen.
 */
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(auth)/sign-in" />;
}
