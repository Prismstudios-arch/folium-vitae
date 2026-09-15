import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import type { SFSymbol } from "expo-symbols";
import { Radius, Spacing, Typography, type Palette } from "@constants/theme";
import { useColors, useThemedStyles } from "@hooks/useTheme";
import { selectionFeedback } from "@utils/feedback";
import { Icon } from "./Icon";

/** A selectable pill: sort orders, filters, small choices. */
export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: SFSymbol;
}) {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={() => {
        if (!selected) selectionFeedback();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && !selected && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {icon ? (
        <Icon name={icon} size={14} color={selected ? Colors.bg : Colors.textSecondary} weight="semibold" />
      ) : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (Colors: Palette) =>
  StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 36,
      paddingHorizontal: Spacing.default - 2,
      borderRadius: Radius.pill,
    },
    unselected: {
      backgroundColor: Colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.separator,
    },
    selected: {
      backgroundColor: Colors.textPrimary,
    },
    pressed: {
      backgroundColor: Colors.fill,
    },
    label: {
      ...Typography.controlSmall,
      color: Colors.textPrimary,
    },
    // The selected chip is filled with the text colour, so its label takes
    // the ground colour: dark on light, light on dark.
    labelSelected: {
      color: Colors.bg,
      fontWeight: "600",
    },
  });
