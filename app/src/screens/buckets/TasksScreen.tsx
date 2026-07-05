import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useDashboard } from '../../hooks/useDashboard';
import { InlineEditText } from '../../components/shared/InlineEditText';
import { formatTaskDateHeader } from '../../utils/helpers';
import { LoadMoreButton } from '../../components/shared/LoadMoreButton';
import { router } from 'expo-router';

export function TasksScreen() {
  const { bucketItems, isLoading, fetchBucketItems, toggleTaskComplete, toggleTaskReminder, updateBucketItem } = useDashboard();
  const tasks = bucketItems['tasks'] || [];
  
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchBucketItems('tasks');
  }, []);

  const handleToggleExpand = (groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  // Group tasks chronologically
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2);
  const dayAfterStr = dayAfter.toISOString().split('T')[0];

  const groups: Record<string, { label: string; items: any[]; isOverdue?: boolean; order: number }> = {
    overdue: { label: 'Overdue', items: [], isOverdue: true, order: 0 },
    past_3: { label: '3 days ago', items: [], order: 1 },
    past_2: { label: '2 days ago', items: [], order: 2 },
    yesterday: { label: 'Yesterday', items: [], order: 3 },
    today: { label: 'TODAY', items: [], order: 4 },
    someday: { label: 'Someday', items: [], order: 5 },
    tomorrow: { label: 'Tomorrow', items: [], order: 6 },
    dayAfter: { label: 'Day after tomorrow', items: [], order: 7 },
    future: { label: 'Future Dates', items: [], order: 8 },
  };

  tasks.forEach((task) => {
    const dueDate = task.due_date;
    
    if (!dueDate) {
      groups.someday.items.push(task);
      return;
    }

    if (dueDate < todayStr && !task.is_complete) {
      groups.overdue.items.push(task);
      return;
    }

    if (dueDate === todayStr) {
      groups.today.items.push(task);
    } else if (dueDate === yesterdayStr) {
      groups.yesterday.items.push(task);
    } else if (dueDate === tomorrowStr) {
      groups.tomorrow.items.push(task);
    } else if (dueDate === dayAfterStr) {
      groups.dayAfter.items.push(task);
    } else if (dueDate < yesterdayStr) {
      // Check exact diff
      const diff = Math.floor((new Date(todayStr).getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 2) groups.past_2.items.push(task);
      else if (diff === 3) groups.past_3.items.push(task);
      else groups.overdue.items.push(task); // Fallback old completed tasks or general past
    } else {
      groups.future.items.push(task);
    }
  });

  const sortedGroups = Object.entries(groups)
    .filter(([_, g]) => g.items.length > 0)
    .sort((a, b) => a[1].order - b[1].order);

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>◀ Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.title}>✅ Tasks</Text>
      </View>

      {isLoading && tasks.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#a855f7" size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {sortedGroups.map(([key, group]) => {
            const isExpanded = !!expandedGroups[key];
            const maxVisible = 5;
            const hasMore = group.items.length > maxVisible;
            const visibleItems = isExpanded ? group.items : group.items.slice(0, maxVisible);
            
            return (
              <View key={key} style={[styles.card, group.isOverdue && styles.overdueCard]}>
                <Text style={[styles.cardHeader, group.isOverdue && styles.overdueCardHeader]}>
                  {group.label}
                </Text>
                
                <View style={styles.taskList}>
                  {visibleItems.map((task) => (
                    <View key={task.id} style={styles.taskItem}>
                      {/* Checkbox (left) */}
                      <TouchableOpacity 
                        style={[
                          styles.checkbox,
                          task.is_complete && styles.checkboxChecked
                        ]}
                        onPress={() => toggleTaskComplete(task.id)}
                      >
                        {task.is_complete && <Text style={styles.checkmark}>✓</Text>}
                      </TouchableOpacity>
                      
                      {/* Title (Inline editable) */}
                      <View style={styles.titleContainer}>
                        <InlineEditText
                          value={task.title}
                          onChange={(newTitle) => updateBucketItem('tasks', task.id, { title: newTitle })}
                          style={[
                            styles.taskText,
                            task.is_complete && styles.taskTextCompleted
                          ]}
                        />
                        {task.due_time && (
                          <Text style={styles.timeText}>🕒 {task.due_time.slice(0, 5)}</Text>
                        )}
                      </View>

                      {/* Reminder Icon (Toggleable) */}
                      <TouchableOpacity 
                        style={styles.reminderBtn}
                        onPress={() => toggleTaskReminder(task.id)}
                      >
                        <Text style={[
                          styles.reminderIcon,
                          task.reminder_set && styles.reminderIconActive
                        ]}>
                          🔔
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {hasMore && (
                  <LoadMoreButton 
                    onPress={() => handleToggleExpand(key)} 
                    isLoading={false} 
                  />
                )}
              </View>
            );
          })}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 60,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#121218',
  },
  backButton: {
    marginRight: 16,
  },
  backText: {
    fontFamily: 'System',
    color: '#a855f7',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontFamily: 'System',
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 20,
  },
  card: {
    backgroundColor: '#13131c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
  },
  overdueCard: {
    borderColor: 'rgba(239, 68, 68, 0.25)',
    backgroundColor: 'rgba(239, 68, 68, 0.02)',
  },
  cardHeader: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  overdueCardHeader: {
    color: '#ef4444',
  },
  taskList: {
    gap: 4,
  },
  taskItem: {
    height: 52, // Fitts's Law: min 48px
    flexDirection: 'row',
    alignItems: 'center',
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
  titleContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  taskText: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '500',
  },
  taskTextCompleted: {
    color: 'rgba(255, 255, 255, 0.35)',
    textDecorationLine: 'line-through',
  },
  timeText: {
    fontFamily: 'System',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.35)',
    marginTop: 2,
  },
  reminderBtn: {
    padding: 8,
  },
  reminderIcon: {
    fontSize: 16,
    opacity: 0.25,
  },
  reminderIconActive: {
    opacity: 1,
  },
});
