import { View, StyleProp, ViewStyle } from "react-native";
import { SymbolView, SFSymbol, SymbolWeight } from "expo-symbols";
import { useColors } from "@hooks/useTheme";

interface IconProps {
  name: SFSymbol;
  size?: number;
  color?: string;
  weight?: SymbolWeight;
  style?: StyleProp<ViewStyle>;
}

/**
 * An SF Symbol — Apple's own icon set, drawn by the system at any size and
 * weight.
 *
 * The app used emoji as icons: ⚙️ for settings, 💡 for the torch, 🖼️ for the
 * library, 🌱 as a logo. Emoji render differently across iOS versions, can't
 * take the brand colour, and are the quickest way to make an app look
 * unfinished.
 */
export function Icon({ name, size = 22, color, weight = "medium", style }: IconProps) {
  const Colors = useColors();

  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color ?? Colors.brand}
      weight={weight}
      style={[{ width: size, height: size }, style]}
      // SF Symbols are iOS-only; elsewhere keep the space so layouts hold.
      fallback={<View style={[{ width: size, height: size }, style]} />}
    />
  );
}
