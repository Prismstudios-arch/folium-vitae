import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, Radius, Spacing, Typography } from "@constants/theme";
import { ConfidenceBand } from "@domain/plant";

const BAND_COLOR: Record<ConfidenceBand, string> = {
  [ConfidenceBand.Confident]: Colors.confident,
  [ConfidenceBand.Probably]: Colors.probably,
  [ConfidenceBand.NotSure]: Colors.notSure,
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
  const color = BAND_COLOR[band];
  const percent = Math.round(Math.min(Math.max(score, 0), 1) * 100);

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
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
