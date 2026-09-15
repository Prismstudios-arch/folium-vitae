import { shouldAskForReview } from "./reviewPrompt";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 15);

describe("shouldAskForReview", () => {
  // Asking after the very first scan is asking before the app has proved anything.
  it("waits for a second saved plant", () => {
    expect(shouldAskForReview(0, null, NOW)).toBe(false);
    expect(shouldAskForReview(1, null, NOW)).toBe(false);
    expect(shouldAskForReview(2, null, NOW)).toBe(true);
  });

  it("doesn't ask again within four months", () => {
    expect(shouldAskForReview(5, NOW - 30 * DAY, NOW)).toBe(false);
    expect(shouldAskForReview(5, NOW - 119 * DAY, NOW)).toBe(false);
  });

  it("can ask again after four months", () => {
    expect(shouldAskForReview(5, NOW - 120 * DAY, NOW)).toBe(true);
  });
});
