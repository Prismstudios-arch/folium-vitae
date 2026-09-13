/**
 * Push Notifications Service
 * Phase 2: Watering reminders, alerts, announcements
 * Supports: iOS (APNs) and Android (FCM)
 */

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiClient } from "./apiClient";

export interface NotificationData {
  type: "watering" | "milestone" | "alert" | "announcement";
  title: string;
  body: string;
  plantId?: string;
  actionUrl?: string;
}

export interface ScheduledReminder {
  id: string;
  plantId: string;
  plantName: string;
  frequency: "daily" | "weekly" | "custom";
  daysInterval?: number;
  nextReminderDate: string;
  enabled: boolean;
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Always show notifications even when app is in foreground
    return {
      // shouldShowAlert is deprecated in SDK 57; banner and list replace it.
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

export class PushNotificationService {
  private deviceToken: string | null = null;
  private reminders: Map<string, ScheduledReminder> = new Map();
  private REMINDERS_STORAGE_KEY = "sorrel_reminders";

  /**
   * Initialize push notifications
   * Requests user permission and gets device token
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();

      if (status !== "granted") {
        console.warn("Push notification permission denied");
        return false;
      }

      // Get device token
      const token = await this.getDeviceToken();

      if (token) {
        this.deviceToken = token;

        // The device token is held locally only. Registering it server-side
        // is for push we originate, and that endpoint is not built yet — so
        // there is deliberately no call here rather than a call to a stub.
        // Watering reminders do not need it: they are scheduled on-device
        // and fire offline.
        this.setupNotificationListeners();

        // Load saved reminders
        await this.loadReminders();

        return true;
      }

      return false;
    } catch (error) {
      console.error("Failed to initialize push notifications:", error);
      return false;
    }
  }

  /**
   * Get device token for APNs (iOS) or FCM (Android)
   */
  private async getDeviceToken(): Promise<string | null> {
    try {
      if (Platform.OS === "ios") {
        return await Notifications.getDevicePushTokenAsync()
          .then((token) => token.data)
          .catch(() => null);
      } else if (Platform.OS === "android") {
        // For Android, FCM token would be obtained here
        // Using Expo Notifications wrapper
        return await Notifications.getDevicePushTokenAsync()
          .then((token) => token.data)
          .catch(() => null);
      }

      return null;
    } catch (error) {
      console.error("Failed to get device token:", error);
      return null;
    }
  }

  /**
   * Set up notification listeners
   */
  private setupNotificationListeners() {
    // Handle notification received while app is in foreground
    this.foregroundSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        this.handleNotificationReceived(notification);
      }
    );

    // Handle notification tapped
    this.responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        this.handleNotificationTapped(response.notification);
      }
    );
  }

  private foregroundSubscription: any;
  private responseSubscription: any;

  /**
   * Handle notification received
   */
  private handleNotificationReceived(notification: Notifications.Notification) {
    const data = notification.request.content.data as any;

    console.log(`Notification received: ${notification.request.content.title}`);

    // Could trigger app state updates here
    // e.g., show in-app banner, update UI
  }

  /**
   * Handle notification tapped (open app)
   */
  private handleNotificationTapped(notification: Notifications.Notification) {
    const data = notification.request.content.data as any;

    console.log(`Notification tapped: ${data.actionUrl || data.plantId}`);

    // Navigate to relevant screen based on data
    if (data.actionUrl) {
      // Navigate(data.actionUrl)
    }

    if (data.plantId) {
      // Navigate to plant detail
    }
  }

  /**
   * Send local notification immediately
   */
  async sendNotification(notification: NotificationData): Promise<string> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          sound: "default",
          badge: 1,
          data: { ...notification },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1,
        },
      });

      return notificationId;
    } catch (error) {
      console.error("Failed to send notification:", error);
      throw error;
    }
  }

  /**
   * Schedule watering reminder for a plant
   */
  async scheduleWateringReminder(
    plantId: string,
    plantName: string,
    frequency: "daily" | "weekly" | "custom",
    daysInterval?: number
  ): Promise<ScheduledReminder> {
    try {
      const reminder: ScheduledReminder = {
        id: `reminder-${plantId}-${Date.now()}`,
        plantId,
        plantName,
        frequency,
        daysInterval: daysInterval || (frequency === "daily" ? 1 : 7),
        nextReminderDate: this.getNextReminderDate(frequency, daysInterval),
        enabled: true,
      };

      this.reminders.set(reminder.id, reminder);
      await this.saveReminders();

      // Schedule actual notification
      await this.scheduleNotification(reminder);

      return reminder;
    } catch (error) {
      console.error("Failed to schedule watering reminder:", error);
      throw error;
    }
  }

  /**
   * Schedule actual notification
   */
  private async scheduleNotification(reminder: ScheduledReminder) {
    try {
      const date = new Date(reminder.nextReminderDate);
      const now = new Date();

      if (date > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🌿 Time to Water",
            body: `Your ${reminder.plantName} is thirsty!`,
            sound: "default",
            badge: 1,
            data: {
              type: "watering",
              plantId: reminder.plantId,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date,
          },
        });
      }
    } catch (error) {
      console.error("Failed to schedule notification:", error);
    }
  }

  /**
   * Cancel a reminder
   */
  async cancelReminder(reminderId: string): Promise<void> {
    try {
      this.reminders.delete(reminderId);
      await this.saveReminders();

      // Cancel scheduled notifications
      // Expo Notifications doesn't have direct cancel by reminder ID,
      // but scheduled notifications can be cancelled by their notification IDs
    } catch (error) {
      console.error("Failed to cancel reminder:", error);
    }
  }

  /**
   * Get all reminders
   */
  getReminders(): ScheduledReminder[] {
    return Array.from(this.reminders.values());
  }

  /**
   * Save reminders to storage
   */
  private async saveReminders(): Promise<void> {
    try {
      const remindersArray = Array.from(this.reminders.values());
      await AsyncStorage.setItem(
        this.REMINDERS_STORAGE_KEY,
        JSON.stringify(remindersArray)
      );
    } catch (error) {
      console.error("Failed to save reminders:", error);
    }
  }

  /**
   * Load reminders from storage
   */
  private async loadReminders(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.REMINDERS_STORAGE_KEY);
      if (stored) {
        const remindersArray = JSON.parse(stored) as ScheduledReminder[];
        this.reminders.clear();
        remindersArray.forEach((reminder) => {
          this.reminders.set(reminder.id, reminder);
        });
      }
    } catch (error) {
      console.error("Failed to load reminders:", error);
    }
  }

  /**
   * Calculate next reminder date
   */
  private getNextReminderDate(frequency: string, daysInterval?: number): string {
    const now = new Date();

    // Set to morning (9 AM)
    now.setHours(9, 0, 0, 0);

    // Move to next occurrence
    if (frequency === "daily") {
      now.setDate(now.getDate() + 1);
    } else if (frequency === "weekly" || frequency === "custom") {
      now.setDate(now.getDate() + (daysInterval || 7));
    }

    return now.toISOString();
  }

  /**
   * Cleanup - remove listeners
   */
  cleanup() {
    if (this.foregroundSubscription) {
      this.foregroundSubscription.remove();
    }
    if (this.responseSubscription) {
      this.responseSubscription.remove();
    }
  }
}

// Singleton
let notificationService: PushNotificationService | null = null;

export function getPushNotificationService(): PushNotificationService {
  if (!notificationService) {
    notificationService = new PushNotificationService();
  }
  return notificationService;
}
