import { Stack, useRouter } from "expo-router";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import { Colors } from "@constants/theme";
import { getUserPreferences } from "@services/userPreferences";
import { bootstrapSession } from "@services/session";
import { getApiClient } from "@services/apiClient";
import { configurePurchases } from "@services/purchases";
import { initializeDatabase } from "@services/database";

// Show reminders that arrive while the app is open; without a handler iOS
// drops them silently. This used to live in a notifications module that
// nothing imported, so it never ran.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function NavigationLayout() {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

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

    // Sign in and read preferences together — neither depends on the other,
    // and running them in series would add a network round trip to launch.
    //
    // allSettled, not all: a failed sign-in must not stop the app opening.
    // My Plants, care cards and the journal all read from the local database
    // and work offline; only identification needs the network (SPEC 7.3).
    const [prefsResult, sessionResult] = await Promise.allSettled([
      getUserPreferences(),
      bootstrapSession(),
    ]);

    if (prefsResult.status === "fulfilled") {
      setIsOnboarded(prefsResult.value.hasCompletedOnboarding);

      if (!prefsResult.value.hasCompletedOnboarding) {
        router.replace("/onboarding");
      }
    } else {
      console.error("Failed to read preferences:", prefsResult.reason);
      setIsOnboarded(false);
    }

    // Nothing ever configured RevenueCat, so the paywall could never load a
    // plan and no purchase could be made. Keyed to our user id so the
    // webhook can find the account.
    if (sessionResult.status === "fulfilled") {
      const userId = getApiClient().getUserId();
      if (userId) void configurePurchases(userId);
    }

    setIsChecking(false);
  };

  if (isChecking) {
    return null; // Loading state handled by Stack
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // With the native header hidden, screens start at the very top of
        // the display — under the status bar, the notch and the Dynamic
        // Island, where touches don't land. Every back button sat there.
        // Padding here, once, means no screen can forget it.
        contentStyle: {
          backgroundColor: Colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      }}
    >
      {!isOnboarded ? (
        <Stack.Screen
          name="onboarding"
          options={{
            title: "Onboarding",
            animation: "none",
          }}
        />
      ) : (
        <>
          <Stack.Screen name="index" options={{ title: "Home" }} />
          <Stack.Screen name="scan" options={{ title: "Scan Plant" }} />
          <Stack.Screen name="result" options={{ title: "Result" }} />
          <Stack.Screen name="my-plants" options={{ title: "My Plants" }} />
          <Stack.Screen name="plant-detail" options={{ title: "Plant Details" }} />
          <Stack.Screen name="settings" options={{ title: "Settings" }} />
          <Stack.Screen name="privacy" options={{ title: "Privacy" }} />
          <Stack.Screen name="terms" options={{ title: "Terms of use" }} />
        </>
      )}
    </Stack>
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
