import { useEffect } from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { BrandColors } from "@constants/theme";

/**
 * A glowing line sweeping up and down while a photo is being looked at — over
 * the camera frame while it's checked, and over the photo while it's
 * identified. Position it with `style`; `travel` is how far it moves.
 */
export function ScanSweep({ travel, style }: { travel: number; style?: StyleProp<ViewStyle> }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(progress);
  }, [progress]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * travel }],
  }));

  return <Animated.View pointerEvents="none" style={[styles.line, style, animated]} />;
}

const styles = StyleSheet.create({
  line: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: BrandColors.brandBright,
    shadowColor: BrandColors.brandBright,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});
