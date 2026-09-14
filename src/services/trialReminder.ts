/**
 * Reminder before a free trial converts to a charge.
 *
 * SPEC §9: "A local notification 2 days before the trial converts, saying
 * what will be charged and how to cancel. This will cost us some conversions
 * and win us the reviews that define the brand. Ship it."
 *
 * Local, not push: it has to fire whether or not the app has been opened
 * since, and whether or not our server is reachable.
 */

import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SCHEDULED_KEY = "sorrel_trial_reminder_id";

/** Two days, so there is a full day to act after seeing it. */
const DAYS_BEFORE = 2;

export interface TrialReminderInput {
  /** When the trial converts and the card is charged. */
  chargeDate: Date;
  /** The store's own localised price string. Never a number we formatted. */
  priceString: string;
  /** e.g. "month" */
  period: string;
}

/**
 * Schedule the reminder.
 *
 * Returns null when the trial is already inside the notice window — firing a
 * reminder about a charge that lands tomorrow is worse than not sending one,
 * because it reads as a warning the user had no time to act on.
 */
export async function scheduleTrialReminder(
  input: TrialReminderInput
): Promise<string | null> {
  await cancelTrialReminder();

  const fireAt = new Date(input.chargeDate);
  fireAt.setDate(fireAt.getDate() - DAYS_BEFORE);

  if (fireAt.getTime() <= Date.now()) {
    return null;
  }

  // Asked for here, straight after someone starts a trial, when the reason
  // is obvious. It used to be checked but never requested, so unless
  // something else had asked first, the promised reminder was silently never
  // scheduled.
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }

  if (!permission.granted) {
    // Not fatal. The same information is on the paywall and in Settings; the
    // notification is a courtesy on top, not the only disclosure.
    return null;
  }

  const chargeDay = input.chargeDate.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Your Sorrel trial ends in 2 days",
      // States the amount, the date, and how to stop it. No urgency framing,
      // no attempt to talk anyone out of cancelling.
      body: `On ${chargeDay} you'll be charged ${input.priceString} per ${input.period}. To cancel, open Sorrel › Settings › Manage subscription.`,
      data: { kind: "trialEnding" },
    },
    // SDK 57 requires the trigger to name its own type; a bare { date } is
    // no longer enough to disambiguate from the interval and calendar forms.
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });

  await AsyncStorage.setItem(SCHEDULED_KEY, id);
  return id;
}

/** Cancel on unsubscribe, or before rescheduling. */
export async function cancelTrialReminder(): Promise<void> {
  const existing = await AsyncStorage.getItem(SCHEDULED_KEY);
  if (!existing) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(existing);
  } catch {
    // Already fired or already gone; nothing to undo.
  }

  await AsyncStorage.removeItem(SCHEDULED_KEY);
}

export async function hasTrialReminder(): Promise<boolean> {
  return (await AsyncStorage.getItem(SCHEDULED_KEY)) !== null;
}
