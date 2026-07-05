import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ProgressBarProps {
  completed: number;
  total: number;
}

export function ProgressBar({ completed, total }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: percentage / 100,
      duration: 600,
      useNativeDriver: false, // width/flex isn't supported by native driver
    }).start();
  }, [percentage]);

  // Interpolate for layout positioning of glowing dot
  const widthInterpolation = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* 1. Percentage Text */}
      <View style={styles.header}>
        <View style={styles.percentRow}>
          <Text style={styles.percentText}>{percentage}</Text>
          <Text style={styles.percentSymbol}>%</Text>
        </View>
        <Text style={styles.subtitle}>of your day done</Text>
      </View>

      {/* 2. ProgressBar Track */}
      <View style={styles.track}>
        {/* Animated Fill wrapper */}
        <Animated.View style={[styles.fillWrapper, { width: widthInterpolation }]}>
          <LinearGradient
            colors={['#a855f7', '#22c55e']} // Purple to Green gradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientFill}
          />
          {/* Glowing dot at the end point */}
          <View style={styles.glowDotContainer}>
            <View style={styles.outerGlow} />
            <View style={styles.innerDot} />
          </View>
        </Animated.View>
      </View>
      
      {/* 3. Helper Info */}
      <View style={styles.footer}>
        <Text style={styles.countText}>
          {completed} of {total} tasks completed
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#13131c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 12,
  },
  header: {
    marginBottom: 16,
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  percentText: {
    fontFamily: 'System',
    fontSize: 52,
    fontWeight: '800',
    color: '#ffffff',
  },
  percentSymbol: {
    fontFamily: 'System',
    fontSize: 24,
    fontWeight: '600',
    color: '#22c55e', // Green accent
    marginLeft: 2,
  },
  subtitle: {
    fontFamily: 'System',
    fontSize: 14,
    fontStyle: 'italic',
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: -4,
  },
  track: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 6,
    position: 'relative',
    overflow: 'visible', // Allow glow dot to pop out
  },
  fillWrapper: {
    height: '100%',
    position: 'relative',
    borderRadius: 6,
    overflow: 'visible',
    flexDirection: 'row',
  },
  gradientFill: {
    flex: 1,
    height: '100%',
    borderRadius: 6,
  },
  glowDotContainer: {
    position: 'absolute',
    right: -8,
    top: -4,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  outerGlow: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22c55e',
    opacity: 0.35,
  },
  innerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  footer: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  countText: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
  },
});
