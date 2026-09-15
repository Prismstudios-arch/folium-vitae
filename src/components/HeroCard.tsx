import React, { ReactNode } from "react";
import { View, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Radius, Shadow, Spacing } from "@constants/theme";

/**
 * The emerald surface from the app icon, with the icon's leaves growing in
 * from the corner. Used where the app wants to feel like the brand — the home
 * hero, onboarding, the paywall — and nowhere else, so it keeps its weight.
 *
 * illustrationStyle moves the leaves per use: they must never sit behind
 * text, and every hero has its text in a different place.
 */
export function HeroCard({
  children,
  illustration = true,
  rounded = true,
  style,
  contentStyle,
  illustrationStyle,
}: {
  children: ReactNode;
  illustration?: boolean;
  rounded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  illustrationStyle?: StyleProp<ImageStyle>;
}) {
  return (
    <View style={[rounded && styles.rounded, rounded && Shadow.raised, style]}>
      <LinearGradient
        colors={[Colors.brandLit, Colors.brandDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.fill, rounded && styles.rounded]}
      >
        {illustration ? (
          <Image
            source={require("../../assets/illustrations/hero-sprig.png")}
            style={[styles.illustration, illustrationStyle]}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <View style={[styles.content, contentStyle]}>{children}</View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  rounded: {
    borderRadius: Radius.xl,
    overflow: "hidden",
  },
  fill: {
    overflow: "hidden",
  },
  illustration: {
    position: "absolute",
    right: -70,
    bottom: -60,
    width: 250,
    height: 225,
  },
  content: {
    padding: Spacing.loose,
  },
});
