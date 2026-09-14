/**
 * Basic watering reminders.
 *
 * Settings had a "Watering Reminders — get notified when your plants need
 * water" switch, the paywall listed reminders as a free feature, and the
 * privacy policy mentioned them. The switch saved a value nothing read, and
 * the only reminder code was an unused class whose cancel function cancelled
 * nothing. This is the feature those three places describe.
 *
 * SPEC §8: basic reminders are free, never nag, and adapt to the user. So a
 * reminder is scheduled only once someone has logged a plant twice, at their
 * own usual interval, and tells them to check the soil rather than to water.
 * Each is a single notification, rescheduled when they next log — ignore one
 * and no more follow.
 */

import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDisplayName } from "@domain/plant";
import { fetchPlant, fetchAllPlants } from "./database";
import { getUserPreferences } from "./userPreferences";
import { summariseWatering, lastWateredAt, nextReminderDate } from "./wateringInsights";

/** plantId → scheduled notification id. */
const STORAGE_KEY = "sorrel_watering_reminders";

async function readScheduled(): Promise<Record<string, string>> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function writeScheduled(ids: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export async function cancelWateringReminder(plantId: string): Promise<void> {
  const ids = await readScheduled();
  const existing = ids[plantId];
  if (!existing) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(existing);
  } catch {
    // Already fired or already gone.
  }

  delete ids[plantId];
  await writeScheduled(ids);
}

export async function cancelAllWateringReminders(): Promise<void> {
  const ids = await readScheduled();

  await Promise.all(
    Object.values(ids).map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)
    )
  );

  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * Bring one plant's reminder in line with its history.
 *
 * Returns when the reminder will fire, or null when there isn't one —
 * reminders off, notifications blocked, or not enough history yet.
 */
export async function refreshWateringReminder(plantId: string): Promise<Date | null> {
  await cancelWateringReminder(plantId);

  const prefs = await getUserPreferences();
  if (!prefs.notificationsEnabled) return null;

  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return null;

  const plant = await fetchPlant(plantId);
  if (!plant) return null;

  const rhythm = summariseWatering(plant.waterLogs);
  const last = lastWateredAt(plant.waterLogs);
  if (!rhythm || !last || rhythm.medianDays < 1) return null;

  const fireAt = nextReminderDate(last, rhythm.medianDays);
  const cadence =
    rhythm.medianDays === 1 ? "every day" : `about every ${rhythm.medianDays} days`;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Time to check ${getDisplayName(plant)}`,
      body: `You usually water it ${cadence}. Feel the soil first — if it's still damp, leave it.`,
      data: { kind: "watering", plantId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });

  const ids = await readScheduled();
  ids[plantId] = id;
  await writeScheduled(ids);

  return fireAt;
}

/** Reschedule every plant — after reminders are switched on, say. */
export async function refreshAllWateringReminders(): Promise<void> {
  const plants = await fetchAllPlants();

  // One at a time: each refresh reads and writes the same stored map.
  for (const plant of plants) {
    await refreshWateringReminder(plant.id);
  }
}

/** Current notification permission, without prompting. */
export async function getReminderPermission(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> {
  const current = await Notifications.getPermissionsAsync();
  return { granted: current.granted, canAskAgain: current.canAskAgain };
}

/**
 * Ask for notification permission when someone turns reminders on.
 *
 * canAskAgain false means iOS will not show the prompt again, and the only
 * way to allow notifications is the Settings app.
 */
export async function requestReminderPermission(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return { granted: true, canAskAgain: true };
  if (!current.canAskAgain) return { granted: false, canAskAgain: false };

  const asked = await Notifications.requestPermissionsAsync();
  return { granted: asked.granted, canAskAgain: asked.canAskAgain };
}
