/**
 * Dates in messages the app shows verbatim.
 *
 * The server does not know the caller's locale or timezone, so a reset date
 * is written the one way that cannot be misread as the American order:
 * "Monday 23 September", in UTC, which is the clock the window runs on.
 */
export function describeDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
