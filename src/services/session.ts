/**
 * Session bootstrap.
 *
 * The product promises a first scan with no account (SPEC 9), so the app
 * signs in anonymously against a device identifier the first time it runs and
 * reuses that identifier forever after.
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { getApiClient, PublicUser } from "./apiClient";
import { generateId } from "@utils/id";

/** Where the id lived before it survived reinstalling. Still honoured. */
const LEGACY_KEY = "sorrel_device_id";
/** Keychain, which outlives deleting the app. */
const DEVICE_KEY = "sorrel_device_id_v2";
/** Rotated when someone deletes their account, so they get a genuinely new one. */
const SALT_KEY = "sorrel_device_salt";

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  // The app can be launched by a notification before the phone is unlocked;
  // WHEN_UNLOCKED would fail there and hand out a second identity.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/** SecureStore is iOS/Android only, and can fail. Never fatal. */
async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    return await SecureStore.getItemAsync(key, SECURE_OPTIONS);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.setItemAsync(key, value, SECURE_OPTIONS);
  } catch {
    // Stored in the keychain if we can, derived again if we can't.
  }
}

/**
 * The stable id for this install.
 *
 * The free allowance is counted against this id on the server, and the
 * privacy policy says it cannot be reset by reinstalling — so it must not be
 * a value that deleting the app throws away. Two things make that true: it
 * lives in the keychain, which survives deletion, and it is derived from the
 * identifier iOS gives apps from the same developer, so it can be worked out
 * again even if the keychain is cleared.
 *
 * What is sent is a hash, never the identifier itself. It is not a hardware
 * serial, is not your Apple ID, and is meaningless to anyone but this app —
 * Apple resets it once every app from this developer is removed.
 */
export async function getDeviceId(): Promise<string> {
  // Installs that predate the keychain keep the id they already have, so
  // nobody's collection or subscription is orphaned by this change — and it
  // is copied into the keychain on the way past. Left in AsyncStorage alone
  // it would be thrown away by the next reinstall, handing that phone a new
  // identity and a fresh allowance, which is the one thing the keychain is
  // here to prevent.
  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (legacy) {
    if (!(await secureGet(DEVICE_KEY))) {
      await secureSet(DEVICE_KEY, legacy);
    }
    return legacy;
  }

  const stored = await secureGet(DEVICE_KEY);
  if (stored) return stored;

  const deviceId = await deriveDeviceId();
  await secureSet(DEVICE_KEY, deviceId);
  return deviceId;
}

async function deriveDeviceId(): Promise<string> {
  const vendorId =
    Platform.OS === "ios" ? await safely(() => Application.getIosIdForVendorAsync()) : null;

  if (!vendorId) {
    // Android, the simulator, or an iOS that declined to answer. A random id
    // is still stored in the keychain, so it survives reinstalling too.
    return `dev_${generateId()}`;
  }

  const salt = (await secureGet(SALT_KEY)) ?? "";
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${vendorId}:${salt}`
  );

  return `idv_${digest.slice(0, 32)}`;
}

async function safely<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

/**
 * Forget this install's id, so the next sign-in creates a new anonymous
 * account. Used after deleting an account — reusing the old id would
 * quietly recreate the account that was just deleted.
 *
 * Rotating the salt is what makes that work now the id is derived: without a
 * new salt the same phone would hash straight back to the account it just
 * deleted.
 */
export async function forgetDevice(): Promise<void> {
  await AsyncStorage.removeItem(LEGACY_KEY);

  if (Platform.OS === "web") return;

  try {
    await SecureStore.deleteItemAsync(DEVICE_KEY, SECURE_OPTIONS);
  } catch {
    // Nothing to delete, or the keychain refused. The salt below still changes.
  }

  await secureSet(SALT_KEY, generateId());
}

export interface SessionState {
  user: PublicUser | null;
  online: boolean;
}

/**
 * Restore a stored session, or create an anonymous one.
 *
 * Failing to sign in is not fatal. My Plants, care cards and the journal all
 * read from the local database, so the app stays usable offline and only
 * identification needs the network (SPEC 7.3).
 */
export async function bootstrapSession(): Promise<SessionState> {
  const api = getApiClient();

  const restored = await api.restoreSession();

  if (restored) {
    return { user: null, online: true };
  }

  try {
    const user = await api.loginAnonymous(await getDeviceId());
    return { user, online: true };
  } catch {
    return { user: null, online: false };
  }
}
