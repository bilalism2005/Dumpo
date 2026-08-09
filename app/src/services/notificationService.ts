import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Map of taskId -> notificationIdentifier to handle cancellations
const scheduledNotificationsMap: Record<string, string> = {};

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Task Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#a855f7',
      });
    }

    return true;
  } catch (error) {
    console.error('Failed to request notification permissions:', error);
    return false;
  }
}

export interface TaskReminderInput {
  id: string;
  title: string;
  due_date?: string | null; // YYYY-MM-DD
  due_time?: string | null; // HH:MM
}

export async function scheduleTaskReminder(task: TaskReminderInput): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;

  try {
    const now = new Date();
    let triggerDate: Date;

    if (task.due_date) {
      const [year, month, day] = task.due_date.split('-').map(Number);
      let hours = 12; // Rule 1: Default to 12:00 PM (noon) if no time specified
      let minutes = 0;

      if (task.due_time) {
        const [h, m] = task.due_time.split(':').map(Number);
        hours = h;
        minutes = m;
      }

      triggerDate = new Date(year, month - 1, day, hours, minutes, 0);

      // Rule 2: If trigger time is today/past and current time is past due_time (or past 12pm),
      // set reminder for +2 hours from current dump timestamp.
      if (triggerDate.getTime() <= now.getTime()) {
        triggerDate = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      }
    } else {
      // Fallback if no date specified: +2 hours from now
      triggerDate = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    }

    // Cancel existing reminder for this task if present
    if (scheduledNotificationsMap[task.id]) {
      await Notifications.cancelScheduledNotificationAsync(scheduledNotificationsMap[task.id]);
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Dumpo Reminder',
        body: task.title,
        sound: 'default',
        data: { taskId: task.id },
      },
      trigger: triggerDate,
    });

    scheduledNotificationsMap[task.id] = notificationId;
    console.log(`Scheduled OS notification for task "${task.title}" at ${triggerDate.toLocaleString()} (ID: ${notificationId})`);
    return notificationId;
  } catch (error) {
    console.error(`Failed to schedule task reminder for task ${task.id}:`, error);
    return null;
  }
}

export async function cancelTaskReminder(taskId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const notificationId = scheduledNotificationsMap[taskId];
  if (notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      delete scheduledNotificationsMap[taskId];
      console.log(`Cancelled OS notification for task ID: ${taskId}`);
    } catch (error) {
      console.error(`Failed to cancel notification for task ${taskId}:`, error);
    }
  }
}
