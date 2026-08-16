import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '../services/api';
import * as Crypto from 'expo-crypto';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string; // confirmation_text for assistant, raw text for user
  bucket_tags?: string[];
  reminder_set?: boolean;
  reminder_text?: string | null;
  created_at: string;
  items?: any[];
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  offset: number;
  fetchMessages: (silent?: boolean, loadMore?: boolean) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  clearChat: () => void;
  reclassifyMessageItem: (messageId: string, toBucket: string) => Promise<void>;
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

import { scheduleTaskReminder } from '../services/notificationService';

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      isLoading: false,
      error: null,
      hasMore: true,
      offset: 0,
      
      fetchMessages: async (silent = false, loadMore = false) => {
        if (!silent) set({ isLoading: true });
        
        const currentOffset = loadMore ? get().offset : 0;
        const limit = 50;
        
    try {
      const response = await apiRequest(`/api/v1/chat/history?limit=${limit}&offset=${currentOffset}`, 'GET');
      if (response.success && response.messages) {
        if (response.messages.length === 0 && currentOffset === 0) {
          set({
            messages: [{
              id: 'welcome',
              role: 'assistant',
              content: "Hey, I'm Dumpo. Drop anything on your mind. I'll take care of the rest.",
              created_at: new Date().toISOString()
            }],
            isLoading: false,
            hasMore: false,
            offset: 0
          });
        } else {
          set((state) => ({
            messages: loadMore ? [...response.messages, ...state.messages] : response.messages,
            isLoading: false,
            hasMore: response.has_more !== false && response.messages.length === limit,
            offset: currentOffset + response.messages.length
          }));
        }
      } else {
        set({ isLoading: false, hasMore: false });
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  
  sendMessage: async (text) => {
    if (!text.trim()) return;
    
    // Generate a secure UUID locally
    const messageId = Crypto.randomUUID();
    const userMsg: ChatMessage = {
      id: messageId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };
    
    set((state) => ({
      messages: [...state.messages, userMsg],
      isLoading: true,
      error: null
    }));
    
    try {
      const timezoneOffset = new Date().getTimezoneOffset();
      const offsetSign = timezoneOffset > 0 ? '-' : '+';
      const offsetHours = String(Math.abs(Math.floor(timezoneOffset / 60))).padStart(2, '0');
      const offsetMinutes = String(Math.abs(timezoneOffset % 60)).padStart(2, '0');
      const tzOffset = `${offsetSign}${offsetHours}:${offsetMinutes}`;
      
      const localTimeContext = new Date(Date.now() - timezoneOffset * 60000)
        .toISOString()
        .slice(0, -1) + tzOffset;

      const response = await apiRequest('/api/v1/process', 'POST', {
        message_id: messageId,
        text: text,
        current_time_context: localTimeContext
      });
      
      if (response.success && response.items) {
        // Trigger OS notification scheduling for any task reminders
        response.items.forEach((item: any) => {
          if (item.reminder_set || (item.primary_bucket === 'tasks' && item.extracted?.reminder_required)) {
            scheduleTaskReminder({
              id: item.id || messageId,
              title: item.extracted?.title || item.confirmation_text || 'Task Reminder',
              due_date: item.extracted?.due_date,
              due_time: item.extracted?.due_time,
            });
          }
        });

        // Map API response to assistant message bubbles
        const assistantMsgs: ChatMessage[] = response.items.map((item: any, idx: number) => ({
          id: `${messageId}-resp-${idx}`,
          role: 'assistant',
          content: item.confirmation_text,
          bucket_tags: item.bucket_tags,
          reminder_set: item.reminder_set,
          reminder_text: item.reminder_text,
          created_at: new Date().toISOString(),
          items: [item]
        }));
        
        set((state) => ({
          messages: [...state.messages, ...assistantMsgs],
          isLoading: false
        }));
      } else {
        throw new Error("Failed to process message classification");
      }
    } catch (err: any) {
      console.error('Chat processing error:', err);
      const isAuthError = err.message?.includes('Unauthorized') || err.message?.includes('401');
      if (isAuthError) {
        // Attempt silent session reload / re-auth
        useAuthStore.getState().loadSession();
      }

      const errContent = isAuthError 
        ? "Session expired. Please log in again to continue." 
        : "Unable to process dump right now. Please check your network connection.";

      const errBubble: ChatMessage = {
        id: `${messageId}-err`,
        role: 'assistant',
        content: errContent,
        bucket_tags: ["⚠️ Connection"],
        created_at: new Date().toISOString()
      };
      
      set((state) => ({
        messages: [...state.messages, errBubble],
        isLoading: false
      }));
    }
  },
  
  clearChat: () => {
    set({ messages: [] });
  },

  reclassifyMessageItem: async (messageId, toBucket) => {
    const msgs = get().messages.map(m => {
      if (m.id === messageId) {
        return { 
          ...m, 
          items: m.items ? m.items.map(i => ({ ...i })) : undefined 
        };
      }
      return m;
    });
    
    const msg = msgs.find(m => m.id === messageId);
    if (!msg || !msg.items) return;
    const item = msg.items[0];
    if (!item) return;

    try {
      // Call backend to reclassify
      const response = await apiRequest(`/api/v1/items/${item.primary_bucket}/${item.id}/reclassify`, 'PATCH', {
        to_bucket: toBucket
      });
      
      // Update local state tags and text
      const bucketIcons: Record<string, string> = {
        tasks: "✅ Tasks",
        ideas: "💡 Ideas",
        journals: "📓 Journal",
        finance: "💰 Finance",
        health: "❤️ Health",
        watchlist: "🎬 Watchlist",
        others: "📦 Others"
      };
      
      const newTag = bucketIcons[toBucket] || `📦 ${toBucket.toUpperCase()}`;
      // We must map it completely so React triggers state update
      msg.items = [{ ...item, primary_bucket: toBucket, id: response?.new_id || item.id }];
      msg.bucket_tags = [newTag];
      msg.content = `Moved to ${toBucket.toUpperCase()}.`;
      
      set({ messages: msgs });
    } catch (error) {
      console.error("Failed to reclassify message item", error);
      import('react-native').then(({ Alert }) => {
        Alert.alert("Failed to change bucket", String(error));
      });
    }
  }
}),
{
  name: 'chat-storage',
  storage: createJSONStorage(() => secureStorage),
  partialize: (state) => ({ messages: state.messages }),
}
)
);
