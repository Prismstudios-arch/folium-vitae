import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Radius, Spacing, Typography, type Palette } from "@constants/theme";
import { useColors, useThemedStyles } from "@hooks/useTheme";
import { ConfidenceBand } from "@domain/plant";

const BAND_COLOR: Record<ConfidenceBand, keyof Palette> = {
  [ConfidenceBand.Confident]: "confident",
  [ConfidenceBand.Probably]: "probably",
  [ConfidenceBand.NotSure]: "notSure",
};

const BAND_LABEL: Record<ConfidenceBand, string> = {
  [ConfidenceBand.Confident]: "Confident",
  [ConfidenceBand.Probably]: "Probably",
  [ConfidenceBand.NotSure]: "Not sure",
};

/**
 * How sure the identification is, as a filled bar with the band in words.
 * A bare "Score: 87%" asked people to interpret a number; the band tells them
 * what it means, and the bar shows it at a glance.
 */
export function ConfidenceMeter({ band, score }: { band: ConfidenceBand; score: number }) {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  const color = Colors[BAND_COLOR[band]];
  const percent = Math.round(Math.min(Math.max(score, 0), 1) * 100);

  // The bar fills in when it appears, so it reads as a measurement being
  // taken rather than a decoration. Reanimated skips it under Reduce Motion.
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(percent, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [percent, fill]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`${BAND_LABEL[band]}, ${percent} percent`}
    >
      <View style={styles.labels}>
        <Text style={[styles.band, { color }]}>{BAND_LABEL[band]}</Text>
        <Text style={styles.percent}>{percent}% match</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
      </View>
    </View>
  );
}

const createStyles = (Colors: Palette) =>
  StyleSheet.create({
    labels: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: Spacing.tight,
    },
    band: {
      ...Typography.subheadline,
    },
    percent: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      fontVariant: ["tabular-nums"],
    },
    track: {
      height: 8,
      borderRadius: Radius.pill,
      backgroundColor: Colors.separator,
      overflow: "hidden",
    },
    fill: {
      height: "100%",
      borderRadius: Radius.pill,
    },
  });
