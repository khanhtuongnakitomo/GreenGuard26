/**
 * GreenGuard — Milestone progress detail (live)
 */
import React from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/common/AppHeader';
import { TaskProgressRow } from '@/components/rewards/TaskProgressRow';
import { Colors, Spacing, FontSize, FontWeight } from '@/theme';
import { useMilestoneTasks } from '@/hooks/useApi';

export default function BrandTaskScreen() {
  const { data: tasks = [], isLoading } = useMilestoneTasks();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader showBack rightIcon="none" />
      <Text style={styles.title}>Milestones</Text>
      <Text style={styles.subtitle}>Track your recycling achievements</Text>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TaskProgressRow
                label={item.title}
                current={item.currentPoints}
                target={item.targetPoints}
              />
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No milestones configured yet.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundScreen },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    paddingHorizontal: Spacing.base,
    color: Colors.textPrimary,
  },
  subtitle: {
    paddingHorizontal: Spacing.base,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  list: { padding: Spacing.base, paddingBottom: Spacing['3xl'] },
  row: { marginBottom: Spacing.md },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
});
