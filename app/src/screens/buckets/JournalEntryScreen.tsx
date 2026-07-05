import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { InlineEditText } from '../../components/shared/InlineEditText';
import { formatFriendlyDate } from '../../utils/helpers';
import { router } from 'expo-router';

interface JournalEntryScreenProps {
  entry: any;
  onUpdate: (updatedText: string) => void;
  onBack: () => void;
}

export function JournalEntryScreen({ entry, onUpdate, onBack }: JournalEntryScreenProps) {
  const moodColors: Record<string, string> = {
    positive: '#22c55e',
    negative: '#ef4444',
    neutral: '#3b82f6'
  };

  const moodEmojis: Record<string, string> = {
    positive: '😊 Happy',
    negative: '😔 Low',
    neutral: '😐 Neutral'
  };

  const moodColor = moodColors[entry.mood_signal || 'neutral'];

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>◀ Journal List</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Journal Entry</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Date and Mood */}
        <View style={styles.metaRow}>
          <Text style={styles.dateText}>{formatFriendlyDate(entry.journal_date)}</Text>
          <View style={[styles.moodBadge, { borderColor: moodColor, backgroundColor: `${moodColor}15` }]}>
            <Text style={[styles.moodText, { color: moodColor }]}>
              {moodEmojis[entry.mood_signal || 'neutral']}
            </Text>
          </View>
        </View>

        {/* Entry Title */}
        <Text style={styles.entryTitle}>{entry.title}</Text>

        {/* Content Box */}
        <View style={styles.card}>
          <InlineEditText
            value={entry.content}
            onChange={onUpdate}
            style={styles.cardContent}
            placeholder="Write your thoughts..."
            multiline={true}
          />
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
  scrollContent: {
    padding: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dateText: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  moodBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  moodText: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '700',
  },
  entryTitle: {
    fontFamily: 'System',
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#13131c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    minHeight: 300,
  },
  cardContent: {
    fontSize: 15,
    color: '#e4e4e7',
    lineHeight: 24,
  },
});
