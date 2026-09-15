import { Stack, useRouter } from "expo-router";
import { Platform } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import { Colors } from "@constants/theme";
import { getUserPreferences } from "@services/userPreferences";
import { bootstrapSession } from "@services/session";
import { getApiClient } from "@services/apiClient";
import { configurePurchases } from "@services/purchases";
import { initializeDatabase } from "@services/database";

// Local notifications don't exist on web, where these calls throw and take
// the whole app down. The web build is only used to preview screens.
const notificationsSupported = Platform.OS !== "web";

// Show reminders that arrive while the app is open; without a handler iOS
// drops them silently.
if (notificationsSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// Chosen once per platform, so the hook is called unconditionally either way.
const useLastNotificationResponse = notificationsSupported
  ? Notifications.useLastNotificationResponse
  : () => null;

/**
 * Screens that draw edge to edge — the emerald onboarding and paywall, the
 * camera — and handle the safe area themselves. With the shared padding they
 * got a strip of grey above them.
 */
const fullBleed = (backgroundColor: string) => ({ contentStyle: { backgroundColor } });

function NavigationLayout() {
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lastNotificationResponse = useLastNotificationResponse();

  useEffect(() => {
    void startUp();
  }, []);

  // Tapping a reminder opens what it's about. The hook covers both a tap
  // while the app is running and a tap that launched it; waiting for
  // isChecking means the navigator exists before we push onto it.
  useEffect(() => {
    if (isChecking || !lastNotificationResponse) return;

    const data = lastNotificationResponse.notification.request.content.data as
      | { kind?: string; plantId?: string }
      | undefined;

    if (data?.kind === "watering" && typeof data.plantId === "string") {
      router.push({ pathname: "/plant-detail", params: { id: data.plantId } });
    } else if (data?.kind === "trialEnding") {
      router.push("/settings");
    }
  }, [lastNotificationResponse, isChecking]);

  const startUp = async () => {
    // Every database call opens it on demand; this only means the first
    // screen that needs it isn't the one that waits.
    void initializeDatabase().catch(() => undefined);

    // allSettled, not all: a failed sign-in must not stop the app opening.
    // The collection works offline; only identification needs the network.
    const [prefsResult, sessionResult] = await Promise.allSettled([
      getUserPreferences(),
      bootstrapSession(),
    ]);

    if (prefsResult.status === "fulfilled") {
      if (!prefsResult.value.hasCompletedOnboarding) {
        router.replace("/onboarding");
      }
    } else {
      console.error("Failed to read preferences:", prefsResult.reason);
    }

    if (sessionResult.status === "fulfilled") {
      const userId = getApiClient().getUserId();
      if (userId) void configurePurchases(userId);
    }

    setIsChecking(false);
  };

  if (isChecking) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          // With the native header hidden, screens start at the very top of
          // the display, under the status bar and Dynamic Island, where
          // touches don't land. Padding here means no screen can forget it.
          contentStyle: {
            backgroundColor: Colors.bg,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        }}
      >
        <Stack.Screen name="onboarding" options={{ ...fullBleed(Colors.brandDeep), animation: "fade" }} />
        <Stack.Screen name="index" />
        <Stack.Screen name="scan" options={fullBleed("#000000")} />
        <Stack.Screen name="result" />
        <Stack.Screen name="my-plants" />
        <Stack.Screen name="plant-detail" />
        <Stack.Screen name="settings" />
        <Stack.Screen
          name="subscription"
          options={{ ...fullBleed(Colors.bg), presentation: "modal" }}
        />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="terms" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationLayout />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
