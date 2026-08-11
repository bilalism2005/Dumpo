import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/authStore';
import { requestNotificationPermissions } from '../services/notificationService';

import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Request notification permissions on app launch
    requestNotificationPermissions();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ 
        headerShown: false, 
        contentStyle: { backgroundColor: '#0a0a0f' },
        animation: 'slide_from_right'
      }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="(app)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="buckets/tasks" />
        <Stack.Screen name="buckets/ideas" />
        <Stack.Screen name="buckets/journals" />
        <Stack.Screen name="buckets/finance" />
        <Stack.Screen name="buckets/health" />
        <Stack.Screen name="buckets/watchlist" />
        <Stack.Screen name="buckets/others" />
      </Stack>
    </>
  );
}
