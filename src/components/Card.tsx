import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import type { SFSymbol } from "expo-symbols";
import { Spacing, ComponentStyles, Typography, type Palette } from "@constants/theme";
import { useColors, useThemedStyles } from "@hooks/useTheme";
import { Icon } from "./Icon";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export function Card({ children, style, testID }: CardProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

// Badges for confidence and toxicity

interface ConfidenceBadgeProps {
  band: "confident" | "probably" | "notSure";
  testID?: string;
}

const BAND: Record<ConfidenceBadgeProps["band"], { label: string; color: keyof Palette; icon: SFSymbol }> = {
  confident: { label: "Confident", color: "confident", icon: "checkmark.seal.fill" },
  probably: { label: "Probably", color: "probably", icon: "questionmark.circle.fill" },
  notSure: { label: "Not sure", color: "notSure", icon: "questionmark.circle" },
};

export function ConfidenceBadge({ band, testID }: ConfidenceBadgeProps) {
  const styles = useThemedStyles(createStyles);
  const Colors = useColors();
  const { label, icon } = BAND[band];
  const color = Colors[BAND[band].color];

  return (
    <View style={[styles.badge, { backgroundColor: color }]} testID={testID}>
      <Icon name={icon} size={14} color="#FFFFFF" weight="semibold" />
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

interface ToxicityBadgeProps {
  type: "cats" | "dogs" | "humans";
  level: "none" | "mild" | "moderate" | "severe";
  testID?: string;
}

const TOXIC_TO: Record<ToxicityBadgeProps["type"], { label: string; icon: SFSymbol }> = {
  cats: { label: "Toxic to cats", icon: "pawprint.fill" },
  dogs: { label: "Toxic to dogs", icon: "pawprint.fill" },
  humans: { label: "Toxic to people", icon: "exclamationmark.triangle.fill" },
};

/** DESIGN.md: sienna, white text, icon and label ("Toxic to cats"). */
export function ToxicityBadge({ type, level, testID }: ToxicityBadgeProps) {
  const styles = useThemedStyles(createStyles);
  if (level === "none") return null;

  const { label, icon } = TOXIC_TO[type];

  return (
    <View style={[styles.badge, styles.toxicityBadge]} testID={testID}>
      <Icon name={icon} size={12} color="#FFFFFF" weight="semibold" />
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const createStyles = (Colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.background,
      borderRadius: ComponentStyles.card.borderRadius,
      padding: ComponentStyles.card.padding,
      borderColor: Colors.glass,
      borderWidth: 1,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: Spacing.tight,
      paddingVertical: 6,
      borderRadius: 8,
      alignSelf: "flex-start",
    },
    badgeText: {
      ...Typography.caption2,
      color: "#FFFFFF",
      fontWeight: "600",
    },
    toxicityBadge: {
      backgroundColor: Colors.toxicity,
    },
  });
