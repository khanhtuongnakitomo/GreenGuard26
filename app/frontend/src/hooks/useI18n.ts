/**
 * GreenGuard — useI18n Hook
 *
 * Wraps react-i18next's useTranslation with:
 *  - Typed language switching with AsyncStorage persistence
 *  - Current language accessor
 *
 * Usage:
 *   const { t, language, changeLanguage } = useI18n('home');
 */
import { useTranslation } from 'react-i18next';
import { changeLanguage as i18nChangeLanguage, SupportedLanguage } from '@/i18n';
import i18n from '@/i18n';

export function useI18n(namespace?: string | string[]) {
  const { t, i18n: i18nInstance } = useTranslation(namespace ?? 'common');

  const language = i18nInstance.language as SupportedLanguage;

  const changeLanguage = async (lang: SupportedLanguage) => {
    await i18nChangeLanguage(lang);
  };

  return { t, language, changeLanguage };
}

/** Convenience: get current language outside of React */
export function getCurrentLanguage(): SupportedLanguage {
  return (i18n.language ?? 'en') as SupportedLanguage;
}
