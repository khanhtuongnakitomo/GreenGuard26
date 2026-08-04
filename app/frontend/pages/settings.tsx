/**
 * GreenGuard — Settings Screen
 *
 * Sections:
 *  1. Appearance (Light / Dark / Follow System)
 *  2. Language (English / Tiếng Việt)
 *  3. About (Version, Privacy Policy, Terms of Service)
 */
import React, { useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/hooks/useI18n';
import type { ColorSchemePreference } from '@/store/themeStore';
import type { SupportedLanguage } from '@/i18n';
import { Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';

// App version — pull from app.json or env
const APP_VERSION = '1.0.0';

// ─── Sub-components ─────────────────────────────────────────────────────────

interface SectionTitleProps {
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
}
const SectionTitle = ({ label, colors }: SectionTitleProps) => (
  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
);

interface SettingsCardProps {
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>['colors'];
}
const SettingsCard = ({ children, colors }: SettingsCardProps) => (
  <View
    style={[
      styles.card,
      {
        backgroundColor: colors.backgroundCard,
        borderColor: colors.cardBorder,
      },
    ]}
  >
    {children}
  </View>
);

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  showDivider?: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}

const SettingsRow = ({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  rightElement,
  onPress,
  showDivider = false,
  colors,
}: SettingsRowProps) => (
  <>
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[styles.rowIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: colors.textSecondaryNew }]}>{subtitle}</Text>
        ) : null}
      </View>
      {rightElement ?? (
        onPress ? (
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        ) : null
      )}
    </TouchableOpacity>
    {showDivider && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
  </>
);

interface ThemeOptionProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

const ThemeOption = ({ label, icon, selected, onPress, colors }: ThemeOptionProps) => (
  <TouchableOpacity
    style={[
      styles.optionBtn,
      {
        backgroundColor: selected ? colors.primary + '18' : colors.backgroundScreen,
        borderColor: selected ? colors.primary : colors.borderMuted,
      },
    ]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <Ionicons
      name={icon}
      size={20}
      color={selected ? colors.primary : colors.textMuted}
    />
    <Text
      style={[
        styles.optionLabel,
        { color: selected ? colors.primary : colors.textSecondary },
        selected && { fontWeight: FontWeight.bold },
      ]}
    >
      {label}
    </Text>
    {selected && (
      <View style={[styles.optionCheck, { backgroundColor: colors.primary }]}>
        <Ionicons name="checkmark" size={10} color="#fff" />
      </View>
    )}
  </TouchableOpacity>
);

interface LangOptionProps {
  label: string;
  flag: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

const LangOption = ({ label, flag, selected, onPress, colors }: LangOptionProps) => (
  <TouchableOpacity
    style={[
      styles.optionBtn,
      {
        backgroundColor: selected ? colors.primary + '18' : colors.backgroundScreen,
        borderColor: selected ? colors.primary : colors.borderMuted,
      },
    ]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <Text style={styles.optionFlag}>{flag}</Text>
    <Text
      style={[
        styles.optionLabel,
        { color: selected ? colors.primary : colors.textSecondary },
        selected && { fontWeight: FontWeight.bold },
      ]}
    >
      {label}
    </Text>
    {selected && (
      <View style={[styles.optionCheck, { backgroundColor: colors.primary }]}>
        <Ionicons name="checkmark" size={10} color="#fff" />
      </View>
    )}
  </TouchableOpacity>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { colors, colorScheme, setColorScheme } = useTheme();
  const { t, language, changeLanguage } = useI18n('settings');

  const handleThemeChange = useCallback(
    (scheme: ColorSchemePreference) => {
      setColorScheme(scheme);
    },
    [setColorScheme],
  );

  const handleLanguageChange = useCallback(
    async (lang: SupportedLanguage) => {
      await changeLanguage(lang);
    },
    [changeLanguage],
  );

  const handlePrivacyPolicy = () => {
    const url = 'https://greenguard.example.com/privacy';
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const handleTermsOfService = () => {
    const url = 'https://greenguard.example.com/terms';
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const handleAbout = () => {
    Alert.alert(
      'GreenGuard',
      `Version ${APP_VERSION}\n\nBuilding a greener campus, one bottle at a time. 🌱`,
    );
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.backgroundScreen }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-down" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('title')}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Appearance ── */}
        <SectionTitle label={t('appearance')} colors={colors} />
        <SettingsCard colors={colors}>
          <View style={styles.optionGroup}>
            <ThemeOption
              label={t('light')}
              icon="sunny-outline"
              selected={colorScheme === 'light'}
              onPress={() => handleThemeChange('light')}
              colors={colors}
            />
            <ThemeOption
              label={t('dark')}
              icon="moon-outline"
              selected={colorScheme === 'dark'}
              onPress={() => handleThemeChange('dark')}
              colors={colors}
            />
            <ThemeOption
              label={t('followSystem')}
              icon="phone-portrait-outline"
              selected={colorScheme === 'system'}
              onPress={() => handleThemeChange('system')}
              colors={colors}
            />
          </View>
        </SettingsCard>

        {/* ── Language ── */}
        <SectionTitle label={t('language')} colors={colors} />
        <SettingsCard colors={colors}>
          <View style={styles.optionGroup}>
            <LangOption
              label={t('english')}
              flag="🇬🇧"
              selected={language === 'en'}
              onPress={() => handleLanguageChange('en')}
              colors={colors}
            />
            <LangOption
              label={t('vietnamese')}
              flag="🇻🇳"
              selected={language === 'vi'}
              onPress={() => handleLanguageChange('vi')}
              colors={colors}
            />
          </View>
        </SettingsCard>

        {/* ── About ── */}
        <SectionTitle label={t('about')} colors={colors} />
        <SettingsCard colors={colors}>
          <SettingsRow
            icon="information-circle-outline"
            iconBg={colors.primary + '18'}
            iconColor={colors.primary}
            title={t('aboutGreenGuard')}
            subtitle={t('aboutSubtitle', { version: APP_VERSION })}
            onPress={handleAbout}
            showDivider
            colors={colors}
          />
          <SettingsRow
            icon="shield-checkmark-outline"
            iconBg={colors.info + '18'}
            iconColor={colors.info}
            title={t('privacyPolicy')}
            subtitle={t('privacySubtitle')}
            onPress={handlePrivacyPolicy}
            showDivider
            colors={colors}
          />
          <SettingsRow
            icon="document-text-outline"
            iconBg={colors.warning + '18'}
            iconColor={colors.warning}
            title={t('termsOfService')}
            subtitle={t('termsSubtitle')}
            onPress={handleTermsOfService}
            showDivider
            colors={colors}
          />
          <SettingsRow
            icon="code-slash-outline"
            iconBg={colors.greenLight}
            iconColor={colors.textSecondaryNew}
            title={t('appVersion')}
            subtitle={APP_VERSION}
            colors={colors}
          />
        </SettingsCard>

        {/* Footer */}
        <Text style={[styles.footer, { color: colors.textMuted }]}>
          {t('madeWith')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  headerRight: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing['3xl'],
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    marginTop: Spacing.base,
    marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  rowIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
  },
  rowSubtitle: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: Spacing.base + 36 + Spacing.md,
  },
  optionGroup: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  optionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    gap: Spacing.xs,
    position: 'relative',
  },
  optionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
  optionFlag: {
    fontSize: 20,
  },
  optionCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    marginTop: Spacing['2xl'],
    marginBottom: Spacing.lg,
  },
});
