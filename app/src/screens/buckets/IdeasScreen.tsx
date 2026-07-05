import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useDashboard } from '../../hooks/useDashboard';
import { InlineEditText } from '../../components/shared/InlineEditText';
import { router } from 'expo-router';

export function IdeasScreen() {
  const { bucketItems, isLoading, fetchBucketItems, updateBucketItem } = useDashboard();
  const ideas = bucketItems['ideas'] || [];

  useEffect(() => {
    fetchBucketItems('ideas');
  }, []);

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>◀ Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.title}>💡 Ideas</Text>
      </View>

      {isLoading && ideas.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#a855f7" size="large" />
        </View>
      ) : ideas.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No ideas recorded yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {ideas.map((idea) => (
            <View key={idea.id} style={styles.card}>
              <InlineEditText
                value={idea.title}
                onChange={(newTitle) => updateBucketItem('ideas', idea.id, { title: newTitle, description: idea.description })}
                style={styles.cardTitle}
                placeholder="Idea title"
              />
              <View style={styles.divider} />
              <InlineEditText
                value={idea.description || ''}
                onChange={(newDesc) => updateBucketItem('ideas', idea.id, { title: idea.title, description: newDesc })}
                style={styles.cardDesc}
                placeholder="Add more details about this idea..."
                multiline={true}
              />
            </View>
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
    gap: 16,
  },
  card: {
    backgroundColor: '#13131c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 18,
  },
  cardTitle: {
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
  cardDesc: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 20,
  },
});
