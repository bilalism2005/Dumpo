import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardScreen } from '../../screens/DashboardScreen';
import { ChatScreen } from '../../screens/ChatScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AuthenticatedIndex() {
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const insets = useSafeAreaInsets();

  const handleScroll = (event: any) => {
    const xOffset = event.nativeEvent.contentOffset.x;
    // Calculate current page based on scroll offset threshold
    const index = Math.round(xOffset / SCREEN_WIDTH);
    if (index !== activeIndex && (index === 0 || index === 1)) {
      setActiveIndex(index);
    }
  };

  const navigateToTab = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    setActiveIndex(index);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
        contentContainerStyle={{ width: SCREEN_WIDTH * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <DashboardScreen />
        </View>
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <ChatScreen />
        </View>
      </ScrollView>

      {/* Custom Bottom Tab Bar */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => navigateToTab(0)}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabIcon, { opacity: activeIndex === 0 ? 1 : 0.4 }]}>📊</Text>
          <Text style={[styles.tabLabel, { color: activeIndex === 0 ? '#a855f7' : 'rgba(255, 255, 255, 0.4)' }]}>
            Dashboard
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => navigateToTab(1)}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabIcon, { opacity: activeIndex === 1 ? 1 : 0.4 }]}>💬</Text>
          <Text style={[styles.tabLabel, { color: activeIndex === 1 ? '#a855f7' : 'rgba(255, 255, 255, 0.4)' }]}>
            Chat
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#121218',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    height: 64,
    paddingTop: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabLabel: {
    fontFamily: 'System',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  tabIcon: {
    fontSize: 20,
  },
});
