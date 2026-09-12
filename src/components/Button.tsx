import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Colors, Spacing, Typography, ComponentStyles } from "@constants/theme";

export type ButtonVariant = "primary" | "secondary" | "tertiary";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        style,
      ]}
      testID={testID}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? "#FFFFFF" : Colors.leaf}
          size="small"
        />
      ) : (
        <Text style={[styles.text, styles[`text_${variant}`]]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

interface SecondaryButtonProps extends Omit<ButtonProps, "variant"> {
  variant?: "secondary" | "tertiary";
}

export function SecondaryButton(props: SecondaryButtonProps) {
  return <Button {...props} variant="secondary" />;
}

export function TertiaryButton(props: SecondaryButtonProps) {
  return <Button {...props} variant="tertiary" />;
}

const styles = StyleSheet.create({
  base: {
    minHeight: ComponentStyles.button.minHeight,
    borderRadius: ComponentStyles.button.borderRadius,
    paddingHorizontal: ComponentStyles.button.paddingHorizontal,
    justifyContent: "center",
    alignItems: "center",
  },
  primary: {
    backgroundColor: Colors.leaf,
  },
  secondary: {
    backgroundColor: Colors.glass,
  },
  tertiary: {
    backgroundColor: "transparent",
  },
  disabled: {
    backgroundColor: Colors.glass,
    opacity: 0.5,
  },
  text: {
    fontSize: Typography.button.fontSize,
    fontWeight: Typography.button.fontWeight as any,
  },
  text_primary: {
    color: "#FFFFFF",
  },
  text_secondary: {
    color: Colors.leaf,
  },
  text_tertiary: {
    color: Colors.leaf,
  },
});
