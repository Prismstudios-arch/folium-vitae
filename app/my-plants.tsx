import { View, Text, StyleSheet, FlatList, Image, Pressable, TextInput, ActivityIndicator, Alert, ScrollView } from "react-native";
import { useMemo, useState, useCallback } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Radius, Shadow, Spacing, Tiles, Typography, type Palette } from "@constants/theme";
import { useColors, useThemedStyles } from "@hooks/useTheme";
import { Button } from "@components/Button";
import { Chip } from "@components/Chip";
import { Icon } from "@components/Icon";
import { IconTile } from "@components/ListGroup";
import { ScreenHeader, HeaderIconButton } from "@components/ScreenHeader";
import { useGoBack } from "@hooks/useGoBack";
import { usePlants } from "@hooks/usePlants";
import { cancelWateringReminder } from "@services/wateringReminders";
import { SavedPlant, getDisplayName, getMostRecentPhoto } from "@domain/plant";

type SortBy = "name" | "added" | "photographed";

const SORTS: Array<{ id: SortBy; label: string }> = [
  { id: "added", label: "Recently added" },
  { id: "name", label: "Name" },
  { id: "photographed", label: "Recently photographed" },
];

export default function MyPlantsScreen() {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const goBack = useGoBack("/");
  const { plants, loading, error, loadPlants, removePlant } = usePlants();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("added");

  // Refresh quietly on every visit — no full-screen spinner flashing on return.
  useFocusEffect(
    useCallback(() => {
      void loadPlants({ silent: true });
    }, [loadPlants])
  );

  const visible = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const matched = query
      ? plants.filter(
          (p) =>
            p.nickname?.toLowerCase().includes(query) ||
            p.scientificName.toLowerCase().includes(query) ||
            p.commonNames.some((n) => n.toLowerCase().includes(query))
        )
      : plants;

    const sorted = [...matched];
    switch (sortBy) {
      case "added":
        // Not acquisitionDate, which nothing sets: that made the order random.
        sorted.sort((a, b) => b.identificationDate.getTime() - a.identificationDate.getTime());
        break;
      case "photographed":
        sorted.sort(
          (a, b) => (getMostRecentPhoto(b)?.dateTaken.getTime() ?? 0) - (getMostRecentPhoto(a)?.dateTaken.getTime() ?? 0)
        );
        break;
      default:
        sorted.sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
    }
    return sorted;
  }, [plants, searchQuery, sortBy]);

  // Press and hold rather than a delete button on every photo.
  const handleLongPress = (plant: SavedPlant) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    Alert.alert(`Delete ${getDisplayName(plant)}?`, "This also removes its photos and watering history. It can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          removePlant(plant.id)
            .then(() => cancelWateringReminder(plant.id))
            .catch((err) => {
              console.error("Failed to delete plant:", err);
              Alert.alert("Couldn't delete", `${getDisplayName(plant)} is still in your collection.`);
            });
        },
      },
    ]);
  };

  const openPlant = (plant: SavedPlant) => router.push({ pathname: "/plant-detail", params: { id: plant.id } });

  const header = (
    <ScreenHeader
      onBack={goBack}
      backLabel="Home"
      title="My Plants"
      subtitle={plants.length > 0 ? `${plants.length} plant${plants.length === 1 ? "" : "s"}` : undefined}
      right={<HeaderIconButton icon="plus" label="Identify a plant" onPress={() => router.push("/scan")} />}
    />
  );

  if (loading && plants.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <ActivityIndicator size="large" color={Colors.brand} style={styles.loader} />
      </View>
    );
  }

  if ((error && plants.length === 0) || plants.length === 0) {
    const failed = Boolean(error);
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.stateCard}>
          <IconTile icon={failed ? "exclamationmark.triangle.fill" : "leaf.fill"} color={failed ? Tiles.amber : Tiles.green} size={56} />
          <Text style={styles.stateTitle}>{failed ? "Your plants didn't load" : "No plants yet"}</Text>
          <Text style={styles.stateBody}>
            {failed
              ? "They're still saved on this phone. Try again."
              : "Identify a plant and save it, and it'll live here with its watering log and photos."}
          </Text>
          <Button
            label={failed ? "Try again" : "Identify a plant"}
            icon={failed ? undefined : "camera.fill"}
            onPress={failed ? () => void loadPlants() : () => router.push("/scan")}
            style={styles.stateButton}
          />
        </View>
      </View>
    );
  }

  // DESIGN.md: lead with one large plant, then two columns.
  const [lead, ...rest] = visible;

  return (
    <FlatList
      style={styles.container}
      data={rest}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          {header}

          <View style={styles.search}>
            <Icon name="magnifyingglass" size={16} color={Colors.textSecondary} weight="semibold" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search your plants"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={Colors.textDisabled}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sorts}>
            {SORTS.map((sort) => (
              <Chip key={sort.id} label={sort.label} selected={sortBy === sort.id} onPress={() => setSortBy(sort.id)} />
            ))}
          </ScrollView>

          {lead ? (
            <PlantTile plant={lead} onPress={openPlant} onLongPress={handleLongPress} hero />
          ) : (
            <Text style={styles.noResults}>No plants match "{searchQuery.trim()}"</Text>
          )}
        </>
      }
      renderItem={({ item }) => <PlantTile plant={item} onPress={openPlant} onLongPress={handleLongPress} />}
      ListFooterComponent={visible.length > 0 ? <Text style={styles.hint}>Press and hold a plant to delete it.</Text> : null}
    />
  );
}

function PlantTile({
  plant,
  onPress,
  onLongPress,
  hero = false,
}: {
  plant: SavedPlant;
  onPress: (plant: SavedPlant) => void;
  onLongPress: (plant: SavedPlant) => void;
  hero?: boolean;
}) {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  const cover = getMostRecentPhoto(plant);
  // With a nickname showing, the second line says what the plant actually is.
  const secondary =
    plant.location ||
    (plant.nickname ? getDisplayName({ ...plant, nickname: undefined }) : null);

  return (
    <Pressable
      style={({ pressed }) => [styles.tile, hero ? styles.tileHero : styles.tileGrid, pressed && styles.pressed]}
      onPress={() => onPress(plant)}
      onLongPress={() => onLongPress(plant)}
      accessibilityRole="button"
      accessibilityLabel={getDisplayName(plant)}
      accessibilityHint="Press and hold to delete"
    >
      {cover ? (
        <Image source={{ uri: cover.imagePath }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient colors={[Colors.brandLit, Colors.brandDeep]} style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <Icon name="leaf.fill" size={hero ? 44 : 32} color="rgba(255,255,255,0.5)" />
        </LinearGradient>
      )}

      {/* A gradient fade for legibility over any photo (DESIGN.md). */}
      <LinearGradient colors={["transparent", "rgba(0, 0, 0, 0.65)"]} style={styles.fade} pointerEvents="none" />

      <View style={styles.label} pointerEvents="none">
        <Text style={[styles.name, hero && styles.nameHero]} numberOfLines={1}>
          {getDisplayName(plant)}
        </Text>
        {secondary ? (
          <Text style={styles.meta} numberOfLines={1}>
            {secondary}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const createStyles = (Colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.bg,
    },
    loader: {
      marginTop: Spacing.extra,
    },
    stateCard: {
      margin: Spacing.default,
      alignItems: "center",
      padding: Spacing.loose,
      borderRadius: Radius.xl,
      backgroundColor: Colors.card,
      gap: Spacing.tight,
    },
    stateTitle: {
      ...Typography.headline,
      color: Colors.textPrimary,
      textAlign: "center",
      marginTop: Spacing.tight,
    },
    stateBody: {
      ...Typography.body,
      lineHeight: 22,
      color: Colors.textSecondary,
      textAlign: "center",
    },
    stateButton: {
      alignSelf: "stretch",
      marginTop: Spacing.default,
    },
    listContent: {
      paddingBottom: Spacing.extra,
    },
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.tight,
      marginHorizontal: Spacing.default,
      paddingHorizontal: Spacing.default - 2,
      height: 46,
      borderRadius: Radius.md,
      backgroundColor: Colors.card,
    },
    searchInput: {
      flex: 1,
      ...Typography.bodyLarge,
      color: Colors.textPrimary,
      padding: 0,
    },
    sorts: {
      paddingHorizontal: Spacing.default,
      paddingVertical: Spacing.default - 4,
      gap: Spacing.tight,
    },
    noResults: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: "center",
      paddingVertical: Spacing.spacious,
    },
    gridRow: {
      paddingHorizontal: Spacing.default,
      gap: Spacing.default - 4,
      marginBottom: Spacing.default - 4,
    },
    tile: {
      borderRadius: Radius.lg,
      overflow: "hidden",
      backgroundColor: Colors.separator,
      justifyContent: "flex-end",
      ...Shadow.card,
    },
    tileHero: {
      height: 240,
      marginHorizontal: Spacing.default,
      marginBottom: Spacing.default - 4,
    },
    tileGrid: {
      flex: 1,
      aspectRatio: 0.8,
    },
    pressed: {
      transform: [{ scale: 0.98 }],
    },
    placeholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    fade: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "55%",
    },
    label: {
      padding: Spacing.default - 2,
    },
    name: {
      ...Typography.subheadline,
      color: "#FFFFFF",
    },
    nameHero: {
      ...Typography.display,
      color: "#FFFFFF",
    },
    meta: {
      ...Typography.caption1,
      color: "rgba(255, 255, 255, 0.85)",
      marginTop: 1,
    },
    hint: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      textAlign: "center",
      marginTop: Spacing.tight,
    },
  });
