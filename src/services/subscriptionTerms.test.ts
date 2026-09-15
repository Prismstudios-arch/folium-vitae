/**
 * The paywall's arithmetic, tested against the real functions.
 *
 * This replaces purchases.test.ts, which re-declared the trial parser and
 * a copy of the webhook's event sets inside the test file and tested those
 * copies. Nothing it asserted could fail because of a change to the code
 * that actually ships.
 */

import {
  describePeriod,
  describePlanName,
  normaliseTrialUnit,
  describeTrialDuration,
  addTrialLength,
} from "./subscriptionTerms";

describe("describePlanName", () => {
  // The store's own display name was typed by hand and showed "annual" in
  // lower case on the paywall. The name now comes from the billing period.
  it("names single-unit plans", () => {
    expect(describePlanName("P1Y")).toBe("Yearly");
    expect(describePlanName("P1M")).toBe("Monthly");
    expect(describePlanName("P1W")).toBe("Weekly");
  });

  it("describes multi-unit plans", () => {
    expect(describePlanName("P3M")).toBe("Every 3 months");
    expect(describePlanName("P6M")).toBe("Every 6 months");
  });

  it("returns null so the caller can fall back to the store's name", () => {
    expect(describePlanName(undefined)).toBeNull();
    expect(describePlanName("monthly")).toBeNull();
  });
});

const START = new Date(2026, 2, 1, 12, 0, 0); // 1 March 2026
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

describe("describePeriod", () => {
  it("names single periods plainly", () => {
    expect(describePeriod("P1M")).toBe("month");
    expect(describePeriod("P1Y")).toBe("year");
    expect(describePeriod("P1W")).toBe("week");
  });

  it("pluralises longer periods", () => {
    expect(describePeriod("P3M")).toBe("3 months");
    expect(describePeriod("P2W")).toBe("2 weeks");
  });

  // Better to drop "per …" than print "per 2w" or "per undefined".
  it("returns nothing for what it doesn't recognise", () => {
    expect(describePeriod(undefined)).toBe("");
    expect(describePeriod(null)).toBe("");
    expect(describePeriod("P1M2D")).toBe("");
    expect(describePeriod("monthly")).toBe("");
  });
});

describe("normaliseTrialUnit", () => {
  it("maps RevenueCat's units", () => {
    expect(normaliseTrialUnit("DAY")).toBe("day");
    expect(normaliseTrialUnit("WEEK")).toBe("week");
    expect(normaliseTrialUnit("MONTH")).toBe("month");
    expect(normaliseTrialUnit("YEAR")).toBe("year");
  });

  it("refuses anything else rather than assuming", () => {
    expect(normaliseTrialUnit("FORTNIGHT")).toBeNull();
    expect(normaliseTrialUnit(undefined)).toBeNull();
  });
});

describe("describeTrialDuration", () => {
  it("reads naturally", () => {
    expect(describeTrialDuration("day", 1)).toBe("1 day");
    expect(describeTrialDuration("day", 3)).toBe("3 days");
    expect(describeTrialDuration("week", 1)).toBe("1 week");
  });
});

describe("addTrialLength", () => {
  it("handles days and weeks", () => {
    expect(daysBetween(START, addTrialLength(START, "day", 3))).toBe(3);
    expect(daysBetween(START, addTrialLength(START, "week", 1))).toBe(7);
    expect(daysBetween(START, addTrialLength(START, "week", 2))).toBe(14);
  });

  it("handles months and years by the calendar", () => {
    expect(addTrialLength(START, "month", 1).getMonth()).toBe(3); // March -> April
    expect(addTrialLength(START, "year", 1).getFullYear()).toBe(2027);
  });

  it("never lands in the past", () => {
    for (const unit of ["day", "week", "month", "year"] as const) {
      expect(addTrialLength(START, unit, 1).getTime()).toBeGreaterThan(START.getTime());
    }
  });
});
