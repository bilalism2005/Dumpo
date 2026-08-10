import { useEffect, useState } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { useAuthStore } from '../store/authStore';

export function useDashboard() {
  const { user } = useAuthStore();
  const [dashHydrated, setDashHydrated] = useState(
    useDashboardStore.persist.hasHydrated()
  );

  const {
    todayTasks,
    somedayTasks,
    overdueTasks,
    overdueCount,
    bucketItems,
    isLoading,
    error,
    fetchDashboard,
    fetchBucketItems,
    toggleTaskComplete,
    toggleTaskReminder,
    updateBucketItem,
    reclassifyBucketItem,
    deleteBucketItem,
    subscribeRealtime,
    unsubscribeRealtime
  } = useDashboardStore();

  // Wait for dashboard store hydration
  useEffect(() => {
    if (dashHydrated) return;
    const unsub = useDashboardStore.persist.onFinishHydration(() => {
      setDashHydrated(true);
    });
    return () => unsub();
  }, [dashHydrated]);

  // Only fetch after hydration is complete
  useEffect(() => {
    if (!dashHydrated) return;

    // After hydration, check if we have cached data
    const state = useDashboardStore.getState();
    const hasCachedData =
      state.todayTasks.length > 0 ||
      state.somedayTasks.length > 0 ||
      Object.keys(state.bucketItems).length > 0;

    // Always fetch silently if we have cached data; show spinner only on truly empty first load
    fetchDashboard(undefined, hasCachedData);

    if (user?.id) {
      subscribeRealtime(user.id);
    }

    return () => {
      unsubscribeRealtime();
    };
  }, [user?.id, dashHydrated]);

  return {
    todayTasks,
    somedayTasks,
    overdueTasks,
    overdueCount,
    bucketItems,
    isLoading: !dashHydrated || isLoading, // treat pre-hydration as loading
    error,
    fetchDashboard,
    fetchBucketItems,
    toggleTaskComplete,
    toggleTaskReminder,
    updateBucketItem,
    reclassifyBucketItem,
    deleteBucketItem
  };
}
