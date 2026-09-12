import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { Colors } from "@constants/theme";
import { getUserPreferences } from "@services/userPreferences";

function NavigationLayout() {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const prefs = await getUserPreferences();
      setIsOnboarded(prefs.hasCompletedOnboarding);
      setIsChecking(false);

      // Route based on onboarding status
      if (!prefs.hasCompletedOnboarding) {
        router.replace("/onboarding");
      }
    } catch (error) {
      console.error("Failed to check onboarding:", error);
      setIsOnboarded(false);
      setIsChecking(false);
    }
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
            animationEnabled: false,
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
