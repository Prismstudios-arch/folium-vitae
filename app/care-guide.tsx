import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Radius, Spacing, Tiles, Typography, type Palette } from "@constants/theme";
import { useThemedStyles } from "@hooks/useTheme";
import { Button } from "@components/Button";
import { CareCard } from "@components/CareCard";
import { IconTile } from "@components/ListGroup";
import { ScreenHeader } from "@components/ScreenHeader";
import { useGoBack } from "@hooks/useGoBack";
import { lookupCareGuide } from "@services/careDatabase";
import type { Units } from "@services/careFormatting";
import { getUserPreferences } from "@services/userPreferences";
import type { Hemisphere } from "@services/wateringInsights";
import { formatCommonName } from "@utils/plantNames";

/** One plant's care guide, opened from the library rather than from a scan. */
export default function CareGuideScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const goBack = useGoBack("/plant-lookup");
  const { name = "" } = useLocalSearchParams<{ name?: string }>();
  const care = name ? lookupCareGuide(name) : null;

  const [units, setUnits] = useState<Units>("metric");
  const [hemisphere, setHemisphere] = useState<Hemisphere>("north");
  // Warnings default on: failing closed on a safety message.
  const [showToxicity, setShowToxicity] = useState(true);

  useEffect(() => {
    getUserPreferences()
      .then((prefs) => {
        setUnits(prefs.units);
        setHemisphere(prefs.hemisphere);
        setShowToxicity(prefs.showToxicityWarnings);
      })
      .catch(() => undefined);
  }, []);

  if (!care) {
    return (
      <View style={styles.container}>
        <ScreenHeader onBack={goBack} backLabel="Look up" />
        <View style={styles.centred}>
          <View style={styles.stateCard}>
            <IconTile icon="book.closed.fill" color={Tiles.grey} size={52} />
            <Text style={styles.stateTitle}>No care notes for this plant</Text>
            <Button label="Back to the library" onPress={goBack} style={styles.stateButton} />
          </View>
        </View>
      </View>
    );
  }

  const { guide } = care;
  const title = guide.commonNames[0] ? formatCommonName(guide.commonNames[0]) : guide.scientificName;
  const otherNames = guide.commonNames.slice(1).map(formatCommonName);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenHeader onBack={goBack} backLabel="Look up" title={title} subtitle={guide.scientificName} />

      <View style={styles.body}>
        {otherNames.length > 0 ? <Text style={styles.aka}>Also called {otherNames.join(", ")}</Text> : null}

        <CareCard care={care} units={units} hemisphere={hemisphere} toxicity={showToxicity ? "full" : "hidden"} />

        <Button
          label="Identify one of yours"
          icon="camera.fill"
          variant="secondary"
          onPress={() => router.push("/scan")}
          style={styles.scan}
        />
      </View>
    </ScrollView>
  );
}

const createStyles = (Colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.bg,
    },
    content: {
      paddingBottom: Spacing.extra,
    },
    body: {
      paddingHorizontal: Spacing.default,
    },
    aka: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      marginTop: -Spacing.tight,
      marginBottom: Spacing.default - 4,
    },
    scan: {
      marginTop: Spacing.loose,
    },
    centred: {
      flex: 1,
      justifyContent: "center",
      padding: Spacing.default,
    },
    stateCard: {
      alignItems: "center",
      gap: Spacing.tight,
      padding: Spacing.loose,
      borderRadius: Radius.xl,
      backgroundColor: Colors.card,
    },
    stateTitle: {
      ...Typography.headline,
      color: Colors.textPrimary,
      textAlign: "center",
      marginTop: Spacing.tight,
    },
    stateButton: {
      alignSelf: "stretch",
      marginTop: Spacing.default,
    },
  });
