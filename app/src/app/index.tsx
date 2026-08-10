import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

export default function IndexRoute() {
  const { session, isLoading, loadSession } = useAuthStore();
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
      loadSession();
    });
    
    if (useAuthStore.persist.hasHydrated()) {
      setHasHydrated(true);
      loadSession();
    }
    
    return () => unsub();
  }, []);

  useEffect(() => {
    if (hasHydrated && !isLoading) {
      // Hide splash screen smoothly only when we are ready to route!
      SplashScreen.hideAsync();
    }
  }, [hasHydrated, isLoading]);

  if (!hasHydrated || isLoading) {
    // Return null so the Native Splash Screen stays uninterrupted
    return null;
  }

  // Redirect based on session status
  if (session) {
    return <Redirect href="/(app)" />;
  }

  return <Redirect href="/auth/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
