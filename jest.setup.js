// Jest setup file for Verdure tests
// This runs before all tests

// Mock console methods in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
  debug: jest.fn(),
};

// Mock timers where needed
jest.useFakeTimers();

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock Expo modules
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSegments: () => [],
}));

jest.mock("expo-camera", () => ({
  CameraView: () => null,
  useCameraPermissions: () => [
    { granted: true },
    () => Promise.resolve({ granted: true }),
  ],
}));

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  }),
}));

// A hand-written Reanimated mock covering what the app uses. Under
// Reanimated 4, both requireActual and the package's own mock load
// react-native-worklets, which can't initialise in Jest — so neither can be
// used once a tested component (the button's press spring) imports it.
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  const identity = (value) => value;
  const layoutAnimation = () => {
    const builder = { duration: () => builder, delay: () => builder, springify: () => builder };
    return builder;
  };

  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (Component) => Component },
    useSharedValue: (value) => ({ value }),
    useAnimatedStyle: (factory) => factory(),
    withSpring: identity,
    withTiming: identity,
    withRepeat: identity,
    cancelAnimation: () => undefined,
    Easing: { inOut: identity, quad: identity },
    FadeIn: layoutAnimation(),
    FadeInDown: layoutAnimation(),
  };
});

// SF Symbols are a native iOS view; tests only need the component to exist.
jest.mock("expo-symbols", () => ({ SymbolView: () => null }));

// prop-types is no longer a dependency: React 19 removed it, so there is
// nothing left to mock and doing so fails module resolution.

// Add custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});
