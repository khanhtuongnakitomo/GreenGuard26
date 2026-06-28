/**
 * GreenGuard — App Entry (index.tsx)
 * Redirects to splash screen on first load.
 */
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/splash" />;
}
