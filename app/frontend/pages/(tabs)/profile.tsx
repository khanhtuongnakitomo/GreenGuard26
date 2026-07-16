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
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { SectionHeader } from '@/components/common/SectionHeader';
import { TimeFilterTabs } from '@/components/common/TimeFilterTabs';
import { RankingCard } from '@/components/profile/RankingCard';
import { HistoryRow } from '@/components/profile/HistoryRow';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { useUserStore } from '@/store/userStore';
import { formatPoints } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';
import { useResponsive } from '@/hooks/useResponsive';
import { useHistory, useUserSummary } from '@/hooks/useApi';
import type { HistoryEntry } from '@/types/user.types';

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
      const confirmed = window.confirm('Are you sure you want to log out?');
      if (confirmed) {
        await logout();
        router.replace('/(auth)/sign-in');
      }
    } else {
      Alert.alert('Logout', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      {!isLargeScreen && (
        <AppHeader
          rightIcon="settings"
          onRightIconPress={() => Alert.alert('Settings', 'Settings screen coming soon.')}
        />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isLargeScreen && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main layout */}

        {isLargeScreen && (
          <View style={styles.desktopHeaderRow}>
            <AppHeader
              rightIcon="settings"
              onRightIconPress={() => Alert.alert('Settings', 'Settings screen coming soon.')}
              hideLogo
            />
          </View>
        )}

        <View style={[styles.mainLayout, isLargeScreen && styles.mainLayoutDesktop]}>
          
          {/* Left Column on Desktop */}
          <View style={[styles.column, isLargeScreen && styles.columnLeft]}>
            <View style={styles.profileInfoContainer}>
              {/* Green Member badge */}
              <View style={styles.badgeRow}>
                <Badge
                  label={`🌱 ${user.memberTier || 'New Member'}`}
                  color={Colors.primary}
                  backgroundColor={Colors.backgroundWhite}
                  style={styles.memberBadge}
                />
              </View>

              {/* Avatar */}
              <View style={styles.avatarContainer}>
                <AvatarIcon size={90} />
              </View>

              {/* User info */}
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userInfo}>{user.phoneNumber}</Text>
              {(user.className || user.studentId) && (
                <Text style={styles.userInfo}>
                  {[user.className, user.studentId].filter(Boolean).join(' · ')}
                </Text>
              )}

              {/* Edit Profile button */}
              <Button
                label="Edit Profile"
                onPress={() => router.push('/edit-profile')}
                style={styles.editButton}
              />

              {/* Total Points */}
              <View style={styles.pointsRow}>
                <Text style={styles.pointsLabel}>Total Points</Text>
                <View style={styles.pointsValue}>
                  <Text style={styles.leafEmoji}>🍃</Text>
                  <Text style={styles.pointsText}>{formatPoints(user.totalPoints)}</Text>
                </View>
              </View>

              {/* Ranking */}
              <RankingCard user={user} />
            </View>
          </View>

          {/* Right Column on Desktop */}
          <View style={[styles.column, isLargeScreen && styles.columnRight]}>
            {/* History */}
            <SectionHeader
              title="History"
              linkLabel="View more"
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
              <Text style={{ color: Colors.textMuted, marginBottom: Spacing.md }}>
                No recent activity.
              </Text>
            ) : (
              filteredHistory.map((entry) => (
                <HistoryRow key={entry.id} entry={entry} />
              ))
            )}
            
            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color={Colors.error} />
              <Text style={styles.logoutText}>Logout</Text>
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
    backgroundColor: Colors.backgroundScreen,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing['2xl'],
    alignItems: 'center',
  },
  contentDesktop: {
    paddingHorizontal: Spacing['3xl'],
    paddingTop: Spacing.xl,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    alignItems: 'stretch',
  },
  desktopHeaderRow: {
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },
  mainLayout: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
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
    alignItems: 'center',
  },
  profileInfoContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    alignSelf: 'center',
  },
  columnRight: {
    flex: 2,
  },
  badgeRow: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.sm,
    borderWidth: 3,
    borderColor: Colors.backgroundWhite,
  },
  userName: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    color: '#154124',
    marginBottom: Spacing.xs,
  },
  userInfo: {
    fontSize: FontSize.lg,
    color: '#398C49',
    marginBottom: Spacing.xs / 2,
    fontWeight: FontWeight.medium,
  },
  editButton: {
    marginTop: Spacing.base,
    marginBottom: Spacing.xl,
    width: '100%',
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
    borderColor: Colors.divider,
  },
  pointsLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
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
    color: Colors.primary,
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
    padding: Spacing.md,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  logoutText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.error,
  },
  memberBadge: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
});
