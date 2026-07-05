import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useDashboard } from '../../hooks/useDashboard';
import { formatFriendlyDate } from '../../utils/helpers';
import { JournalEntryScreen } from './JournalEntryScreen';
import { router } from 'expo-router';

export function JournalScreen() {
  const { bucketItems, isLoading, fetchBucketItems, updateBucketItem } = useDashboard();
  const journals = bucketItems['journals'] || [];
  
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  useEffect(() => {
    fetchBucketItems('journals');
  }, []);

  const handleUpdateContent = (entry: any, newContent: string) => {
    updateBucketItem('journals', entry.id, {
      title: entry.title,
      content: newContent
    });
  };

  const selectedEntry = journals.find(j => j.id === selectedEntryId);

  // If a journal is selected, render the Entry detail screen
  if (selectedEntry) {
    return (
      <JournalEntryScreen
        entry={selectedEntry}
        onUpdate={(newText) => handleUpdateContent(selectedEntry, newText)}
        onBack={() => setSelectedEntryId(null)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>◀ Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📓 Journal</Text>
      </View>

      {isLoading && journals.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#a855f7" size="large" />
        </View>
      ) : journals.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No journal entries yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {journals.map((journal) => (
            <TouchableOpacity
              key={journal.id}
              style={styles.item}
              onPress={() => setSelectedEntryId(journal.id)}
              activeOpacity={0.7}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemDate}>{formatFriendlyDate(journal.journal_date)}</Text>
                <Text style={styles.arrow}>➔</Text>
              </View>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {journal.title}
              </Text>
            </TouchableOpacity>
          ))}
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
    gap: 12,
  },
  item: {
    backgroundColor: '#13131c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemDate: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '600',
    color: '#a855f7',
  },
  arrow: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.3)',
  },
  itemTitle: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
