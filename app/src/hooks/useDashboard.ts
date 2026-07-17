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
    fetchDashboard();
    
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
