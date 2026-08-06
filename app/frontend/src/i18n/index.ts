/**
 * GreenGuard — i18n Configuration
 *
 * Uses react-i18next + i18next.
 * - Auto-detects device language via expo-localization
 * - Persists user language choice to AsyncStorage
 * - Supports: English (en), Vietnamese (vi)
 * - Namespaces: common, home, profile, rewards, map, auth, settings
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// English translations
import enCommon from './locales/en/common.json';
import enHome from './locales/en/home.json';
import enProfile from './locales/en/profile.json';
import enRewards from './locales/en/rewards.json';
import enMap from './locales/en/map.json';
import enAuth from './locales/en/auth.json';
import enSettings from './locales/en/settings.json';
import enImpact from './locales/en/impact.json';
import enHistory from './locales/en/history.json';
import enWallet from './locales/en/wallet.json';

// Vietnamese translations
import viCommon from './locales/vi/common.json';
import viHome from './locales/vi/home.json';
import viProfile from './locales/vi/profile.json';
import viRewards from './locales/vi/rewards.json';
import viMap from './locales/vi/map.json';
import viAuth from './locales/vi/auth.json';
import viSettings from './locales/vi/settings.json';
import viImpact from './locales/vi/impact.json';
import viHistory from './locales/vi/history.json';
import viWallet from './locales/vi/wallet.json';

export const LANGUAGE_STORAGE_KEY = '@greenguard/language';
export type SupportedLanguage = 'en' | 'vi';
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'vi'];

/** Detect device language, fall back to 'en' */
function detectDeviceLanguage(): SupportedLanguage {
  try {
    const locales = getLocales();
    const deviceLang = locales[0]?.languageCode;
    if (deviceLang === 'vi') return 'vi';
  } catch {
    // ignore
  }
  return 'en';
}

/** Initialize i18n — call this before rendering the app */
export async function initI18n(): Promise<void> {
  let language: SupportedLanguage;

  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'vi') {
      language = saved;
    } else {
      language = detectDeviceLanguage();
    }
  } catch {
    language = detectDeviceLanguage();
  }

  await i18n.use(initReactI18next).init({
    resources: {
      en: {
        common: enCommon,
        home: enHome,
        profile: enProfile,
        rewards: enRewards,
        map: enMap,
        auth: enAuth,
        settings: enSettings,
        impact: enImpact,
        history: enHistory,
        wallet: enWallet,
      },
      vi: {
        common: viCommon,
        home: viHome,
        profile: viProfile,
        rewards: viRewards,
        map: viMap,
        auth: viAuth,
        settings: viSettings,
        impact: viImpact,
        history: viHistory,
        wallet: viWallet,
      },
    },
    lng: language,
    fallbackLng: 'en',
    defaultNS: 'common',
    nsSeparator: '.',
    keySeparator: false,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    compatibilityJSON: 'v4',
  });
}

/** Change language and persist to AsyncStorage */
export async function changeLanguage(lang: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

export default i18n;
