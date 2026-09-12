import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Colors, Spacing, Typography } from "@constants/theme";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Verdure</Text>
        <Text style={styles.subtitle}>Honest plant identification</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.welcomeText}>
          Identify plants from photos with honest confidence.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push("/scan")}
        >
          <Text style={styles.buttonText}>Scan a Plant</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>My Plants</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Never fake confidence. Always show alternatives.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "space-between",
    paddingHorizontal: Spacing.default,
  },
  header: {
    paddingVertical: Spacing.spacious,
    alignItems: "center",
  },
  title: {
    fontSize: Typography.displayLarge.fontSize,
    fontWeight: Typography.displayLarge.fontWeight,
    color: Colors.leaf,
    marginBottom: Spacing.tight,
  },
  subtitle: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    marginBottom: Spacing.spacious,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: Colors.leaf,
    paddingVertical: Spacing.default,
    paddingHorizontal: Spacing.spacious,
    borderRadius: 12,
    marginBottom: Spacing.default,
    minWidth: 200,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: Typography.button.fontSize,
    fontWeight: Typography.button.fontWeight,
  },
  secondaryButton: {
    backgroundColor: Colors.glass,
    paddingVertical: Spacing.default,
    paddingHorizontal: Spacing.spacious,
    borderRadius: 12,
    minWidth: 200,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: Colors.leaf,
    fontSize: Typography.button.fontSize,
    fontWeight: Typography.button.fontWeight,
  },
  footer: {
    paddingVertical: Spacing.loose,
    alignItems: "center",
  },
  footerText: {
    fontSize: Typography.caption2.fontSize,
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
});
