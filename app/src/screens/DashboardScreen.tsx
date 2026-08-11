import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar } from '../components/dashboard/ProgressBar';
import { BucketGrid } from '../components/dashboard/BucketGrid';
import { useDashboard } from '../hooks/useDashboard';
import { router } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function DashboardScreen() {
  const { 
    todayTasks, 
    somedayTasks = [],
    overdueTasks, 
    overdueCount, 
    bucketItems = {},
    isLoading, 
    toggleTaskComplete 
  } = useDashboard();

  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const cardScrollRef = useRef<ScrollView>(null);
  const cardWidth = SCREEN_WIDTH - 32;

  const ideas = bucketItems['ideas'] || [];
  const journals = bucketItems['journals'] || [];

  // Combine today's and someday's tasks
  const combinedTasks = [...todayTasks, ...somedayTasks];

  // Sort combined tasks: unticked at top, ticked at bottom.
  combinedTasks.sort((a, b) => {
    if (a.is_complete && !b.is_complete) return 1;
    if (!a.is_complete && b.is_complete) return -1;
    
    if (a.is_complete && b.is_complete) {
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return bTime - aTime;
    }
    
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Calculate completion percentage based on combined tasks
  const completedCombined = combinedTasks.filter(t => t.is_complete).length;
  const totalCombined = combinedTasks.length;

  const handleTapBucket = (bucketKey: string) => {
    router.push(`/buckets/${bucketKey}`);
  };

  const handleCardScroll = (event: any) => {
    const xOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(xOffset / cardWidth);
    if (index >= 0 && index <= 2 && index !== activeCardIndex) {
      setActiveCardIndex(index);
    }
  };

  const scrollToCard = (index: number) => {
    cardScrollRef.current?.scrollTo({ x: index * cardWidth, animated: true });
    setActiveCardIndex(index);
  };

  const hasAnyData = combinedTasks.length > 0 || ideas.length > 0 || journals.length > 0;

  return (
    <SafeAreaView style={styles.safeContainer}>
      {isLoading && !hasAnyData ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color="#a855f7" size="large" />
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

          {/* Section 1: Swipeable Cards (Tasks | Ideas | Journal) */}
          <View style={styles.section}>
            {/* Card Switcher Tabs */}
            <View style={styles.cardHeaderRow}>
              <TouchableOpacity 
                style={[styles.cardHeaderTab, activeCardIndex === 0 && styles.cardHeaderTabActive]}
                onPress={() => scrollToCard(0)}
                activeOpacity={0.8}
              >
                <Text style={[styles.cardHeaderTabTitle, activeCardIndex === 0 && styles.cardHeaderTabTitleActive]}>
                  Tasks
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.cardHeaderTab, activeCardIndex === 1 && styles.cardHeaderTabActive]}
                onPress={() => scrollToCard(1)}
                activeOpacity={0.8}
              >
                <Text style={[styles.cardHeaderTabTitle, activeCardIndex === 1 && styles.cardHeaderTabTitleActive]}>
                  Ideas
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.cardHeaderTab, activeCardIndex === 2 && styles.cardHeaderTabActive]}
                onPress={() => scrollToCard(2)}
                activeOpacity={0.8}
              >
                <Text style={[styles.cardHeaderTabTitle, activeCardIndex === 2 && styles.cardHeaderTabTitleActive]}>
                  Journal
                </Text>
              </TouchableOpacity>
            </View>

            {/* Horizontal Cards ScrollView */}
            <ScrollView
              ref={cardScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleCardScroll}
              scrollEventThrottle={16}
              decelerationRate="fast"
              snapToInterval={cardWidth}
              contentContainerStyle={{ width: cardWidth * 3 }}
            >
              {/* CARD 1: TASKS */}
              <View style={{ width: cardWidth }}>
                <ProgressBar completed={completedCombined} total={totalCombined} />
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
              </View>

              {/* CARD 2: IDEAS */}
              <View style={{ width: cardWidth }}>
                <View style={styles.cardHeaderSub}>
                  <Text style={styles.cardSubTitle}>Recent Ideas</Text>
                  <TouchableOpacity onPress={() => router.push('/buckets/ideas')}>
                    <Text style={styles.seeAllText}>See All ➔</Text>
                  </TouchableOpacity>
                </View>
                {ideas.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No ideas logged yet</Text>
                  </View>
                ) : (
                  <View style={styles.taskListCard}>
                    <ScrollView style={styles.tasksScrollContainer} nestedScrollEnabled={true}>
                      {ideas.slice(0, 10).map((idea: any) => (
                        <TouchableOpacity
                          key={idea.id}
                          style={styles.previewItem}
                          onPress={() => router.push('/buckets/ideas')}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.previewBullet}>💡</Text>
                          <Text style={styles.previewText} numberOfLines={1}>
                            {idea.title || idea.description || 'Untitled Idea'}
                          </Text>
                          <Text style={styles.previewArrow}>➔</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* CARD 3: JOURNAL */}
              <View style={{ width: cardWidth }}>
                <View style={styles.cardHeaderSub}>
                  <Text style={styles.cardSubTitle}>Recent Journal Entries</Text>
                  <TouchableOpacity onPress={() => router.push('/buckets/journals')}>
                    <Text style={styles.seeAllText}>See All ➔</Text>
                  </TouchableOpacity>
                </View>
                {journals.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No journal entries logged yet</Text>
                  </View>
                ) : (
                  <View style={styles.taskListCard}>
                    <ScrollView style={styles.tasksScrollContainer} nestedScrollEnabled={true}>
                      {journals.slice(0, 10).map((entry: any) => (
                        <TouchableOpacity
                          key={entry.id}
                          style={styles.previewItem}
                          onPress={() => router.push('/buckets/journals')}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.previewBullet}>📓</Text>
                          <Text style={styles.previewText} numberOfLines={1}>
                            {entry.title || entry.content || 'Untitled Journal'}
                          </Text>
                          <Text style={styles.previewArrow}>➔</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Pagination Dot Indicator */}
            <View style={styles.paginationDotsRow}>
              <View style={[styles.dot, activeCardIndex === 0 && styles.dotActive]} />
              <View style={[styles.dot, activeCardIndex === 1 && styles.dotActive]} />
              <View style={[styles.dot, activeCardIndex === 2 && styles.dotActive]} />
            </View>

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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
    gap: 8,
  },
  cardHeaderTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardHeaderTabActive: {
    backgroundColor: '#a855f7',
  },
  cardHeaderTabTitle: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  cardHeaderTabTitleActive: {
    color: '#ffffff',
  },
  cardHeaderSub: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  cardSubTitle: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  seeAllText: {
    fontFamily: 'System',
    fontSize: 13,
    color: '#a855f7',
    fontWeight: '600',
  },
  previewItem: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  previewBullet: {
    fontSize: 16,
    marginRight: 10,
  },
  previewText: {
    fontFamily: 'System',
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    flex: 1,
  },
  previewArrow: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.3)',
    marginLeft: 8,
  },
  paginationDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#a855f7',
  },
});
