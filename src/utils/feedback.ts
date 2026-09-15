import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * The light tick iOS gives when a choice changes — a segment, a plan, a
 * candidate. Only on a change, never on every tap, and silent where haptics
 * aren't supported.
 */
export function selectionFeedback(): void {
  if (Platform.OS !== "ios") return;
  Haptics.selectionAsync().catch(() => undefined);
}
