/**
 * GreenGuard — Profile Screen
 *
 * Figma sections (top to bottom):
 * 1. AppHeader (logo + GEAR icon instead of bell)
 * 2. "Green Member" badge
 * 3. Circular avatar
 * 4. Name, DOB, Location
 * 5. "Edit Profile" button (full-width dark green pill)
 * 6. "Total Points 🍃 1,250 pts"
 * 7. RankingCard (Silver tier + progress bar)
 * 8. History section with time filter tabs + HistoryRows
 */
import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AvatarIcon } from '@/components/icons/AvatarIcon';

import { AppHeader } from '@/components/common/AppHeader';
import { Button } from '@/components/common/Button';
import { SectionHeader } from '@/components/common/SectionHeader';
import { TimeFilterTabs } from '@/components/common/TimeFilterTabs';
import { RankingCard } from '@/components/profile/RankingCard';
import { HistoryRow } from '@/components/profile/HistoryRow';
import { Spacing, FontSize, FontWeight, Shadows } from '@/theme';
import { useUserStore } from '@/store/userStore';
import { formatPoints } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';
import { useResponsive } from '@/hooks/useResponsive';
import { useHistory, useUserSummary } from '@/hooks/useApi';
import type { HistoryEntry } from '@/types/user.types';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/hooks/useI18n';

const HISTORY_FILTERS = [
  { value: '1day', label: '1 Days' },
  { value: '1week', label: '1 Weeks' },
];

function toHistoryEntries(txs: Array<{ _id: string; description?: string; points: number; createdAt: string; type: string }>): HistoryEntry[] {
  return txs.slice(0, 5).map((tx) => ({
    id: tx._id,
    createdAt: tx.createdAt,
    items: [
      {
        type: tx.description || tx.type,
        quantity: 1,
        pointsEarned: Math.abs(tx.points),
      },
    ],
  }));
}

export default function ProfileScreen() {
  const { isLargeScreen } = useResponsive();
  const { colors, colorScheme, setColorScheme } = useTheme();
  const { t } = useI18n();

  const user = useUserStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [historyFilter, setHistoryFilter] = useState('1day');
  useUserSummary();
  const { data: transactions = [] } = useHistory();

  const filteredHistory = useMemo(() => {
    const now = Date.now();
    const windowMs = historyFilter === '1day' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const recent = transactions.filter((tx) => now - new Date(tx.createdAt).getTime() <= windowMs);
    return toHistoryEntries(recent.length ? recent : transactions);
  }, [transactions, historyFilter]);

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(t('profile.confirmLogout', 'Are you sure you want to log out?'));
      if (confirmed) {
        await logout();
        router.replace('/(auth)/sign-in');
      }
    } else {
      Alert.alert(t('profile.logout', 'Logout'), t('profile.confirmLogout', 'Are you sure you want to log out?'), [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { 
          text: t('profile.logout', 'Logout'), 
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/sign-in');
          }
        },
      ]);
    }
  };

  if (!user) return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.backgroundScreen }]} edges={['top']}>
      {!isLargeScreen && (
        <AppHeader
          rightIcon="settings"
          onRightIconPress={() => router.push('/settings')}
        />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isLargeScreen && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {isLargeScreen && (
          <View style={styles.desktopHeaderRow}>
            <AppHeader
              rightIcon="settings"
              onRightIconPress={() => router.push('/settings')}
              hideLogo
            />
          </View>
        )}

        <View style={[styles.mainLayout, isLargeScreen && styles.mainLayoutDesktop]}>

          {/* Left Column */}
          <View style={[styles.column, isLargeScreen && styles.columnLeft]}>

            {/* ── Hero Card (solid green) ── */}
            <View style={[styles.heroCard, { backgroundColor: colors.primary, borderColor: colors.primaryDark }]}>
              {/* Decorative circle */}
              <View style={styles.heroDecorCircle} />
              <View style={styles.heroRow}>
                {/* Avatar */}
                <View style={styles.heroAvatar}>
                  <AvatarIcon size={52} />
                </View>
                {/* Info */}
                <View style={styles.heroInfo}>
                  <Text style={styles.heroName}>{user.name}</Text>
                  <Text style={styles.heroSub}>{user.phoneNumber}</Text>
                  {(user.className || user.studentId) && (
                    <Text style={styles.heroSub}>
                      {[user.className, user.studentId].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                  <View style={styles.heroBadge}>
                    <Ionicons name="trophy-outline" size={12} color="#fff" />
                    <Text style={styles.heroBadgeText}>{user.memberTier || 'New Member'}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'column', gap: Spacing.sm }}>
                  <TouchableOpacity
                    style={styles.heroEditBtn}
                    onPress={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
                  >
                    <Ionicons name={colorScheme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={17} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.heroEditBtn}
                    onPress={() => router.push('/edit-profile')}
                  >
                    <Ionicons name="create-outline" size={17} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* ── Stats strip (4 cols) ── */}
            <View style={styles.statsStrip}>
              {[
                { label: t('profile.totalPoints', 'Total Points'), value: user.totalPoints?.toLocaleString() ?? '0', icon: 'leaf-outline' as const },
                { label: t('profile.rank', 'Rank'), value: user.memberTier?.charAt(0) ?? 'B', icon: 'trophy-outline' as const },
                { label: t('profile.streak', 'Streak'), value: '7d', icon: 'flash-outline' as const },
                { label: t('profile.history', 'History'), value: filteredHistory.length.toString(), icon: 'time-outline' as const },
              ].map((s) => (
                <View key={s.label} style={[styles.statCell, { backgroundColor: colors.backgroundWhite, borderColor: colors.cardBorder }]}>
                  <Ionicons name={s.icon} size={15} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>{s.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondaryNew }]}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Total Points row */}
            <View style={[styles.pointsRow, { borderColor: colors.divider }]}>
              <Text style={[styles.pointsLabel, { color: colors.textPrimary }]}>{t('profile.totalPoints', 'Total Points')}</Text>
              <View style={styles.pointsValue}>
                <Text style={styles.leafEmoji}>🍃</Text>
                <Text style={[styles.pointsText, { color: colors.primary }]}>{formatPoints(user.totalPoints)}</Text>
              </View>
            </View>

            {/* Ranking */}
            <RankingCard user={user} />

            {/* Edit Profile button */}
            <Button
              label={t('profile.editProfile', 'Edit Profile')}
              onPress={() => router.push('/edit-profile')}
              style={styles.editButton}
            />
          </View>

          {/* Right Column on Desktop */}
          <View style={[styles.column, isLargeScreen && styles.columnRight]}>
            {/* History */}
            <SectionHeader
              title={t('profile.history', 'History')}
              linkLabel={t('profile.viewMore', 'View more')}
              onLinkPress={() => router.push('/history' as any)}
              style={styles.historySectionHeader}
            />

            <TimeFilterTabs
              tabs={HISTORY_FILTERS}
              activeValue={historyFilter}
              onTabPress={setHistoryFilter}
              style={styles.historyFilterTabs}
            />

            {filteredHistory.length === 0 ? (
              <Text style={{ color: colors.textMuted, marginBottom: Spacing.md }}>
                {t('profile.noActivity', 'No recent activity.')}
              </Text>
            ) : (
              filteredHistory.map((entry) => (
                <HistoryRow key={entry.id} entry={entry} />
              ))
            )}

            {/* Logout Button */}
            <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.backgroundWhite, borderColor: colors.errorLight }]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text style={[styles.logoutText, { color: colors.error }]}>{t('profile.logout', 'Logout')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing['2xl'],
  },
  contentDesktop: {
    paddingHorizontal: Spacing['3xl'],
    paddingTop: Spacing.xl,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  desktopHeaderRow: {
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },
  mainLayout: {
    flex: 1,
    width: '100%',
  },
  mainLayoutDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing['3xl'],
    marginTop: Spacing.xl,
  },
  column: {
    width: '100%',
  },
  columnLeft: {
    flex: 1,
  },
  columnRight: {
    flex: 2,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    position: 'relative',
    ...Shadows.buttonGreen,
  },
  heroDecorCircle: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  heroAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#fff',
    marginBottom: 2,
  },
  heroSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.70)',
    marginBottom: 1,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
  heroEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsStrip: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCell: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: Spacing.md,
    paddingHorizontal: 6,
    alignItems: 'center',
    ...Shadows.card,
  },
  statValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    lineHeight: 20,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 10,
    marginTop: 3,
    lineHeight: 13,
    textAlign: 'center',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: Spacing.base,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  pointsLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
  },
  pointsValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  leafEmoji: {
    fontSize: FontSize.base,
  },
  pointsText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  editButton: {
    marginTop: Spacing.base,
    marginBottom: Spacing.md,
    width: '100%',
  },
  historySectionHeader: {
    width: '100%',
    marginTop: Spacing.sm,
  },
  historyFilterTabs: {
    marginBottom: Spacing.md,
    alignSelf: 'flex-start',
  },
  bottomSpacer: {
    height: Spacing.base,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: Spacing.sm,
    ...Shadows.xs,
  },
  logoutText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
  },
});
