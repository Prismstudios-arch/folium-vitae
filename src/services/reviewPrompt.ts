import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

const LAST_ASKED_KEY = "sorrel_review_last_asked";

/** A second saved plant: the app has done its job at least twice. */
const MIN_PLANTS = 2;
const MIN_DAYS_BETWEEN = 120;
const DAY_MS = 86_400_000;

/** The rule on its own, so it can be tested without the native module. */
export function shouldAskForReview(plantCount: number, lastAskedAt: number | null, now: number): boolean {
  if (plantCount < MIN_PLANTS) return false;
  if (lastAskedAt === null) return true;
  return now - lastAskedAt >= MIN_DAYS_BETWEEN * DAY_MS;
}

/**
 * Ask for an App Store rating at a moment the app has earned it: straight
 * after a plant is saved, once there are at least two, and never more than
 * once every four months. iOS decides whether the prompt actually appears
 * (at most three times a year), so this only ever asks — and a failure here
 * must never surface to anyone.
 */
export async function maybeAskForReview(plantCount: number): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(LAST_ASKED_KEY);
    const parsed = stored ? Number(stored) : Number.NaN;
    const now = Date.now();

    if (!shouldAskForReview(plantCount, Number.isFinite(parsed) ? parsed : null, now)) return;
    if (!(await StoreReview.isAvailableAsync())) return;

    await AsyncStorage.setItem(LAST_ASKED_KEY, String(now));
    await StoreReview.requestReview();
  } catch {
    // A rating prompt is never worth an error.
  }
}
