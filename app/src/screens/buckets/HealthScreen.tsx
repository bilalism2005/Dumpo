import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useDashboard } from '../../hooks/useDashboard';
import { InlineEditText } from '../../components/shared/InlineEditText';
import { formatFriendlyDate } from '../../utils/helpers';
import { router } from 'expo-router';

const CATEGORIES = [
  { key: 'physical', name: 'Physical', icon: '🏃‍♂️', description: 'Workouts, runs, activities' },
  { key: 'mental', name: 'Mental', icon: '🧠', description: 'Mindfulness, sleep patterns, mood' },
  { key: 'medical', name: 'Medical', icon: '🏥', description: 'Symptoms, doctor logs, meds' },
  { key: 'nutrition', name: 'Nutrition', icon: '🥗', description: 'Diets, meals, hydration' }
];

export function HealthScreen() {
  const { bucketItems, isLoading, fetchBucketItems, updateBucketItem } = useDashboard();
  const entries = bucketItems['health'] || [];

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  useEffect(() => {
    fetchBucketItems('health');
  }, []);

  const handleUpdate = (entryId: string, updatedFields: any) => {
    const entry = entries.find(e => e.id === entryId);
    if (entry) {
      updateBucketItem('health', entryId, {
        title: updatedFields.title ?? entry.title,
        description: updatedFields.description ?? entry.description,
        health_type: entry.health_type
      });
    }
  };

  const selectedEntry = entries.find(e => e.id === selectedEntryId);

  // Level 3: Detailed Entry Screen
  if (selectedEntry) {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => setSelectedEntryId(null)}>
            <Text style={styles.backText}>◀ Category List</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Health Log Details</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.dateHeader}>
            {formatFriendlyDate(selectedEntry.created_at)}
          </Text>
          
          <View style={styles.detailsCard}>
            <InlineEditText
              value={selectedEntry.title}
              onChange={(newTitle) => handleUpdate(selectedEntry.id, { title: newTitle })}
              style={styles.detailsTitle}
              placeholder="Title"
            />
            <View style={styles.divider} />
            <InlineEditText
              value={selectedEntry.description || ''}
              onChange={(newDesc) => handleUpdate(selectedEntry.id, { description: newDesc })}
              style={styles.detailsDesc}
              placeholder="Add logs, metrics, or notes..."
              multiline={true}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Level 2: Date-wise List for selected category
  if (activeCategory) {
    const filteredEntries = entries.filter(
      e => e.health_type.toLowerCase() === activeCategory
    );
    const categoryInfo = CATEGORIES.find(c => c.key === activeCategory);

    return (
      <SafeAreaView style={styles.safeContainer}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => setActiveCategory(null)}>
            <Text style={styles.backText}>◀ Categories</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {categoryInfo?.icon} {categoryInfo?.name} Logs
          </Text>
        </View>

        {filteredEntries.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No logs for this category.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.listCardContainer}>
              {filteredEntries.map((entry) => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.listItem}
                  onPress={() => setSelectedEntryId(entry.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.listItemHeader}>
                    <Text style={styles.listItemDate}>
                      {formatFriendlyDate(entry.created_at)}
                    </Text>
                    <Text style={styles.arrow}>➔</Text>
                  </View>
                  <Text style={styles.listItemTitle} numberOfLines={1}>
                    {entry.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // Level 1: Category Grid (2x2)
  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>◀ Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.title}>❤️ Health</Text>
      </View>

      {isLoading && entries.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#a855f7" size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.gridHeading}>Choose Category</Text>
          
          <View style={styles.grid}>
            {CATEGORIES.map((cat) => {
              const count = entries.filter(e => e.health_type.toLowerCase() === cat.key).length;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={styles.gridCard}
                  onPress={() => setActiveCategory(cat.key)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.gridIcon}>{cat.icon}</Text>
                  <Text style={styles.gridName}>{cat.name}</Text>
                  <Text style={styles.gridDesc}>{cat.description}</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{count} logs</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
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
  emptyText: {
    fontFamily: 'System',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 15,
  },
  scrollContent: {
    padding: 16,
  },
  gridHeading: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  gridCard: {
    width: '50% - 12px',
    backgroundColor: '#13131c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    margin: 6,
    minHeight: 160,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  gridIcon: {
    fontSize: 36,
  },
  gridName: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 8,
  },
  gridDesc: {
    fontFamily: 'System',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 4,
  },
  countBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 12,
  },
  countBadgeText: {
    fontFamily: 'System',
    fontSize: 10,
    fontWeight: '600',
    color: '#a855f7',
  },
  listCardContainer: {
    backgroundColor: '#13131c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
  },
  listItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  listItemDate: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '600',
    color: '#a855f7',
  },
  arrow: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.3)',
  },
  listItemTitle: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  dateHeader: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 16,
  },
  detailsCard: {
    backgroundColor: '#13131c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 18,
    minHeight: 250,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 8,
  },
  detailsDesc: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 20,
  },
});
