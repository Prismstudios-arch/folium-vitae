import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const imageUri = params.imageUri as string | undefined;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Photo */}
      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />
      )}

      <View style={styles.content}>
        {/* Placeholder: Identification will fill this in */}
        <Text style={styles.title}>Identifying…</Text>
        <Text style={styles.subtitle}>Loading identification results</Text>

        {/* Plant Info Placeholder */}
        <View style={styles.infoBox}>
          <Text style={styles.label}>Scientific Name</Text>
          <Text style={styles.value}>(Identification in progress)</Text>

          <Text style={styles.label}>Common Name</Text>
          <Text style={styles.value}>(Will be determined by backend)</Text>

          <Text style={styles.label}>Confidence</Text>
          <Text style={styles.value}>(Honest confidence band)</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonGroup}>
          <Button label="Save to My Plants" onPress={() => {}} />
          <Button label="Share" onPress={() => {}} variant="secondary" style={styles.marginTop} />
        </View>

        {/* Navigation */}
        <TouchableOpacity onPress={() => router.push("/")}>
          <Text style={styles.link}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.default,
  },
  backButton: {
    color: Colors.leaf,
    fontSize: Typography.button.fontSize,
    fontWeight: Typography.button.fontWeight as any,
  },
  photo: {
    width: "100%",
    height: 300,
    backgroundColor: Colors.glass,
  },
  content: {
    padding: Spacing.default,
  },
  title: {
    fontSize: Typography.display.fontSize,
    fontWeight: Typography.display.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.tight,
  },
  subtitle: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    marginBottom: Spacing.loose,
  },
  infoBox: {
    backgroundColor: Colors.glass,
    borderRadius: 12,
    padding: Spacing.default,
    marginBottom: Spacing.loose,
  },
  label: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    marginBottom: Spacing.compact,
    marginTop: Spacing.default,
  },
  value: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  buttonGroup: {
    marginBottom: Spacing.spacious,
  },
  marginTop: {
    marginTop: Spacing.default,
  },
  link: {
    color: Colors.leaf,
    fontSize: Typography.body.fontSize,
    textAlign: "center",
    marginTop: Spacing.spacious,
  },
});
