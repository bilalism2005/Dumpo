import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

// Memory Storage for Node.js SSR compilation
class MemoryStorage {
  private store: Record<string, string> = {};
  async getItem(key: string) {
    return this.store[key] || null;
  }
  async setItem(key: string, value: string) {
    this.store[key] = value;
  }
  async removeItem(key: string) {
    delete this.store[key];
  }
}

// Browser localStorage adapter
const LocalStorageAdapter = {
  getItem: async (key: string) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  setItem: async (key: string, value: string) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  }
};

// SecureStore adapter for native platforms
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// select storage engine
let customStorage;
if (Platform.OS === 'web') {
  if (typeof window === 'undefined') {
    customStorage = new MemoryStorage();
  } else {
    customStorage = LocalStorageAdapter;
  }
} else {
  customStorage = SecureStoreAdapter;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: customStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
