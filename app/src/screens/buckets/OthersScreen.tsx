import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useDashboard } from '../../hooks/useDashboard';
import { InlineEditText } from '../../components/shared/InlineEditText';
import { BucketBottomSheet } from '../../components/shared/BucketBottomSheet';
import { formatFriendlyDate } from '../../utils/helpers';
import { router } from 'expo-router';

export function OthersScreen() {
  const { bucketItems, isLoading, fetchBucketItems, updateBucketItem, reclassifyBucketItem } = useDashboard();
  const others = bucketItems['others'] || [];
  
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    fetchBucketItems('others');
  }, []);

  const handleOpenReclassify = (itemId: string) => {
    setSelectedItemId(itemId);
    setSheetVisible(true);
  };

  const handleSelectBucket = (toBucket: string) => {
    if (selectedItemId) {
      reclassifyBucketItem('others', selectedItemId, toBucket);
      setSelectedItemId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>◀ Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📦 Others</Text>
      </View>

      {isLoading && others.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#a855f7" size="large" />
        </View>
      ) : others.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No items here yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {others.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardDate}>
                  {formatFriendlyDate(item.created_at)}
                </Text>
                
                {/* Actions row: Move button */}
                <TouchableOpacity
                  style={styles.moveButton}
                  onPress={() => handleOpenReclassify(item.id)}
                >
                  <Text style={styles.moveButtonText}>Move ➔</Text>
                </TouchableOpacity>
              </View>

              <InlineEditText
                value={item.raw_text}
                onChange={(newText) => updateBucketItem('others', item.id, { raw_text: newText })}
                style={styles.cardText}
                placeholder="Type raw logs here..."
                multiline={true}
              />
            </View>
          ))}
        </ScrollView>
      )}

      {/* Reclassify Modal */}
      <BucketBottomSheet
        isVisible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSelectBucket={handleSelectBucket}
        currentBucket="others"
      />
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
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    paddingBottom: 8,
  },
  cardDate: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  moveButton: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  moveButtonText: {
    fontFamily: 'System',
    fontSize: 11,
    fontWeight: '700',
    color: '#a855f7',
  },
  cardText: {
    fontSize: 14,
    color: '#e4e4e7',
    lineHeight: 22,
  },
});
