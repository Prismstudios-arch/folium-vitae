import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";

export default function DiseaseDetectionScreen() {
  const router = useRouter();
  const { plantId } = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<{
    isHealthy: boolean;
    confidence: number;
    diseases: Array<{ name: string; severity: "mild" | "moderate" | "severe" }>;
    recommendations: string[];
  } | null>(null);

  const handleAnalyzePhoto = async () => {
    if (!permission?.granted) {
      await requestPermission();
      return;
    }

    // TODO: Capture photo and send to disease detection API
    setIsAnalyzing(true);

    try {
      // Simulate analysis
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setDiagnosis({
        isHealthy: true,
        confidence: 0.95,
        diseases: [],
        recommendations: [
          "Keep soil moist but not waterlogged",
          "Ensure good air circulation",
          "Monitor for spider mites regularly",
        ],
      });
    } catch (error) {
      Alert.alert("Error", "Failed to analyze plant health");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRequestExpertHelp = () => {
    router.push({
      pathname: "/expert-escalation",
      params: { plantId },
    });
  };

  if (isAnalyzing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.leaf} />
          <Text style={styles.loadingText}>Analyzing plant health...</Text>
        </View>
      </View>
    );
  }

  if (diagnosis) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.statusContainer}>
          <Text style={styles.statusEmoji}>{diagnosis.isHealthy ? "✅" : "⚠️"}</Text>
          <Text style={styles.statusTitle}>
            {diagnosis.isHealthy ? "Plant is Healthy" : "Plant Needs Attention"}
          </Text>
          <Text style={styles.confidence}>
            Confidence: {Math.round(diagnosis.confidence * 100)}%
          </Text>
        </View>

        {diagnosis.diseases.length > 0 && (
          <View style={styles.diseasesSection}>
            <Text style={styles.sectionTitle}>Issues Detected</Text>
            {diagnosis.diseases.map((disease, idx) => (
              <View key={idx} style={styles.diseaseItem}>
                <Text style={styles.diseaseName}>{disease.name}</Text>
                <Text style={[styles.severity, { color: getSeverityColor(disease.severity) }]}>
                  {disease.severity.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.recommendationsSection}>
          <Text style={styles.sectionTitle}>Care Recommendations</Text>
          {diagnosis.recommendations.map((rec, idx) => (
            <View key={idx} style={styles.recommendationItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.recommendationText}>{rec}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionsSection}>
          <Button
            label="Ask an Expert"
            onPress={handleRequestExpertHelp}
          />
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => setDiagnosis(null)}
          >
            <Text style={styles.retryText}>Analyze Again</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Disease Detection</Text>
        <Text style={styles.subtitle}>Check your plant's health</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🔍</Text>
        </View>

        <Text style={styles.description}>
          Take a clear photo of your plant's leaves to detect diseases, pests, and health issues.
        </Text>

        <View style={styles.tipsSection}>
          <Text style={styles.tipsTitle}>📸 Photography Tips</Text>
          <Text style={styles.tip}>• Photograph affected areas clearly</Text>
          <Text style={styles.tip}>• Ensure good lighting</Text>
          <Text style={styles.tip}>• Focus on leaves or stems with problems</Text>
          <Text style={styles.tip}>• Avoid shadows and reflections</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          label="Take Photo"
          onPress={handleAnalyzePhoto}
        />
      </View>
    </View>
  );
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "severe":
      return Colors.confident; // Use as error color (red)
    case "moderate":
      return Colors.probably; // Warning (yellow)
    case "mild":
      return Colors.notSure; // Info (blue)
    default:
      return Colors.textSecondary;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.default,
  },
  loadingText: {
    marginTop: Spacing.default,
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
  },
  header: {
    paddingHorizontal: Spacing.default,
    paddingTop: Spacing.spacious,
    paddingBottom: Spacing.default,
  },
  title: {
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  subtitle: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.default,
    justifyContent: "center",
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: Spacing.loose,
  },
  icon: {
    fontSize: 64,
  },
  description: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.loose,
    lineHeight: 24,
  },
  tipsSection: {
    backgroundColor: Colors.glass,
    borderRadius: 12,
    padding: Spacing.default,
    marginBottom: Spacing.loose,
  },
  tipsTitle: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  tip: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    marginBottom: Spacing.compact,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: Spacing.default,
    paddingBottom: Spacing.spacious,
  },
  statusContainer: {
    alignItems: "center",
    paddingVertical: Spacing.spacious,
    paddingHorizontal: Spacing.default,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass,
  },
  statusEmoji: {
    fontSize: 48,
    marginBottom: Spacing.compact,
  },
  statusTitle: {
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  confidence: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
  },
  diseasesSection: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.loose,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass,
  },
  sectionTitle: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.default,
  },
  diseaseItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.compact,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass,
  },
  diseaseName: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
  },
  severity: {
    fontSize: Typography.caption1.fontSize,
    fontWeight: "600" as any,
  },
  recommendationsSection: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.loose,
  },
  recommendationItem: {
    flexDirection: "row",
    marginBottom: Spacing.default,
  },
  bullet: {
    fontSize: Typography.body.fontSize,
    color: Colors.leaf,
    marginRight: Spacing.compact,
    fontWeight: "bold" as any,
  },
  recommendationText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  actionsSection: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.loose,
  },
  retryButton: {
    marginTop: Spacing.default,
    paddingVertical: Spacing.default,
    alignItems: "center",
  },
  retryText: {
    fontSize: Typography.body.fontSize,
    color: Colors.leaf,
    fontWeight: "600" as any,
  },
});
