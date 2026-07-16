/**
 * Resolve API base URL for web / emulator / physical device.
 * Rewrites localhost to the Expo debugger host IP when needed.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getExpoHostIp(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    // Expo Go / legacy manifests
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).linkingUri;

  if (!hostUri || typeof hostUri !== 'string') return null;

  // Examples: "192.168.1.10:8081", "exp://192.168.1.10:8081"
  const cleaned = hostUri.replace(/^exp:\/\//, '').replace(/^https?:\/\//, '');
  const host = cleaned.split(':')[0]?.split('/')[0];
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
}

export function resolveApiBaseUrl(): string {
  const configured = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

  // Web in the browser can talk to localhost directly
  if (Platform.OS === 'web') return configured;

  const isLocal =
    configured.includes('://localhost') || configured.includes('://127.0.0.1');

  if (!isLocal) return configured;

  // Android emulator loopback
  if (Platform.OS === 'android') {
    const hostIp = getExpoHostIp();
    // Physical device via Expo Go → use LAN IP from Metro
    if (hostIp && hostIp !== '10.0.2.2') {
      return configured
        .replace('://localhost', `://${hostIp}`)
        .replace('://127.0.0.1', `://${hostIp}`);
    }
    // Emulator
    return configured
      .replace('://localhost', '://10.0.2.2')
      .replace('://127.0.0.1', '://10.0.2.2');
  }

  // iOS simulator can use localhost; physical device needs LAN IP
  const hostIp = getExpoHostIp();
  if (hostIp) {
    return configured
      .replace('://localhost', `://${hostIp}`)
      .replace('://127.0.0.1', `://${hostIp}`);
  }

  return configured;
}
