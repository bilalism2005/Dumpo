import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

export default function IndexRoute() {
  const { session, isLoading, loadSession } = useAuthStore();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [ready, setReady] = useState(false);

  // Step 1: Wait for Zustand persist hydration to complete
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    if (useAuthStore.persist.hasHydrated()) {
      setHasHydrated(true);
    }

    return () => unsub();
  }, []);

  // Step 2: Once hydrated, decide immediately whether to show app or load from network
  useEffect(() => {
    if (!hasHydrated) return;

    const cachedSession = useAuthStore.getState().session;

    if (cachedSession) {
      // Cached session found — route instantly, refresh token silently in background
      SplashScreen.hideAsync();
      setReady(true);
      loadSession(); // silent background refresh
    } else {
      // No cached session — must check network
      loadSession();
    }
  }, [hasHydrated]);

  // Step 3: Once loadSession finishes (for the no-cache path), mark ready
  useEffect(() => {
    if (hasHydrated && !isLoading && !ready) {
      SplashScreen.hideAsync();
      setReady(true);
    }
  }, [hasHydrated, isLoading, ready]);

  if (!ready) {
    // Splash screen is still visible — render nothing
    return null;
  }

  // Single authoritative routing decision.
  // When LoginScreen/SignupScreen call signIn()/signUp(), the store's session
  // updates reactively here, triggering a re-render and this redirect automatically.
  if (session) {
    return <Redirect href="/(app)" />;
  }

  return <Redirect href="/auth/login" />;
}
