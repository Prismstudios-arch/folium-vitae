import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { Colors, Spacing, ComponentStyles } from "@constants/theme";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export function Card({ children, style, testID }: CardProps) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

// Badge components for confidence and toxicity

interface ConfidenceBadgeProps {
  band: "confident" | "probably" | "notSure";
  testID?: string;
}

export function ConfidenceBadge({ band, testID }: ConfidenceBadgeProps) {
  const getBandColor = () => {
    switch (band) {
      case "confident":
        return Colors.confident;
      case "probably":
        return Colors.probably;
      case "notSure":
        return Colors.notSure;
    }
  };

  const getBandLabel = () => {
    switch (band) {
      case "confident":
        return "Confident";
      case "probably":
        return "Probably";
      case "notSure":
        return "Not sure";
    }
  };

  return (
    <View
      style={[styles.badge, { backgroundColor: getBandColor() }]}
      testID={testID}
    >
      <Text style={styles.badgeText}>{getBandLabel()}</Text>
    </View>
  );
}

interface ToxicityBadgeProps {
  type: "cats" | "dogs" | "humans";
  level: "none" | "mild" | "moderate" | "severe";
  testID?: string;
}

export function ToxicityBadge({ type, level, testID }: ToxicityBadgeProps) {
  if (level === "none") return null;

  const getEmoji = () => {
    switch (type) {
      case "cats":
        return "🐱";
      case "dogs":
        return "🐕";
      case "humans":
        return "⚠️";
    }
  };

  const getLabel = () => {
    const labels = {
      cats: "Toxic to cats",
      dogs: "Toxic to dogs",
      humans: "Toxic to humans",
    };
    return labels[type];
  };

  return (
    <View style={[styles.badge, styles.toxicityBadge]} testID={testID}>
      <Text style={styles.badgeText}>
        {getEmoji()} {getLabel()}
      </Text>
    </View>
  );
}

// Import Text from react-native for badge text
import { Text } from "react-native";

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background,
    borderRadius: ComponentStyles.card.borderRadius,
    padding: ComponentStyles.card.padding,
    borderColor: Colors.glass,
    borderWidth: 1,
  },
  badge: {
    paddingHorizontal: Spacing.tight,
    paddingVertical: Spacing.tight,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "500",
    fontSize: 12,
  },
  toxicityBadge: {
    backgroundColor: Colors.toxicity,
  },
});
