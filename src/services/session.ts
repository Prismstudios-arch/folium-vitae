/**
 * Session bootstrap.
 *
 * The product promises a first scan with no account (SPEC 9), so the app
 * signs in anonymously against a device identifier the first time it runs and
 * reuses that identifier forever after.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiClient, PublicUser } from "./apiClient";
import { generateId } from "@utils/id";

const DEVICE_ID_KEY = "folium_device_id";

/**
 * The stable id for this install.
 *
 * Generated once and persisted. It is not a hardware identifier — Apple
 * rejects apps that fingerprint devices, and we have no need to: this only
 * has to be stable for this install, not unique to this handset.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);

  if (existing) {
    return existing;
  }

  const deviceId = `dev_${generateId()}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
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
