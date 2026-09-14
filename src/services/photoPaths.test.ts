import {
  toStoredPath,
  fileNameOf,
  isOwnedPhotoPath,
  extensionFor,
  parseExifDate,
} from "./photoPaths";

describe("stored photo paths", () => {
  it("stores a relative path, never an absolute URI", () => {
    const stored = toStoredPath("abc.jpg");
    expect(stored).toBe("photos/abc.jpg");
    expect(stored).not.toMatch(/^file:|^\//);
    expect(fileNameOf(stored)).toBe("abc.jpg");
  });

  it("only claims files in its own folder", () => {
    expect(isOwnedPhotoPath("photos/abc.jpg")).toBe(true);
    // A row saved before photos were copied: displayed, never deleted.
    expect(
      isOwnedPhotoPath("file:///var/mobile/Containers/Data/Application/X/Library/Caches/ImagePicker/a.jpg")
    ).toBe(false);
  });

  it("refuses paths that could escape the folder", () => {
    expect(isOwnedPhotoPath("photos/../SQLite/sorrel.db")).toBe(false);
    expect(isOwnedPhotoPath("photos/nested/a.jpg")).toBe(false);
    expect(isOwnedPhotoPath("photos/")).toBe(false);
  });

  it("keeps the source extension", () => {
    expect(extensionFor("file:///cache/IMG_1.PNG")).toBe(".png");
    expect(extensionFor("file:///cache/a.jpeg?size=large")).toBe(".jpeg");
    expect(extensionFor("file:///cache.dir/no-extension")).toBe(".jpg");
  });
});

describe("parseExifDate", () => {
  const now = new Date(2026, 8, 14, 12, 0, 0);

  it("reads the nested iOS form", () => {
    const date = parseExifDate({ "{Exif}": { DateTimeOriginal: "2025:04:12 14:03:59" } }, now);
    expect(date).toEqual(new Date(2025, 3, 12, 14, 3, 59));
  });

  it("reads the flattened form", () => {
    const date = parseExifDate({ DateTimeOriginal: "2026:01:02 08:00:00" }, now);
    expect(date).toEqual(new Date(2026, 0, 2, 8, 0, 0));
  });

  it("returns null rather than guessing", () => {
    expect(parseExifDate(null, now)).toBeNull();
    expect(parseExifDate({}, now)).toBeNull();
    expect(parseExifDate({ DateTimeOriginal: "yesterday" }, now)).toBeNull();
    expect(parseExifDate({ DateTimeOriginal: 12345 }, now)).toBeNull();
  });

  // new Date() rolls month 13 into the next year instead of failing.
  it("rejects impossible dates", () => {
    expect(parseExifDate({ DateTimeOriginal: "2025:13:01 00:00:00" }, now)).toBeNull();
    expect(parseExifDate({ DateTimeOriginal: "2025:02:30 00:00:00" }, now)).toBeNull();
  });

  it("rejects dates in the future", () => {
    expect(parseExifDate({ DateTimeOriginal: "2027:01:01 00:00:00" }, now)).toBeNull();
  });
});
