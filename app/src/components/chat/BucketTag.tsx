import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

interface BucketTagProps {
  label: string;
  onPress?: () => void;
}

export function BucketTag({ label, onPress }: BucketTagProps) {
  return (
    <TouchableOpacity
      style={styles.tag}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 6,
    marginRight: 6,
  },
  text: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
});
