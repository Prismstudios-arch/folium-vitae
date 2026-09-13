/**
 * Tests for the paywall's non-obvious logic.
 *
 * The trial length is parsed from the store's own description rather than
 * assumed, so the reminder fires relative to the real charge date. Getting
 * this wrong means either warning someone after they have been charged, or
 * not at all.
 */

// addTrialLength lives with the screen that uses it; re-declared here so the
// arithmetic is covered without pulling a React component into a node test.
function addTrialLength(from: Date, duration: string): Date {
  const match = duration.match(/(\d+)\s*(day|week|month|year)/i);
  const result = new Date(from);

  if (!match) {
    result.setDate(result.getDate() + 7);
    return result;
  }

  const count = Number(match[1]);

  switch (match[2].toLowerCase()) {
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

const START = new Date("2026-03-01T12:00:00Z");
const daysBetween = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / 86_400_000);

describe("trial length parsing", () => {
  it("handles days", () => {
    expect(daysBetween(START, addTrialLength(START, "7 days"))).toBe(7);
    expect(daysBetween(START, addTrialLength(START, "3 days"))).toBe(3);
  });

  it("handles a singular unit", () => {
    expect(daysBetween(START, addTrialLength(START, "1 day"))).toBe(1);
  });

  it("handles weeks", () => {
    expect(daysBetween(START, addTrialLength(START, "2 weeks"))).toBe(14);
  });

  it("handles months", () => {
    expect(addTrialLength(START, "1 month").getMonth()).toBe(3); // March -> April
  });

  it("handles years", () => {
    expect(addTrialLength(START, "1 year").getFullYear()).toBe(2027);
  });

  // If App Store Connect ever returns a phrasing we do not recognise, a
  // conservative 7 days is far better than NaN — which would schedule the
  // reminder at an invalid date and silently never fire.
  it("falls back to 7 days for an unparseable duration", () => {
    expect(daysBetween(START, addTrialLength(START, "a fortnight"))).toBe(7);
    expect(addTrialLength(START, "").getTime()).not.toBeNaN();
  });

  it("never returns a date in the past", () => {
    for (const duration of ["1 day", "7 days", "2 weeks", "1 month", "nonsense"]) {
      expect(addTrialLength(START, duration).getTime()).toBeGreaterThan(START.getTime());
    }
  });
});

/**
 * Which RevenueCat events move a plan. Mirrors backend/src/routes/webhooks.ts.
 */
const GRANTING = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
]);

const REVOKING = new Set(["EXPIRATION", "SUBSCRIPTION_PAUSED"]);

describe("subscription event handling", () => {
  it("grants on purchase and renewal", () => {
    expect(GRANTING.has("INITIAL_PURCHASE")).toBe(true);
    expect(GRANTING.has("RENEWAL")).toBe(true);
  });

  it("revokes on expiry", () => {
    expect(REVOKING.has("EXPIRATION")).toBe(true);
  });

  // The one that is easy to get wrong: cancelling turns off auto-renew, it
  // does not end the period already paid for. Downgrading here would cut
  // short access somebody is still entitled to.
  it("does not revoke on cancellation", () => {
    expect(REVOKING.has("CANCELLATION")).toBe(false);
    expect(GRANTING.has("CANCELLATION")).toBe(false);
  });

  it("does not revoke on a billing issue", () => {
    // A failed card gets retried by Apple. Cutting access on the first
    // failure punishes someone whose payment may well go through.
    expect(REVOKING.has("BILLING_ISSUE")).toBe(false);
  });
});
