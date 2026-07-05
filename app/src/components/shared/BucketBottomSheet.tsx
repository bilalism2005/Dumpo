import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';

interface BucketBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectBucket: (bucketKey: string) => void;
  currentBucket?: string;
}

const BUCKETS = [
  { key: 'tasks', name: 'Tasks', icon: '✅' },
  { key: 'ideas', name: 'Ideas', icon: '💡' },
  { key: 'journals', name: 'Journal', icon: '📓' },
  { key: 'finance', name: 'Finance', icon: '💰' },
  { key: 'health', name: 'Health', icon: '❤️' },
  { key: 'watchlist', name: 'Watchlist', icon: '🎬' },
  { key: 'others', name: 'Others', icon: '📦' },
];

export function BucketBottomSheet({
  isVisible,
  onClose,
  onSelectBucket,
  currentBucket,
}: BucketBottomSheetProps) {
  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheetContainer}>
          <View style={styles.dragHandle} />
          
          <Text style={styles.title}>Move to Bucket</Text>
          
          <View style={styles.listContainer}>
            {BUCKETS.map((bucket) => {
              const isSelected = currentBucket === bucket.key;
              return (
                <TouchableOpacity
                  key={bucket.key}
                  style={[
                    styles.item,
                    isSelected && styles.selectedItem
                  ]}
                  onPress={() => {
                    onSelectBucket(bucket.key);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.itemIcon}>{bucket.icon}</Text>
                  <Text style={[
                    styles.itemText,
                    isSelected && styles.selectedItemText
                  ]}>
                    {bucket.name}
                  </Text>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0f0f15', // Sleek dark mode
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'System',
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  listContainer: {
    gap: 8,
  },
  item: {
    height: 52, // Fitts's Law: min 48px
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  selectedItem: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
  },
  itemIcon: {
    fontSize: 18,
    marginRight: 14,
  },
  itemText: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    flex: 1,
  },
  selectedItemText: {
    color: '#a855f7',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: '#a855f7',
    fontWeight: '700',
  },
});
