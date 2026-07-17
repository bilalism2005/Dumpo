import { create } from 'zustand';
import { apiRequest } from '../services/api';
import { supabase } from '../services/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface DashboardState {
  todayTasks: any[];
  somedayTasks: any[];
  overdueTasks: any[];
  overdueCount: number;
  bucketItems: Record<string, any[]>;
  isLoading: boolean;
  error: string | null;
  realtimeChannel: RealtimeChannel | null;
  
  fetchDashboard: (currentDate?: string, silent?: boolean) => Promise<void>;
  fetchBucketItems: (bucketName: string) => Promise<void>;
  toggleTaskComplete: (taskId: string) => Promise<void>;
  toggleTaskReminder: (taskId: string) => Promise<void>;
  updateBucketItem: (bucket: string, itemId: string, payload: any) => Promise<void>;
  reclassifyBucketItem: (bucket: string, itemId: string, toBucket: string) => Promise<void>;
  deleteBucketItem: (bucket: string, itemId: string) => Promise<void>;
  subscribeRealtime: (userId: string) => void;
  unsubscribeRealtime: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  todayTasks: [],
  somedayTasks: [],
  overdueTasks: [],
  overdueCount: 0,
  bucketItems: {},
  isLoading: false,
  error: null,
  realtimeChannel: null,
  
  fetchDashboard: async (currentDate, silent = false) => {
    if (!silent) set({ isLoading: true });
    try {
      const dateParam = currentDate ? `?current_date=${currentDate}` : '';
      const response = await apiRequest(`/api/v1/dashboard${dateParam}`, 'GET');
      
      set({
        todayTasks: response.today_tasks || [],
        somedayTasks: response.someday_tasks || [],
        overdueTasks: response.overdue_tasks || [],
        overdueCount: response.overdue_count || 0,
        isLoading: false
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  
  fetchBucketItems: async (bucketName) => {
    set({ isLoading: true });
    try {
      const response = await apiRequest(`/api/v1/buckets/${bucketName}`, 'GET');
      set((state) => ({
        bucketItems: {
          ...state.bucketItems,
          [bucketName]: response.items || []
        },
        isLoading: false
      }));
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  
  toggleTaskComplete: async (taskId) => {
    // Optimistic UI updates
    const currentToday = [...get().todayTasks];
    const taskIndex = currentToday.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      const isComplete = !currentToday[taskIndex].is_complete;
      currentToday[taskIndex].is_complete = isComplete;
      currentToday[taskIndex].completed_at = isComplete ? new Date().toISOString() : null;
      set({ todayTasks: currentToday });
    }

    const currentSomeday = [...get().somedayTasks];
    const somedayIndex = currentSomeday.findIndex(t => t.id === taskId);
    if (somedayIndex !== -1) {
      const isComplete = !currentSomeday[somedayIndex].is_complete;
      currentSomeday[somedayIndex].is_complete = isComplete;
      currentSomeday[somedayIndex].completed_at = isComplete ? new Date().toISOString() : null;
      set({ somedayTasks: currentSomeday });
    }
    
    try {
      await apiRequest(`/api/v1/tasks/${taskId}/complete`, 'PATCH');
      await get().fetchDashboard(undefined, true);
    } catch (error) {
      console.error("Failed to complete task", error);
      // Revert if API failed
      await get().fetchDashboard(undefined, true);
    }
  },
  
  toggleTaskReminder: async (taskId) => {
    try {
      await apiRequest(`/api/v1/tasks/${taskId}/reminder`, 'PATCH');
      await get().fetchDashboard(undefined, true);
    } catch (error) {
      console.error("Failed to toggle reminder", error);
    }
  },
  
  updateBucketItem: async (bucket, itemId, payload) => {
    try {
      const res = await apiRequest(`/api/v1/items/${bucket}/${itemId}`, 'PATCH', payload);
      
      // If deleted (e.g. user cleared text)
      if (res.deleted) {
        set((state) => {
          const items = (state.bucketItems[bucket] || []).filter(item => item.id !== itemId);
          return {
            bucketItems: { ...state.bucketItems, [bucket]: items }
          };
        });
      } else if (res.item) {
        // Update local state list
        set((state) => {
          const items = [...(state.bucketItems[bucket] || [])];
          const index = items.findIndex(item => item.id === itemId);
          if (index !== -1) {
            items[index] = { ...items[index], ...res.item };
          }
          return {
            bucketItems: { ...state.bucketItems, [bucket]: items }
          };
        });
      }
      
      // Refresh dashboard if it was a task change
      if (bucket === "tasks") {
        await get().fetchDashboard(undefined, true);
      }
    } catch (error) {
      console.error("Failed to update bucket item", error);
    }
  },
  
  reclassifyBucketItem: async (bucket, itemId, toBucket) => {
    try {
      const res = await apiRequest(`/api/v1/items/${bucket}/${itemId}/reclassify`, 'PATCH', {
        to_bucket: toBucket
      });
      
      if (res.success) {
        // Remove from source bucket list locally
        set((state) => {
          const srcItems = (state.bucketItems[bucket] || []).filter(item => item.id !== itemId);
          return {
            bucketItems: {
              ...state.bucketItems,
              [bucket]: srcItems
            }
          };
        });
        
        // Refresh both source and target buckets
        await get().fetchBucketItems(bucket);
        await get().fetchBucketItems(toBucket);
        await get().fetchDashboard(undefined, true);
      }
    } catch (error) {
      console.error("Failed to reclassify item", error);
    }
  },
  
  deleteBucketItem: async (bucket, itemId) => {
    try {
      await apiRequest(`/api/v1/items/${bucket}/${itemId}`, 'DELETE');
      set((state) => {
        const items = (state.bucketItems[bucket] || []).filter(item => item.id !== itemId);
        return {
          bucketItems: { ...state.bucketItems, [bucket]: items }
        };
      });
      await get().fetchDashboard(undefined, true);
    } catch (error) {
      console.error("Failed to delete item", error);
    }
  },
  
  subscribeRealtime: (userId) => {
    if (get().realtimeChannel) return; // Already subscribed
    
    const tables = ["tasks", "ideas", "journals", "finance", "health", "watchlist", "others"];
    
    let channel = supabase.channel('dashboard-changes');
    
    // Bind change listener for every table
    tables.forEach((table) => {
      channel = channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: table, filter: `user_id=eq.${userId}` },
        (payload) => {
          // Trigger silent background refresh
          get().fetchDashboard(undefined, true);
          // Also refresh any cached bucket lists
          const cachedBuckets = Object.keys(get().bucketItems);
          if (cachedBuckets.includes(table)) {
            get().fetchBucketItems(table);
          }
        }
      );
    });
    
    const activeChannel = channel.subscribe();
    set({ realtimeChannel: activeChannel });
  },
  
  unsubscribeRealtime: () => {
    const channel = get().realtimeChannel;
    if (channel) {
      supabase.removeChannel(channel);
      set({ realtimeChannel: null });
    }
  }
}));
