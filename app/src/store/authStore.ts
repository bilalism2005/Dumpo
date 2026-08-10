import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/supabase-js';

const TOKEN_KEY = 'supabase_jwt_token';

async function setToken(token: string) {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(TOKEN_KEY, token);
      }
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  } catch (e) {
    console.error('Failed to set token', e);
  }
}

async function removeToken() {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(TOKEN_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch (e) {
    console.error('Failed to remove token', e);
  }
}

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadSession: () => Promise<void>;
}

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(name);
      }
      return null;
    }
    return await SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(name, value);
      }
      return;
    }
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(name);
      }
      return;
    }
    await SecureStore.deleteItemAsync(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
  user: null,
  session: null,
  isLoading: false,
  error: null,
  
  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      
      if (data.session) {
        await setToken(data.session.access_token);
      }
      set({ user: data.user, session: data.session, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Login failed', isLoading: false });
      throw err;
    }
  },
  
  signUp: async (email, password, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            avatar_url: `https://avatar.vercel.sh/${email}`,
          },
        },
      });
      if (error) throw error;
      
      if (data.session) {
        await setToken(data.session.access_token);
      }
      set({ user: data.user, session: data.session, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Sign up failed', isLoading: false });
      throw err;
    }
  },
  
  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await removeToken();
      set({ user: null, session: null, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Sign out failed', isLoading: false });
    }
  },
  
  loadSession: async () => {
    const hasCachedSession = !!get().session;
    if (!hasCachedSession) {
      set({ isLoading: true });
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await setToken(session.access_token);
        set({ user: session.user, session, isLoading: false });
      } else {
        await removeToken();
        set({ user: null, session: null, isLoading: false });
      }
    } catch (err: any) {
      set({ user: null, session: null, isLoading: false });
    }
  },
  }),
  {
    name: 'auth-storage',
    storage: createJSONStorage(() => secureStorage),
    partialize: (state) => ({ user: state.user, session: state.session }),
  }
));

// Set up auth state change listener to sync SecureStore/localStorage token automatically
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session) {
    await setToken(session.access_token);
    useAuthStore.setState({ user: session.user, session });
  } else {
    await removeToken();
    useAuthStore.setState({ user: null, session: null });
  }
});
