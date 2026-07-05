import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/authStore';

export default function RootLayout() {
  const { loadSession } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
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
