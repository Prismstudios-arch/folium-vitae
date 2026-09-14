import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from "react-native";
import { ReactNode } from "react";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Icon } from "./Icon";

interface ScreenHeaderProps {
  /** Omit for a screen with nowhere to go back to. */
  onBack?: () => void;
  backLabel?: string;
  title?: string;
  subtitle?: string;
  /** An action on the right — an icon button, usually. */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The header every pushed screen uses.
 *
 * Each screen had built its own: "← Back" in one, a bare "←" in another, a
 * back link at the bottom of Settings, and none at all on My Plants. One
 * component means one tap target in one place, sized to Apple's 44pt minimum.
 */
export function ScreenHeader({
  onBack,
  backLabel = "Back",
  title,
  subtitle,
  right,
  style,
}: ScreenHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="chevron.left" size={18} weight="semibold" />
            <Text style={styles.backLabel}>{backLabel}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.back} />
        )}
        {right ?? null}
      </View>

      {title ? (
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** A round icon button for the right-hand slot. */
export function HeaderIconButton({
  icon,
  label,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.iconButton}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Icon name={icon} size={20} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.default,
    paddingTop: Spacing.tight,
    paddingBottom: Spacing.default,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.compact,
    minHeight: 44,
    minWidth: 44,
  },
  backLabel: {
    ...Typography.bodyLarge,
    color: Colors.leaf,
  },
  title: {
    ...Typography.display,
    color: Colors.textPrimary,
    marginTop: Spacing.tight,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.compact,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
