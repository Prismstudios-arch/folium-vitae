import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { useCallback, useState } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Icon } from "@components/Icon";
import { HeaderIconButton } from "@components/ScreenHeader";
import { usePlants } from "@hooks/usePlants";
import { getApiClient, QuotaState } from "@services/apiClient";
import { summariseWatering } from "@services/wateringInsights";
import { SavedPlant, getDisplayName, getMostRecentPhoto } from "@domain/plant";

/**
 * Home.
 *
 * This was a title, two buttons and a slogan. It now answers the three
 * things someone opening a plant app wants: identify something, how many
 * identifications are left, and which of their plants might need attention.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { plants, loadPlants } = usePlants();
  const [quota, setQuota] = useState<QuotaState | null>(null);

  useFocusEffect(
    useCallback(() => {
      void loadPlants({ silent: true });

      getApiClient()
        .getQuota()
        .then(setQuota)
        .catch(() => setQuota(null)); // Offline: the line is simply left out.
    }, [loadPlants])
  );

  const recent = [...plants]
    .sort((a, b) => b.identificationDate.getTime() - a.identificationDate.getTime())
    .slice(0, 8);

  // "Probably due" only where the user's own history supports it — at least
  // two waterings, and longer since the last than their usual gap.
  const due = plants
    .map((plant) => ({ plant, rhythm: summariseWatering(plant.waterLogs) }))
    .filter(
      ({ rhythm }) => rhythm !== null && rhythm.medianDays >= 1 && rhythm.daysSinceLast >= rhythm.medianDays
    )
    .slice(0, 3);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <Image
            source={require("../assets/brand-mark.png")}
            style={styles.brandMark}
            accessibilityIgnoresInvertColors
          />
          <Text style={styles.brandName}>Sorrel</Text>
        </View>
        <HeaderIconButton icon="gearshape.fill" label="Settings" onPress={() => router.push("/settings")} />
      </View>

      <TouchableOpacity
        style={styles.hero}
        onPress={() => router.push("/scan")}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Identify a plant"
      >
        <View style={styles.heroIcon}>
          <Icon name="camera.viewfinder" size={30} color="#FFFFFF" />
        </View>
        <Text style={styles.heroTitle}>Identify a plant</Text>
        <Text style={styles.heroBody}>One clear photo. We'll show you how sure we are.</Text>
      </TouchableOpacity>

      <QuotaLine quota={quota} onPremium={() => router.push("/subscription")} />

      {due.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Probably due a check</Text>
          {due.map(({ plant, rhythm }) => (
            <TouchableOpacity
              key={plant.id}
              style={styles.dueRow}
              onPress={() =>
                router.push({
                  pathname: "/water-log",
                  params: { plantId: plant.id, plantName: getDisplayName(plant) },
                })
              }
              accessibilityRole="button"
            >
              <View style={styles.dueIcon}>
                <Icon name="drop.fill" size={18} />
              </View>
              <View style={styles.dueText}>
                <Text style={styles.dueName}>{getDisplayName(plant)}</Text>
                <Text style={styles.dueMeta}>
                  Last watered {rhythm!.daysSinceLast} days ago · you usually leave it{" "}
                  {rhythm!.medianDays === 1 ? "a day" : `${rhythm!.medianDays} days`}
                </Text>
              </View>
              <Icon name="chevron.right" size={14} color={Colors.textDisabled} weight="semibold" />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your plants</Text>
          {plants.length > 0 ? (
            <TouchableOpacity
              onPress={() => router.push("/my-plants")}
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.link}>See all</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {recent.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="leaf" size={26} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>
              Plants you identify and save will appear here, with their watering and photos.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
          >
            {recent.map((plant) => (
              <PlantThumb
                key={plant.id}
                plant={plant}
                onPress={() => router.push({ pathname: "/plant-detail", params: { id: plant.id } })}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}

function QuotaLine({ quota, onPremium }: { quota: QuotaState | null; onPremium: () => void }) {
  if (!quota) return null;

  if (quota.plan !== "free") {
    return (
      <View style={styles.quota}>
        <Icon name="crown.fill" size={14} color={Colors.probably} />
        <Text style={styles.quotaText}>Premium — unlimited identifications</Text>
      </View>
    );
  }

  if (quota.remaining === 0) {
    return (
      <TouchableOpacity style={styles.quota} onPress={onPremium} accessibilityRole="button">
        <Text style={styles.quotaText}>
          You've used today's {quota.limit} identifications. They reset at 00:00 UTC.{" "}
          <Text style={styles.link}>See Premium</Text>
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.quota}>
      <Text style={styles.quotaText}>
        {quota.remaining} of {quota.limit} identifications left today
      </Text>
    </View>
  );
}

function PlantThumb({ plant, onPress }: { plant: SavedPlant; onPress: () => void }) {
  const photo = getMostRecentPhoto(plant);

  return (
    <TouchableOpacity style={styles.thumb} onPress={onPress} accessibilityRole="button">
      {photo ? (
        <Image source={{ uri: photo.imagePath }} style={styles.thumbImage} />
      ) : (
        <View style={[styles.thumbImage, styles.thumbPlaceholder]}>
          <Icon name="leaf.fill" size={28} color={Colors.leafLight} />
        </View>
      )}
      <Text style={styles.thumbName} numberOfLines={1}>
        {getDisplayName(plant)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: Spacing.extra,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.default,
    paddingTop: Spacing.tight,
    paddingBottom: Spacing.default,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.tight,
  },
  brandMark: {
    width: 32,
    height: 32,
  },
  brandName: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  hero: {
    marginHorizontal: Spacing.default,
    backgroundColor: Colors.leaf,
    borderRadius: 22,
    padding: Spacing.loose,
    paddingTop: Spacing.spacious,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.loose,
  },
  heroTitle: {
    ...Typography.display,
    color: "#FFFFFF",
  },
  heroBody: {
    ...Typography.body,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: Spacing.compact,
  },
  quota: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.tight,
    marginHorizontal: Spacing.default,
    marginTop: Spacing.default,
    paddingHorizontal: Spacing.tight,
  },
  quotaText: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  section: {
    marginTop: Spacing.spacious,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingRight: Spacing.default,
  },
  sectionTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.default,
    marginBottom: Spacing.default,
  },
  link: {
    ...Typography.bodyLarge,
    color: Colors.leaf,
    fontWeight: "600",
  },
  dueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.default,
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.default,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.glass,
  },
  dueIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(45, 88, 66, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  dueText: {
    flex: 1,
  },
  dueName: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
  },
  dueMeta: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  empty: {
    marginHorizontal: Spacing.default,
    padding: Spacing.loose,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.glass,
    alignItems: "center",
    gap: Spacing.tight,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  strip: {
    paddingHorizontal: Spacing.default,
    gap: Spacing.default,
  },
  thumb: {
    width: 128,
  },
  thumbImage: {
    width: 128,
    height: 160,
    borderRadius: 14,
    backgroundColor: Colors.glass,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  thumbName: {
    ...Typography.caption1,
    color: Colors.textPrimary,
    marginTop: Spacing.tight,
  },
});
