import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle } from "react-native";
import { ReactNode } from "react";
import type { SFSymbol } from "expo-symbols";
import { Radius, Spacing, Typography, type Palette } from "@constants/theme";
import { useColors, useThemedStyles } from "@hooks/useTheme";
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
 * The header every pushed screen uses: back chevron and label in the brand
 * colour, then an iOS large title.
 *
 * One component means one tap target in one place, sized to Apple's 44pt
 * minimum, instead of every screen improvising its own.
 */
export function ScreenHeader({
  onBack,
  backLabel = "Back",
  title,
  subtitle,
  right,
  style,
}: ScreenHeaderProps) {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="chevron.left" size={19} color={Colors.brand} weight="semibold" />
            <Text style={styles.backLabel}>{backLabel}</Text>
          </Pressable>
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

/** A round icon button for the right-hand slot, or over photos. */
export function HeaderIconButton({
  icon,
  label,
  onPress,
  onDark = false,
}: {
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  onDark?: boolean;
}) {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        onDark ? styles.iconButtonDark : styles.iconButtonLight,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Icon name={icon} size={18} color={onDark ? "#FFFFFF" : Colors.textPrimary} weight="semibold" />
    </Pressable>
  );
}

const createStyles = (Colors: Palette) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: Spacing.default,
      paddingTop: Spacing.compact,
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
      gap: 2,
      minHeight: 44,
      minWidth: 44,
      marginLeft: -6,
    },
    backLabel: {
      ...Typography.bodyLarge,
      color: Colors.brand,
    },
    pressed: {
      opacity: 0.55,
    },
    title: {
      ...Typography.displayLarge,
      color: Colors.textPrimary,
      marginTop: Spacing.compact,
    },
    subtitle: {
      ...Typography.bodyLarge,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: Radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    iconButtonLight: {
      backgroundColor: Colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.separator,
    },
    iconButtonDark: {
      backgroundColor: "rgba(0, 0, 0, 0.35)",
    },
  });
