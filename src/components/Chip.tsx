import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import type { SFSymbol } from "expo-symbols";
import { Colors, Radius, Spacing, Typography } from "@constants/theme";
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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && !selected && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {icon ? (
        <Icon name={icon} size={14} color={selected ? Colors.textOnBrand : Colors.textSecondary} weight="semibold" />
      ) : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "#EEF1EF",
  },
  label: {
    ...Typography.controlSmall,
    color: Colors.textPrimary,
  },
  labelSelected: {
    color: Colors.textOnBrand,
    fontWeight: "600",
  },
});
