import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BucketTile } from './BucketTile';

interface BucketGridProps {
  onTapBucket: (bucketKey: string) => void;
}

export function BucketGrid({ onTapBucket }: BucketGridProps) {
  return (
    <View style={styles.gridContainer}>
      {/* Row 1: Tasks & Ideas */}
      <View style={styles.row}>
        <BucketTile 
          name="Tasks" 
          icon="✅" 
          onPress={() => onTapBucket('tasks')} 
        />
        <BucketTile 
          name="Ideas" 
          icon="💡" 
          onPress={() => onTapBucket('ideas')} 
        />
      </View>
      
      {/* Row 2: Finance & Health */}
      <View style={styles.row}>
        <BucketTile 
          name="Finance" 
          icon="💰" 
          onPress={() => onTapBucket('finance')} 
        />
        <BucketTile 
          name="Health" 
          icon="❤️" 
          onPress={() => onTapBucket('health')} 
        />
      </View>
      
      {/* Row 3: Journal & Watchlist */}
      <View style={styles.row}>
        <BucketTile 
          name="Journal" 
          icon="📓" 
          onPress={() => onTapBucket('journals')} 
        />
        <BucketTile 
          name="Watchlist" 
          icon="🎬" 
          onPress={() => onTapBucket('watchlist')} 
        />
      </View>
      
      {/* Row 4: Others & Empty Spacer */}
      <View style={styles.row}>
        <BucketTile 
          name="Others" 
          icon="📦" 
          onPress={() => onTapBucket('others')} 
        />
        <View style={styles.emptySpacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emptySpacer: {
    flex: 1,
    margin: 6,
    height: 110,
    backgroundColor: 'transparent',
  },
});
