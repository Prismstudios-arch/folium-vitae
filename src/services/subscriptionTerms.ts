/**
 * Subscription periods and trial lengths, as pure functions.
 *
 * Kept out of purchases.ts, which loads the native RevenueCat module, so the
 * arithmetic can be tested directly. The previous test file re-declared this
 * logic and tested the copy — it would have passed with the real function
 * broken.
 */

export type TrialUnit = "day" | "week" | "month" | "year";

const UNIT_FROM_ISO: Record<string, TrialUnit> = { D: "day", W: "week", M: "month", Y: "year" };

/**
 * An ISO 8601 period such as "P1M" or "P3M", in words: "month", "3 months".
 *
 * Returns "" for anything unrecognised, so the paywall can drop the "per …"
 * phrase rather than print "per 2w".
 */
export function describePeriod(iso?: string | null): string {
  const match = iso ? /^P(\d+)([DWMY])$/.exec(iso) : null;
  if (!match) return "";

  const count = Number(match[1]);
  const unit = UNIT_FROM_ISO[match[2]];
  return count === 1 ? unit : `${count} ${unit}s`;
}

/** RevenueCat reports trial units as "DAY", "WEEK" and so on. */
export function normaliseTrialUnit(unit?: string | null): TrialUnit | null {
  switch (unit?.toUpperCase()) {
    case "DAY":
      return "day";
    case "WEEK":
      return "week";
    case "MONTH":
      return "month";
    case "YEAR":
      return "year";
    default:
      return null;
  }
}

export function describeTrialDuration(unit: TrialUnit, count: number): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/**
 * When the first charge lands.
 *
 * Takes the unit and count as the store reports them. The old version
 * parsed its own display string back out with a regex and fell back to a
 * hardcoded 7 days when that failed — the very assumption it existed to
 * avoid.
 */
export function addTrialLength(from: Date, unit: TrialUnit, count: number): Date {
  const result = new Date(from);

  switch (unit) {
    case "day":
      result.setDate(result.getDate() + count);
      break;
    case "week":
      result.setDate(result.getDate() + count * 7);
      break;
    case "month":
      result.setMonth(result.getMonth() + count);
      break;
    case "year":
      result.setFullYear(result.getFullYear() + count);
      break;
  }

  return result;
}
