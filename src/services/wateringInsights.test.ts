import { WaterFrequency, WaterLog } from "@domain/plant";
import {
  summariseWatering,
  lastWateredAt,
  describeRhythm,
  describeWaterFrequency,
  currentSeason,
  describeSeasonForWatering,
  nextReminderDate,
} from "./wateringInsights";

const log = (id: string, date: Date): WaterLog => ({ id, date });
const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe("summariseWatering", () => {
  it("says nothing about a rhythm it hasn't seen twice", () => {
    expect(summariseWatering([])).toBeNull();
    expect(summariseWatering([log("a", day(2026, 5, 1))])).toBeNull();
  });

  it("uses the median gap, so one long absence doesn't skew it", () => {
    const logs = [
      log("a", day(2026, 5, 1)),
      log("b", day(2026, 5, 8)),
      log("c", day(2026, 5, 15)),
      log("d", day(2026, 6, 20)), // five weeks away
    ];
    expect(summariseWatering(logs, day(2026, 6, 20))?.medianDays).toBe(7);
  });

  it("averages the middle two gaps when there's an even number", () => {
    const logs = [
      log("a", day(2026, 5, 1)),
      log("b", day(2026, 5, 5)),
      log("c", day(2026, 5, 11)),
    ];
    expect(summariseWatering(logs, day(2026, 5, 11))?.medianDays).toBe(5);
  });

  // Backdated entries arrive out of order. Unsorted, they produced negative
  // gaps.
  it("doesn't depend on the order logs arrive in", () => {
    const ordered = [log("a", day(2026, 5, 1)), log("b", day(2026, 5, 4)), log("c", day(2026, 5, 7))];
    const shuffled = [ordered[2], ordered[0], ordered[1]];
    expect(summariseWatering(shuffled, day(2026, 5, 7))).toEqual(
      summariseWatering(ordered, day(2026, 5, 7))
    );
  });

  it("counts days since the latest watering", () => {
    const logs = [log("a", day(2026, 5, 1)), log("b", day(2026, 5, 4))];
    expect(summariseWatering(logs, day(2026, 5, 7))?.daysSinceLast).toBe(3);
  });
});

describe("lastWateredAt", () => {
  it("finds the latest regardless of order", () => {
    const logs = [log("a", day(2026, 5, 9)), log("b", day(2026, 5, 1))];
    expect(lastWateredAt(logs)?.getDate()).toBe(9);
    expect(lastWateredAt([])).toBeNull();
  });
});

describe("describeRhythm", () => {
  it("reads naturally at the edges", () => {
    expect(describeRhythm({ intervals: 1, medianDays: 1, daysSinceLast: 0 })).toBe(
      "You've watered this about every day across 2 entries. Last watered today."
    );
    expect(describeRhythm({ intervals: 3, medianDays: 7, daysSinceLast: 1 })).toContain(
      "about every 7 days across 4 entries. Last watered yesterday."
    );
  });
});

describe("describeWaterFrequency", () => {
  it("has guidance for every frequency", () => {
    for (const value of Object.values(WaterFrequency)) {
      expect(describeWaterFrequency(value).length).toBeGreaterThan(10);
    }
  });
});

describe("currentSeason", () => {
  it("follows meteorological seasons in the north", () => {
    expect(currentSeason("north", day(2026, 3, 1))).toBe("spring");
    expect(currentSeason("north", day(2026, 7, 15))).toBe("summer");
    expect(currentSeason("north", day(2026, 11, 30))).toBe("autumn");
    expect(currentSeason("north", day(2026, 12, 1))).toBe("winter");
    expect(currentSeason("north", day(2026, 2, 28))).toBe("winter");
  });

  it("is opposite in the south", () => {
    expect(currentSeason("south", day(2026, 3, 1))).toBe("autumn");
    expect(currentSeason("south", day(2026, 12, 25))).toBe("summer");
  });

  it("has watering guidance for every season", () => {
    for (const season of ["spring", "summer", "autumn", "winter"] as const) {
      expect(describeSeasonForWatering(season)).toContain(season);
    }
  });
});

describe("nextReminderDate", () => {
  it("lands the usual interval after the last watering, in the morning", () => {
    const at = nextReminderDate(day(2026, 5, 1, 19), 7, day(2026, 5, 2));
    expect(at.getDate()).toBe(8);
    expect(at.getHours()).toBe(9);
  });

  // Firing the moment someone saves a log would read as a bug.
  it("waits for the next morning when the plant is already due", () => {
    const beforeNine = nextReminderDate(day(2026, 5, 1), 3, day(2026, 5, 10, 7));
    expect(beforeNine.getDate()).toBe(10);
    expect(beforeNine.getHours()).toBe(9);

    const afterNine = nextReminderDate(day(2026, 5, 1), 3, day(2026, 5, 10, 15));
    expect(afterNine.getDate()).toBe(11);
  });

  it("never returns a time in the past", () => {
    const now = day(2026, 5, 10, 15);
    for (const interval of [1, 3, 7, 30]) {
      expect(nextReminderDate(day(2026, 4, 1), interval, now).getTime()).toBeGreaterThan(now.getTime());
    }
  });
});
