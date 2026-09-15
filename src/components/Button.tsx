import React from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator, StyleProp, ViewStyle, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import type { SFSymbol } from "expo-symbols";
import { ComponentStyles, Motion, Typography, type Palette } from "@constants/theme";
import { useColors, useThemedStyles } from "@hooks/useTheme";
import { Icon } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive" | "inverse";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: SFSymbol;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const variantColors = (Colors: Palette): Record<ButtonVariant, { background: string; text: string }> => ({
  primary: { background: Colors.brand, text: Colors.textOnBrand },
  secondary: { background: Colors.brandTint, text: Colors.brandDark },
  tertiary: { background: "transparent", text: Colors.brand },
  destructive: { background: Colors.errorTint, text: Colors.error },
  /** White, for the emerald hero surfaces. */
  inverse: { background: "#FFFFFF", text: Colors.brandDeep },
});

/**
 * The app's button.
 *
 * It settles back with a spring when pressed, the way native controls do.
 * Disabled buttons keep their colour at reduced opacity: the previous version
 * swapped to a pale grey fill but left the label white, so a disabled "Scan
 * your first plant" was white text on light grey — unreadable.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled = false,
  loading = false,
  style,
  testID,
}: ButtonProps) {
  const styles = useThemedStyles(createStyles);
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);
  const palette = useColors();
  const colors = variantColors(palette)[variant];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => {
        scale.value = withSpring(0.97, Motion.springs.standard);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, Motion.springs.standard);
      }}
      style={[
        styles.base,
        { backgroundColor: colors.background },
        disabled && !loading && styles.disabled,
        animatedStyle,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={18} color={colors.text} weight="semibold" /> : null}
          <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

interface SecondaryButtonProps extends Omit<ButtonProps, "variant"> {}

export function SecondaryButton(props: SecondaryButtonProps) {
  return <Button {...props} variant="secondary" />;
}

export function TertiaryButton(props: SecondaryButtonProps) {
  return <Button {...props} variant="tertiary" />;
}

const createStyles = (Colors: Palette) =>
  StyleSheet.create({
    base: {
      minHeight: ComponentStyles.button.minHeight,
      borderRadius: ComponentStyles.button.borderRadius,
      paddingHorizontal: ComponentStyles.button.paddingHorizontal,
      justifyContent: "center",
      alignItems: "center",
    },
    content: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    disabled: {
      opacity: 0.4,
    },
    text: {
      ...Typography.button,
    },
  });
