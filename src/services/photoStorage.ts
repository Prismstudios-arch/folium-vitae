/**
 * Keeping photos somewhere they survive.
 *
 * The camera, image picker and image manipulator all hand back files in the
 * cache directory, which iOS empties when it needs space. Anything worth
 * keeping is copied into the documents directory, which it does not.
 */

import { File, Directory, Paths } from "expo-file-system";
import { generateId } from "@utils/id";
import { PHOTO_DIR, toStoredPath, fileNameOf, isOwnedPhotoPath, extensionFor } from "./photoPaths";

/**
 * Copy a photo out of its temporary location.
 *
 * Returns the relative path to store — see toStoredPath for why it is never
 * an absolute URI.
 */
export async function persistPhoto(sourceUri: string): Promise<string> {
  const dir = new Directory(Paths.document, PHOTO_DIR);
  if (!dir.exists) dir.create();

  const fileName = `${generateId()}${extensionFor(sourceUri)}`;
  await new File(sourceUri).copy(new File(dir, fileName));

  return toStoredPath(fileName);
}

/** A stored path, as a URI an Image can load. */
export function resolvePhotoUri(stored: string): string {
  if (!isOwnedPhotoPath(stored)) return stored;
  return new File(Paths.document, PHOTO_DIR, fileNameOf(stored)).uri;
}

/**
 * Remove one saved photo's file.
 *
 * Best effort: the row is already gone, and a leftover file is invisible to
 * the user. Throwing here would report a delete as failed when it wasn't.
 */
export function deletePhotoFile(stored: string): void {
  if (!isOwnedPhotoPath(stored)) return;

  try {
    const file = new File(Paths.document, PHOTO_DIR, fileNameOf(stored));
    if (file.exists) file.delete();
  } catch (error) {
    console.warn("Couldn't remove photo file:", error);
  }
}

/**
 * Remove every saved photo.
 *
 * Unlike deletePhotoFile this throws. It backs "Delete all data", and telling
 * someone their photos are gone while they are still on the phone is the
 * one outcome that must not happen quietly.
 */
export function deleteAllPhotoFiles(): void {
  const dir = new Directory(Paths.document, PHOTO_DIR);
  if (dir.exists) dir.delete();
}

/** MD5 of a file's bytes, for spotting the same photo added twice. */
export function fingerprintPhoto(uri: string): string | null {
  try {
    return new File(uri).md5;
  } catch {
    return null;
  }
}
