import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ProgressBar } from '../components/dashboard/ProgressBar';
import { BucketGrid } from '../components/dashboard/BucketGrid';
import { useDashboard } from '../hooks/useDashboard';
import { router } from 'expo-router';

export function DashboardScreen() {
  const { 
    todayTasks, 
    overdueTasks, 
    overdueCount, 
    isLoading, 
    toggleTaskComplete 
  } = useDashboard();

  // Calculate completion percentage for today's tasks
  const completedToday = todayTasks.filter(t => t.is_complete).length;
  const totalToday = todayTasks.length;

  const handleTapBucket = (bucketKey: string) => {
    // Navigate to the specific bucket screen
    router.push(`/buckets/${bucketKey}`);
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard</Text>
        </View>

        {/* Section 1: Today's To-Do & Progress */}
        <View style={styles.section}>
          <ProgressBar completed={completedToday} total={totalToday} />
          
          {/* Today's Tasks List */}
          <Text style={styles.sectionHeader}>Today's Tasks</Text>
          {totalToday === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No tasks due today</Text>
            </View>
          ) : (
            <View style={styles.taskList}>
              {todayTasks.map((task) => (
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
  title: {
    fontFamily: 'System',
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
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
});
