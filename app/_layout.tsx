import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { Colors } from "@constants/theme";
import { getUserPreferences } from "@services/userPreferences";
import { bootstrapSession } from "@services/session";

function NavigationLayout() {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    void startUp();
  }, []);

  const startUp = async () => {
    // Sign in and read preferences together — neither depends on the other,
    // and running them in series would add a network round trip to launch.
    //
    // allSettled, not all: a failed sign-in must not stop the app opening.
    // My Plants, care cards and the journal all read from the local database
    // and work offline; only identification needs the network (SPEC 7.3).
    const [prefsResult] = await Promise.allSettled([
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

    setIsChecking(false);
  };

  if (isChecking) {
    return null; // Loading state handled by Stack
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
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
