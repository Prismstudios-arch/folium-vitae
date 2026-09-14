/**
 * Rules for where saved photos live, as pure functions.
 *
 * Kept apart from photoStorage so they can be tested without the native file
 * system.
 */

/** Folder under the app's documents directory. */
export const PHOTO_DIR = "photos";

/**
 * What goes in the database: a path relative to the documents directory.
 *
 * Never an absolute URI. On iOS the app container's path includes a UUID
 * that changes when the app is updated or restored, so a file:// URI saved
 * today points at nothing after the next update. The journal previously
 * stored the image picker's cache URI — which iOS also clears whenever it
 * wants the space — so photos would have vanished either way.
 */
export function toStoredPath(fileName: string): string {
  return `${PHOTO_DIR}/${fileName}`;
}

/** The file name part of a stored path. */
export function fileNameOf(stored: string): string {
  return stored.slice(PHOTO_DIR.length + 1);
}

/**
 * True for paths this app wrote into its own photo folder.
 *
 * Anything else is a legacy absolute URI from before photos were copied.
 * Those are displayed while they still resolve and never deleted — the file
 * isn't ours to remove. The ".." check stops a malformed row from pointing a
 * delete at the database file next door.
 */
export function isOwnedPhotoPath(stored: string): boolean {
  return (
    stored.startsWith(`${PHOTO_DIR}/`) &&
    stored.length > PHOTO_DIR.length + 1 &&
    !stored.includes("..") &&
    !fileNameOf(stored).includes("/")
  );
}

/** Extension to keep when copying, so a PNG isn't saved with a .jpg name. */
export function extensionFor(uri: string): string {
  const match = /\/[^/]*\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(uri);
  return match ? `.${match[1].toLowerCase()}` : ".jpg";
}

/**
 * When a library photo was actually taken, read from its EXIF.
 *
 * A journal is a timeline. Stamping a photo from last spring with today's
 * date puts it in the wrong place and makes months of growth look like it
 * happened overnight.
 *
 * Only the date is read. EXIF can also carry GPS coordinates, and nothing
 * else from it is kept.
 *
 * iOS nests the tags under "{Exif}"; other sources flatten them. EXIF dates
 * carry no timezone and mean local time, so they are built as local dates.
 * Returns null for anything missing, malformed, implausibly old, or in the
 * future.
 */
export function parseExifDate(
  exif: Record<string, unknown> | null | undefined,
  now: Date = new Date()
): Date | null {
  if (!exif) return null;

  const nested = exif["{Exif}"] as Record<string, unknown> | undefined;
  const raw =
    nested?.DateTimeOriginal ?? exif.DateTimeOriginal ?? nested?.DateTimeDigitized ?? exif.DateTime;

  if (typeof raw !== "string") return null;

  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!match) return null;

  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second);

  // Date rolls "2025:13:01" over into January 2026 rather than failing, so
  // check the parts survived intact.
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  // A minute of grace for a camera clock that runs slightly ahead.
  if (year < 1990 || date.getTime() > now.getTime() + 60_000) return null;

  return date;
}
