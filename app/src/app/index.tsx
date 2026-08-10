import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

export default function IndexRoute() {
  const { session, isLoading, loadSession } = useAuthStore();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });
    
    if (useAuthStore.persist.hasHydrated()) {
      setHasHydrated(true);
    }
    
    return () => unsub();
  }, []);

  // Once hydrated, decide immediately
  useEffect(() => {
    if (!hasHydrated) return;

    const cachedSession = useAuthStore.getState().session;

    if (cachedSession) {
      // We have a cached session — route IMMEDIATELY, refresh token silently in background
      SplashScreen.hideAsync();
      setReady(true);
      loadSession(); // silent background refresh
    } else {
      // No cached session — need to check network
      loadSession();
    }
  }, [hasHydrated]);

  // Handle the case where there was no cached session and loadSession finishes
  useEffect(() => {
    if (hasHydrated && !isLoading && !ready) {
      SplashScreen.hideAsync();
      setReady(true);
    }
  }, [hasHydrated, isLoading, ready]);

  if (!ready) {
    // Keep splash screen visible — render nothing
    return null;
  }

  // Redirect based on session status
  if (session) {
    return <Redirect href="/(app)" />;
  }

  return <Redirect href="/auth/login" />;
}
