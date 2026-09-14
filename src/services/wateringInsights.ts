import { WaterLog, WaterFrequency } from "@domain/plant";

const MS_PER_DAY = 86_400_000;

export interface WateringRhythm {
  /** How many gaps we measured — always one fewer than the number of logs. */
  intervals: number;
  /** Median whole days between waterings. Zero means more than once a day. */
  medianDays: number;
  /** Whole days since the most recent watering. */
  daysSinceLast: number;
}

/** The most recent watering, whatever order the logs arrive in. */
export function lastWateredAt(logs: WaterLog[]): Date | null {
  let latest: number | null = null;

  for (const log of logs) {
    const time = new Date(log.date).getTime();
    if (Number.isFinite(time) && (latest === null || time > latest)) latest = time;
  }

  return latest === null ? null : new Date(latest);
}

/**
 * What this user's own logs say about how often they water this plant.
 *
 * The watering screen carried a fixed sentence — "Based on your logs, water
 * this plant every 3-5 days during growing season" — that read no logs and
 * changed for no plant. It was wrong in both directions: presented as
 * analysis of the user's data, and dangerous as advice, since a cactus
 * watered every three days rots.
 *
 * Median, not mean: one backdated entry or a fortnight away drags an average
 * badly, and the question is what's normal for this plant rather than where
 * the arithmetic centre lands.
 *
 * Null below two entries. One watering establishes no interval, and there is
 * nothing honest to say about a rhythm you haven't seen twice.
 */
export function summariseWatering(
  logs: WaterLog[],
  now: Date = new Date()
): WateringRhythm | null {
  // Sort defensively rather than trusting caller order — logs can be
  // backdated, and a mis-ordered list would produce negative gaps.
  const times = logs
    .map((log) => new Date(log.date).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a);

  if (times.length < 2) return null;

  const gaps: number[] = [];
  for (let i = 0; i < times.length - 1; i++) {
    gaps.push((times[i] - times[i + 1]) / MS_PER_DAY);
  }

  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 === 0 ? (gaps[mid - 1] + gaps[mid]) / 2 : gaps[mid];

  return {
    intervals: gaps.length,
    medianDays: Math.round(median),
    daysSinceLast: Math.max(0, Math.floor((now.getTime() - times[0]) / MS_PER_DAY)),
  };
}

/**
 * Plain-English watering guidance for a species.
 *
 * Deliberately phrased as a condition to check rather than a number of days:
 * how fast a pot dries depends on light, warmth, pot size and season, so a
 * day count would be a confident answer to a question we can't see.
 */
export function describeWaterFrequency(frequency: WaterFrequency): string {
  switch (frequency) {
    case WaterFrequency.Rarely:
      return "wants water rarely — let the soil dry out completely, and err towards forgetting it";
    case WaterFrequency.Low:
      return "prefers infrequent watering — let the top half of the soil dry out first";
    case WaterFrequency.Moderate:
      return "likes moderate watering — water when the top few centimetres feel dry";
    case WaterFrequency.Frequent:
      return "likes frequent watering — water once the surface has dried";
    case WaterFrequency.VeryFrequent:
      return "drinks a lot — check it every day or two";
    case WaterFrequency.KeepMoist:
      return "likes soil kept evenly moist, never soggy";
    case WaterFrequency.KeepWet:
      return "likes soil kept genuinely wet";
  }
}

/** How the user's own rhythm reads back to them. */
export function describeRhythm(rhythm: WateringRhythm): string {
  const cadence =
    rhythm.medianDays === 0
      ? "more than once a day"
      : rhythm.medianDays === 1
        ? "about every day"
        : `about every ${rhythm.medianDays} days`;

  const since =
    rhythm.daysSinceLast === 0
      ? "today"
      : rhythm.daysSinceLast === 1
        ? "yesterday"
        : `${rhythm.daysSinceLast} days ago`;

  return `You've watered this ${cadence} across ${rhythm.intervals + 1} entries. Last watered ${since}.`;
}

export type Hemisphere = "north" | "south";
export type Season = "spring" | "summer" | "autumn" | "winter";

/**
 * Meteorological season for the user's hemisphere.
 *
 * This is what the hemisphere setting is for. It was saved, and described as
 * "helps us show seasonal care advice", but nothing read it.
 */
export function currentSeason(hemisphere: Hemisphere, date: Date = new Date()): Season {
  const month = date.getMonth();

  const northern: Season =
    month >= 2 && month <= 4
      ? "spring"
      : month >= 5 && month <= 7
        ? "summer"
        : month >= 8 && month <= 10
          ? "autumn"
          : "winter";

  if (hemisphere === "north") return northern;

  const flipped: Record<Season, Season> = {
    spring: "autumn",
    summer: "winter",
    autumn: "spring",
    winter: "summer",
  };
  return flipped[northern];
}

/**
 * What the season means for watering. Hedged to "most houseplants" because
 * a few — some succulents among them — grow on their own calendar.
 */
export function describeSeasonForWatering(season: Season): string {
  switch (season) {
    case "spring":
      return "It's spring where you are. Most houseplants are picking up, so the gaps between waterings usually shorten.";
    case "summer":
      return "It's summer where you are. Warmth and long days dry pots out faster than at any other time of year.";
    case "autumn":
      return "It's autumn where you are. Growth is slowing, so most houseplants need watering less often.";
    case "winter":
      return "It's winter where you are. Most houseplants barely grow now, and overwatering is the usual way they're lost.";
  }
}

/**
 * When to remind someone to check a plant.
 *
 * Their usual interval after the last watering, at a civil hour. If that
 * moment has already passed, the next morning instead — a notification that
 * fires the instant you close the log reads as a bug, not a reminder.
 */
export function nextReminderDate(
  lastWatered: Date,
  intervalDays: number,
  now: Date = new Date(),
  hour: number = 9
): Date {
  const due = new Date(lastWatered);
  due.setDate(due.getDate() + intervalDays);
  due.setHours(hour, 0, 0, 0);

  if (due.getTime() > now.getTime()) return due;

  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}
