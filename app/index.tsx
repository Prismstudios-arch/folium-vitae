import { View, Text, StyleSheet, ScrollView, Pressable, Image } from "react-native";
import { useCallback, useState } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import type { SFSymbol } from "expo-symbols";
import { Radius, Shadow, Spacing, Tiles, Typography, type Palette } from "@constants/theme";
import { useColors, useThemedStyles } from "@hooks/useTheme";
import { Button } from "@components/Button";
import { HeroCard } from "@components/HeroCard";
import { Icon } from "@components/Icon";
import { ListGroup, ListRow, IconTile } from "@components/ListGroup";
import { HeaderIconButton } from "@components/ScreenHeader";
import { usePlants } from "@hooks/usePlants";
import { getApiClient, QuotaState } from "@services/apiClient";
import { summariseWatering } from "@services/wateringInsights";
import { SavedPlant, getDisplayName, getMostRecentPhoto } from "@domain/plant";

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Home: identify something, see how many identifications are left, and see
 * which plants might need attention — the three things someone opening a
 * plant app wants.
 */
export default function HomeScreen() {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
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
    .slice(0, 10);

  // "Probably due" only where the user's own history supports it — at least
  // two waterings, and longer since the last than their usual gap.
  const due = plants
    .map((plant) => ({ plant, rhythm: summariseWatering(plant.waterLogs) }))
    .filter(
      ({ rhythm }) => rhythm !== null && rhythm.medianDays >= 1 && rhythm.daysSinceLast >= rhythm.medianDays
    );

  const photoCount = plants.reduce((sum, plant) => sum + plant.photos.length, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <Image source={require("../assets/brand-mark.png")} style={styles.brandMark} accessibilityIgnoresInvertColors />
          <Text style={styles.brandName}>Sorrel</Text>
        </View>
        <HeaderIconButton icon="gearshape.fill" label="Settings" onPress={() => router.push("/settings")} />
      </View>

      <Text style={styles.greeting} accessibilityRole="header">
        {greeting()}
      </Text>

      <HeroCard style={styles.hero}>
        <Text style={styles.heroOverline}>Identify</Text>
        <Text style={styles.heroTitle}>What plant{"\n"}is this?</Text>
        <Text style={styles.heroBody}>Point your camera at any plant.</Text>

        <Pressable
          onPress={() => router.push("/scan")}
          style={({ pressed }) => [styles.heroButton, pressed && styles.heroButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Scan a plant"
        >
          <Icon name="camera.fill" size={17} color={Colors.brandDeep} weight="semibold" />
          <Text style={styles.heroButtonText}>Scan a plant</Text>
        </Pressable>

        <QuotaLine quota={quota} />
      </HeroCard>

      {plants.length > 0 ? (
        <View style={styles.stats}>
          <Stat icon="leaf.fill" color={Tiles.green} value={plants.length} label={plants.length === 1 ? "Plant" : "Plants"} />
          <Stat icon="drop.fill" color={Tiles.blue} value={due.length} label="Due a check" />
          <Stat icon="photo.stack" color={Tiles.purple} value={photoCount} label={photoCount === 1 ? "Photo" : "Photos"} />
        </View>
      ) : null}

      {due.length > 0 ? (
        <ListGroup title="Probably due a check" style={styles.group}>
          {due.slice(0, 4).map(({ plant, rhythm }) => (
            <ListRow
              key={plant.id}
              icon="drop.fill"
              tint={Tiles.blue}
              title={getDisplayName(plant)}
              subtitle={`Watered ${rhythm!.daysSinceLast} days ago · usually every ${rhythm!.medianDays === 1 ? "day" : `${rhythm!.medianDays} days`}`}
              onPress={() =>
                router.push({
                  pathname: "/water-log",
                  params: { plantId: plant.id, plantName: getDisplayName(plant) },
                })
              }
            />
          ))}
        </ListGroup>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your plants</Text>
        {plants.length > 0 ? (
          <Pressable onPress={() => router.push("/my-plants")} hitSlop={10} accessibilityRole="button">
            <Text style={styles.link}>See all</Text>
          </Pressable>
        ) : null}
      </View>

      {recent.length === 0 ? (
        <View style={styles.emptyCard}>
          <IconTile icon="leaf.fill" color={Tiles.green} size={44} />
          <Text style={styles.emptyTitle}>Start your collection</Text>
          <Text style={styles.emptyBody}>
            Identify a plant and save it. Its watering log, reminders and photos will live here.
          </Text>
          <Button label="Scan your first plant" variant="secondary" icon="camera.fill" onPress={() => router.push("/scan")} style={styles.emptyButton} />
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
          {recent.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              onPress={() => router.push({ pathname: "/plant-detail", params: { id: plant.id } })}
            />
          ))}
        </ScrollView>
      )}

      <ListGroup title="Tools" style={styles.toolsGroup}>
        <ListRow
          icon="stethoscope"
          tint={Tiles.teal}
          title="Check a plant's health"
          subtitle="Photograph a leaf that looks wrong"
          onPress={() => router.push("/disease-detection")}
        />
        <ListRow
          icon="magnifyingglass"
          tint={Tiles.blue}
          title="Look up a plant"
          subtitle="Care notes, without scanning"
          onPress={() => router.push("/plant-lookup")}
        />
        <ListRow
          icon="square.grid.2x2.fill"
          tint={Tiles.green}
          title="My Plants"
          subtitle={plants.length === 0 ? "Nothing saved yet" : `${plants.length} saved`}
          onPress={() => router.push("/my-plants")}
        />
      </ListGroup>
    </ScrollView>
  );
}

function QuotaLine({ quota }: { quota: QuotaState | null }) {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  if (!quota) return null;

  const text =
    quota.plan !== "free"
      ? "Premium · unlimited identifications"
      : quota.remaining === 0
        ? `Today's ${quota.limit} identifications are used · they reset at 00:00 UTC`
        : `${quota.remaining} of ${quota.limit} identifications left today`;

  return (
    <View style={styles.quota}>
      <Icon name={quota.plan !== "free" ? "crown.fill" : "sparkles"} size={12} color={Colors.brandBright} />
      <Text style={styles.quotaText}>{text}</Text>
    </View>
  );
}

function Stat({ icon, color, value, label }: { icon: SFSymbol; color: string; value: number; label: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.stat}>
      <IconTile icon={icon} color={color} size={28} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PlantCard({ plant, onPress }: { plant: SavedPlant; onPress: () => void }) {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  const photo = getMostRecentPhoto(plant);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.plantCard, pressed && styles.plantCardPressed]}
      accessibilityRole="button"
      accessibilityLabel={getDisplayName(plant)}
    >
      {photo ? (
        <Image source={{ uri: photo.imagePath }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.plantCardPlaceholder]}>
          <Icon name="leaf.fill" size={34} color={Colors.leafLight} />
        </View>
      )}
      <LinearGradient colors={["transparent", "rgba(0, 0, 0, 0.65)"]} style={styles.plantCardFade} pointerEvents="none" />
      <Text style={styles.plantCardName} numberOfLines={2}>
        {getDisplayName(plant)}
      </Text>
    </Pressable>
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
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.default,
      paddingTop: Spacing.tight,
    },
    brand: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.tight,
    },
    brandMark: {
      width: 30,
      height: 30,
    },
    brandName: {
      ...Typography.subheadline,
      color: Colors.textPrimary,
    },
    greeting: {
      ...Typography.displayLarge,
      color: Colors.textPrimary,
      paddingHorizontal: Spacing.default,
      marginTop: Spacing.default,
      marginBottom: Spacing.default,
    },
    hero: {
      marginHorizontal: Spacing.default,
    },
    heroOverline: {
      ...Typography.overline,
      color: Colors.brandBright,
    },
    heroTitle: {
      fontSize: 32,
      lineHeight: 37,
      fontWeight: "800",
      letterSpacing: -0.3,
      color: "#FFFFFF",
      marginTop: Spacing.compact,
    },
    heroBody: {
      ...Typography.body,
      color: "rgba(255, 255, 255, 0.8)",
      marginTop: Spacing.tight,
    },
    heroButton: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: Spacing.tight,
      marginTop: Spacing.loose,
      paddingHorizontal: Spacing.loose,
      height: 50,
      borderRadius: Radius.pill,
      backgroundColor: "#FFFFFF",
    },
    heroButtonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.98 }],
    },
    heroButtonText: {
      ...Typography.button,
      color: Colors.brandDeep,
    },
    quota: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: Spacing.default,
      maxWidth: "70%",
    },
    quotaText: {
      ...Typography.caption2,
      color: "rgba(255, 255, 255, 0.75)",
      flexShrink: 1,
    },
    stats: {
      flexDirection: "row",
      gap: Spacing.tight + 2,
      marginHorizontal: Spacing.default,
      marginTop: Spacing.default,
    },
    stat: {
      flex: 1,
      padding: Spacing.default - 2,
      borderRadius: Radius.lg,
      backgroundColor: Colors.card,
      gap: 6,
    },
    statValue: {
      ...Typography.headline,
      color: Colors.textPrimary,
      fontVariant: ["tabular-nums"],
      marginTop: 2,
    },
    statLabel: {
      ...Typography.caption2,
      color: Colors.textSecondary,
    },
    group: {
      marginTop: Spacing.loose,
      marginBottom: 0,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.default,
      marginTop: Spacing.spacious,
      marginBottom: Spacing.default - 4,
    },
    sectionTitle: {
      ...Typography.headline,
      color: Colors.textPrimary,
    },
    link: {
      ...Typography.bodyLarge,
      color: Colors.brand,
      fontWeight: "600",
    },
    emptyCard: {
      marginHorizontal: Spacing.default,
      padding: Spacing.loose,
      borderRadius: Radius.lg,
      backgroundColor: Colors.card,
      alignItems: "center",
      gap: Spacing.tight,
    },
    emptyTitle: {
      ...Typography.subheadline,
      color: Colors.textPrimary,
      marginTop: Spacing.tight,
    },
    emptyBody: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      textAlign: "center",
    },
    emptyButton: {
      alignSelf: "stretch",
      marginTop: Spacing.tight,
    },
    carousel: {
      paddingHorizontal: Spacing.default,
      gap: Spacing.default - 4,
    },
    plantCard: {
      width: 148,
      height: 196,
      borderRadius: Radius.lg,
      overflow: "hidden",
      backgroundColor: Colors.separator,
      justifyContent: "flex-end",
      ...Shadow.card,
    },
    plantCardPressed: {
      transform: [{ scale: 0.98 }],
    },
    plantCardPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.brandTint,
    },
    plantCardFade: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "55%",
    },
    plantCardName: {
      ...Typography.subheadline,
      color: "#FFFFFF",
      padding: Spacing.default - 4,
    },
    toolsGroup: {
      marginTop: Spacing.spacious,
      marginBottom: 0,
    },
  });
