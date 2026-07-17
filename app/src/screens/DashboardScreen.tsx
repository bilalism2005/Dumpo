import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar } from '../components/dashboard/ProgressBar';
import { BucketGrid } from '../components/dashboard/BucketGrid';
import { useDashboard } from '../hooks/useDashboard';
import { router } from 'expo-router';

export function DashboardScreen() {
  const { 
    todayTasks, 
    somedayTasks = [],
    overdueTasks, 
    overdueCount, 
    isLoading, 
    toggleTaskComplete 
  } = useDashboard();

  // Combine today's and someday's tasks
  const combinedTasks = [...todayTasks, ...somedayTasks];

  // Sort combined tasks by created_at descending (latest entry first)
  combinedTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Calculate completion percentage based on combined tasks
  const completedCombined = combinedTasks.filter(t => t.is_complete).length;
  const totalCombined = combinedTasks.length;

  const handleTapBucket = (bucketKey: string) => {
    // Navigate to the specific bucket screen
    router.push(`/buckets/${bucketKey}`);
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color="#a855f7" size="large" />
          <Text style={styles.loaderText}>Waking up Dumpo backend...</Text>
          <Text style={styles.loaderSubtext}>This can take up to 50 seconds if the app was idle.</Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Title */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.headerSubtitle}>Keep your thought streams clear</Text>
          </View>

          {/* Section 1: Today's To-Do & Progress */}
          <View style={styles.section}>
            <ProgressBar completed={completedCombined} total={totalCombined} />
          
          {/* Combined Tasks List (Scrollable Card) */}
          <Text style={styles.sectionHeader}>Tasks List</Text>
          {totalCombined === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No tasks for today or someday</Text>
            </View>
          ) : (
            <View style={styles.taskListCard}>
              <ScrollView 
                style={styles.tasksScrollContainer} 
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                {combinedTasks.map((task) => (
                  <TouchableOpacity 
                    key={task.id} 
                    style={styles.taskItem}
                    onPress={() => toggleTaskComplete(task.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.checkbox,
                      task.is_complete && styles.checkboxChecked
                    ]}>
                      {task.is_complete && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[
                      styles.taskText,
                      task.is_complete && styles.taskTextCompleted
                    ]}>
                      {task.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Overdue Tasks Section */}
          {overdueCount > 0 && (
            <View style={styles.overdueContainer}>
              <Text style={[styles.sectionHeader, styles.overdueHeader]}>Overdue Tasks ({overdueCount})</Text>
              <View style={styles.taskList}>
                {overdueTasks.map((task) => (
                  <TouchableOpacity 
                    key={task.id} 
                    style={styles.taskItem}
                    onPress={() => toggleTaskComplete(task.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.checkbox}>
                      {task.is_complete && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.taskText, styles.overdueTaskText]}>
                      {task.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Section 2: Bucket Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Your Buckets</Text>
          <BucketGrid onTapBucket={handleTapBucket} />
        </View>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginVertical: 12,
  },
  headerTitle: {
    fontFamily: 'System',
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontFamily: 'System',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 16,
  },
  emptyState: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#13131c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyStateText: {
    fontFamily: 'System',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
    fontStyle: 'italic',
  },
  taskList: {
    backgroundColor: '#13131c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
  },
  taskItem: {
    height: 52, // Fitts's Law: min 48px
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  checkboxChecked: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  checkmark: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '800',
    marginTop: -2,
  },
  taskText: {
    fontFamily: 'System',
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '500',
    flex: 1,
  },
  taskTextCompleted: {
    color: 'rgba(255, 255, 255, 0.35)',
    textDecorationLine: 'line-through',
  },
  overdueContainer: {
    marginTop: 20,
  },
  overdueHeader: {
    color: '#ef4444',
  },
  overdueTaskText: {
    color: '#ef4444',
  },
  taskListCard: {
    backgroundColor: '#13131c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 4,
  },
  tasksScrollContainer: {
    maxHeight: 220,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  loaderText: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12,
  },
  loaderSubtext: {
    fontFamily: 'System',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
});
