import { useEffect } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { useAuthStore } from '../store/authStore';

export function useDashboard() {
  const { user } = useAuthStore();
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

  useEffect(() => {
    // If we have cached tasks from persist middleware, fetch silently to prevent spinner
    const hasCachedData = todayTasks.length > 0 || somedayTasks.length > 0;
    fetchDashboard(undefined, hasCachedData);
    
    if (user?.id) {
      subscribeRealtime(user.id);
    }
    
    return () => {
      unsubscribeRealtime();
    };
  }, [user?.id]);

  return {
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
    deleteBucketItem
  };
}
