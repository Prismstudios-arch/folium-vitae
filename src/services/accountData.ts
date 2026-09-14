/**
 * Export and delete — everything we hold, in both places we hold it.
 *
 * Settings' Delete used to clear this phone only, while the privacy policy
 * says it "removes your plants and your account data" and the terms say you
 * can "delete everything we hold". The server kept the account and its
 * identification history. Export had the same gap.
 */

import { getApiClient } from "./apiClient";
import { exportUserData, resetAllData } from "./userPreferences";
import { cancelAllWateringReminders } from "./wateringReminders";
import { bootstrapSession, forgetDevice } from "./session";
import { configurePurchases } from "./purchases";

/** The server couldn't be reached, so nothing at all has been deleted. */
export class ServerDeletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerDeletionError";
  }
}

/**
 * Everything on this phone plus what the server holds.
 *
 * If the server can't be reached the file says so in plain words, rather
 * than handing over a partial export that presents itself as complete.
 */
export async function exportEverything(): Promise<string> {
  const local = JSON.parse(await exportUserData());

  let server: Record<string, unknown>;
  try {
    server = { identificationHistory: await getApiClient().getIdentificationHistory() };
  } catch {
    server = {
      notIncluded:
        "Sorrel couldn't reach its server, so the identification history held there isn't in " +
        "this file. Export again when you're online to include it.",
    };
  }

  return JSON.stringify({ ...local, server }, null, 2);
}

/**
 * Delete the account on the server, then everything on this phone.
 *
 * Server first: if it can't be reached, this throws ServerDeletionError
 * before anything is touched, so the person can choose between waiting and
 * clearing the phone only (localOnly). Deleting locally first and then
 * failing would leave the account behind while the app looked wiped.
 *
 * Afterwards the device id is forgotten and a new anonymous session started,
 * so nothing links what comes next to the deleted account.
 */
export async function deleteEverything({ localOnly = false }: { localOnly?: boolean } = {}): Promise<void> {
  if (!localOnly) {
    try {
      await getApiClient().deleteAccount();
    } catch (error) {
      throw new ServerDeletionError(
        error instanceof Error ? error.message : "The server couldn't be reached."
      );
    }
  }

  await cancelAllWateringReminders();
  await resetAllData();

  if (!localOnly) {
    await forgetDevice();

    try {
      await bootstrapSession();
      const userId = getApiClient().getUserId();
      if (userId) await configurePurchases(userId);
    } catch {
      // Offline now. The next launch signs in afresh.
    }
  }
}
