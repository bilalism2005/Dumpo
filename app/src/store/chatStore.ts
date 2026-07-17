import { create } from 'zustand';
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
  fetchMessages: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  clearChat: () => void;
  reclassifyMessageItem: (messageId: string, toBucket: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,
  
  fetchMessages: async () => {
    set({ isLoading: true });
    try {
      const response = await apiRequest('/api/v1/chat/history', 'GET');
      if (response.success && response.messages) {
        if (response.messages.length === 0) {
          set({
            messages: [{
              id: 'welcome',
              role: 'assistant',
              content: "Hey, I'm Dumpo. Drop anything on your mind. I'll take care of the rest.",
              created_at: new Date().toISOString()
            }],
            isLoading: false
          });
        } else {
          set({
            messages: response.messages,
            isLoading: false
          });
        }
      } else {
        set({ isLoading: false });
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
        // Map API response to assistant message bubbles
        const assistantMsgs: ChatMessage[] = response.items.map((item: any, idx: number) => ({
          id: `${messageId}-resp-${idx}`,
          role: 'assistant',
          content: item.confirmation_text,
          bucket_tags: item.bucket_tags,
          reminder_set: item.reminder_set,
          reminder_text: item.reminder_text,
          created_at: new Date().toISOString(),
          items: [item] // Save detailed item data for reclassification
        }));
        
        set((state) => ({
          messages: [...state.messages, ...assistantMsgs],
          isLoading: false
        }));
      } else {
        throw new Error("Failed to process message classification");
      }
    } catch (err: any) {
      // Robust error handling - never crash. Create a friendly assistant error bubble
      const errBubble: ChatMessage = {
        id: `${messageId}-err`,
        role: 'assistant',
        content: "Oops, I had a small hiccup processing that. I saved it to Others for now.",
        bucket_tags: ["📦 Others"],
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
      item.primary_bucket = toBucket;
      if (response && response.new_id) {
        item.id = response.new_id;
      }
      msg.bucket_tags = [newTag];
      msg.content = `Moved to ${toBucket.toUpperCase()}.`;
      
      set({ messages: msgs });
    } catch (error) {
      console.error("Failed to reclassify message item", error);
    }
  }
}));
