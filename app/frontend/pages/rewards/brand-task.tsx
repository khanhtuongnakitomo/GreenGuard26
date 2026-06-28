/**
 * GreenGuard — Brand Task Detail Screen
 *
 * Figma:
 * - AppHeader + bell
 * - "Tasks" centered title
 * - "Filter: CocaCola" chip
 * - Vertical list of TaskCards:
 *   - Large brand logo (left) + "Obtain 100pts" header + expiry
 *   - Progress state button: "80/100" (in-progress) or "Completed" (green)
 */
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/common/AppHeader';
import { FilterChip } from '@/components/common/FilterChip';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { MOCK_TASKS } from '@/constants/mockData';
import { Task } from '@/types/reward.types';

function TaskCard({ task }: { task: Task }) {
  const isCompleted = task.status === 'completed';
  const isInProgress = task.status === 'in_progress';
  const brandInitial = task.brandName.charAt(0).toUpperCase();
  const brandColor = task.brandColor ?? Colors.primary;

  return (
    <View style={styles.taskCard}>
      {/* Left: Brand logo (large circle) */}
      <View style={[styles.brandCircle, { backgroundColor: brandColor }]}>
        <Text style={styles.brandInitial}>{brandInitial}</Text>
      </View>

      {/* Right: Info + action */}
      <View style={styles.taskInfo}>
        <View style={styles.taskHeader}>
          <Text style={styles.taskTitle}>{task.title}</Text>
          <Text style={styles.taskExpiry}>Ends on {task.expiresAt}</Text>
        </View>

        {/* Progress / Completed button */}
        <TouchableOpacity
          style={[
            styles.progressButton,
            isCompleted ? styles.completedButton : styles.inProgressButton,
          ]}
          activeOpacity={0.85}
          disabled={isCompleted}
        >
          <Text style={[
            styles.progressLabel,
            isCompleted ? styles.completedLabel : styles.inProgressLabel,
          ]}>
            {isCompleted
              ? 'Completed'
              : `${task.currentPoints}/${task.targetPoints}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function BrandTaskScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader rightIcon="bell" onRightIconPress={() => {}} showBack />

      <View style={styles.container}>
        {/* Title */}
        <Text style={styles.title}>Tasks</Text>

        {/* Filter chip */}
        <View style={styles.filterRow}>
          <FilterChip label="Filter: CocaCola" active={false} />
        </View>

        {/* Task list */}
        <FlatList
          data={MOCK_TASKS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TaskCard task={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.screenHorizontal,
  },
  title: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  filterRow: {
    marginBottom: Spacing.md,
  },
  listContent: {
    gap: Spacing.md,
    paddingBottom: Spacing['3xl'],
  },
  // TaskCard styles
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.card,
    padding: Spacing.base,
    gap: Spacing.base,
    ...Shadows.xs,
  },
  brandCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandInitial: {
    fontSize: FontSize['5xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  taskInfo: {
    flex: 1,
    gap: Spacing.sm,
  },
  taskHeader: {
    gap: 2,
  },
  taskTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  taskExpiry: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  progressButton: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  inProgressButton: {
    backgroundColor: Colors.primary,
  },
  completedButton: {
    backgroundColor: Colors.accentSoft,
  },
  progressLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
  },
  inProgressLabel: {
    color: Colors.textWhite,
  },
  completedLabel: {
    color: Colors.primary,
  },
});
