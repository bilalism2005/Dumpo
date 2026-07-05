import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface LoadMoreButtonProps {
  onPress: () => void;
  isLoading?: boolean;
}

export function LoadMoreButton({ onPress, isLoading = false }: LoadMoreButtonProps) {
  return (
    <TouchableOpacity 
      style={styles.button} 
      onPress={onPress} 
      disabled={isLoading}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator color="#a855f7" />
      ) : (
        <Text style={styles.text}>Load more</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48, // Fitts's Law: min 48px
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginVertical: 12,
  },
  text: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '600',
    color: '#a855f7', // Purple accent
  },
});
