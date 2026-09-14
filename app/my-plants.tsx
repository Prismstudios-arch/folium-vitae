import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useMemo, useState, useCallback } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { Icon } from "@components/Icon";
import { ScreenHeader, HeaderIconButton } from "@components/ScreenHeader";
import { useGoBack } from "@hooks/useGoBack";
import { usePlants } from "@hooks/usePlants";
import { cancelWateringReminder } from "@services/wateringReminders";
import { SavedPlant, getDisplayName, getMostRecentPhoto } from "@domain/plant";

type SortBy = "name" | "added" | "photographed";

const SORTS: Array<{ id: SortBy; label: string }> = [
  { id: "name", label: "Name" },
  { id: "added", label: "Recently added" },
  { id: "photographed", label: "Recently photographed" },
];

export default function MyPlantsScreen() {
  const router = useRouter();
  const goBack = useGoBack("/");
  const { plants, loading, error, loadPlants, removePlant } = usePlants();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("added");

  // Refresh on every visit, quietly. The hook already loads on mount; this
  // used to load a second time and flash a full-screen spinner every time
  // you came back from a plant.
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
        // "Added" sorted by acquisitionDate, which nothing ever sets — so
        // every comparison was between two fresh new Date() calls and the
        // order came out effectively random.
        sorted.sort((a, b) => b.identificationDate.getTime() - a.identificationDate.getTime());
        break;
      case "photographed":
        sorted.sort(
          (a, b) =>
            (getMostRecentPhoto(b)?.dateTaken.getTime() ?? 0) -
            (getMostRecentPhoto(a)?.dateTaken.getTime() ?? 0)
        );
        break;
      default:
        sorted.sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
    }
    return sorted;
  }, [plants, searchQuery, sortBy]);

  // Press and hold, rather than a red × on every photo: the grid is for
  // looking at plants, and a delete button on each tile invited mis-taps.
  const handleLongPress = (plant: SavedPlant) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    Alert.alert(
      `Delete ${getDisplayName(plant)}?`,
      "This also removes its photos and watering history. It can't be undone.",
      [
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
      ]
    );
  };

  const openPlant = (plant: SavedPlant) =>
    router.push({ pathname: "/plant-detail", params: { id: plant.id } });

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
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={Colors.leaf} />
        </View>
      </View>
    );
  }

  if (error && plants.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centred}>
          <Text style={styles.stateTitle}>Your plants didn't load</Text>
          <Text style={styles.stateBody}>They're still saved on this phone. Try again.</Text>
          <Button label="Try again" onPress={() => void loadPlants()} style={styles.stateButton} />
        </View>
      </View>
    );
  }

  if (plants.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centred}>
          <View style={styles.emptyIcon}>
            <Icon name="leaf.fill" size={30} />
          </View>
          <Text style={styles.stateTitle}>No plants yet</Text>
          <Text style={styles.stateBody}>
            Identify a plant and save it, and it'll live here with its watering log and photos.
          </Text>
          <Button label="Identify a plant" onPress={() => router.push("/scan")} style={styles.stateButton} />
        </View>
      </View>
    );
  }

  // The lead plant gets the full width, the rest a two-column grid beneath
  // it (DESIGN.md: "lead with a large hero card, then 2 columns").
  const [lead, ...rest] = visible;

  return (
    <View style={styles.container}>
      <FlatList
        data={rest}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {header}

            <View style={styles.search}>
              <Icon name="magnifyingglass" size={16} color={Colors.textSecondary} />
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

            <FlatList
              horizontal
              data={SORTS}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sorts}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.sort, sortBy === item.id && styles.sortActive]}
                  onPress={() => setSortBy(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sortBy === item.id }}
                >
                  <Text style={[styles.sortText, sortBy === item.id && styles.sortTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />

            {lead ? (
              <PlantTile plant={lead} onPress={openPlant} onLongPress={handleLongPress} hero />
            ) : (
              <Text style={styles.noResults}>No plants match "{searchQuery.trim()}"</Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <PlantTile plant={item} onPress={openPlant} onLongPress={handleLongPress} />
        )}
        ListFooterComponent={
          visible.length > 0 ? (
            <Text style={styles.hint}>Press and hold a plant to delete it.</Text>
          ) : null
        }
      />
    </View>
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
  const cover = getMostRecentPhoto(plant);

  return (
    <TouchableOpacity
      style={[styles.tile, hero ? styles.tileHero : styles.tileGrid]}
      onPress={() => onPress(plant)}
      onLongPress={() => onLongPress(plant)}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={getDisplayName(plant)}
      accessibilityHint="Press and hold to delete"
    >
      {cover ? (
        <Image source={{ uri: cover.imagePath }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.tilePlaceholder]}>
          <Icon name="leaf.fill" size={hero ? 40 : 30} color={Colors.leafLight} />
        </View>
      )}

      {/* A gradient fade for legibility over any photo, as DESIGN.md
          specifies — not a grey band across the bottom. */}
      <LinearGradient
        colors={["transparent", "rgba(0, 0, 0, 0.62)"]}
        style={styles.tileFade}
        pointerEvents="none"
      />

      <View style={styles.tileLabel} pointerEvents="none">
        <Text style={[styles.tileName, hero && styles.tileNameHero]} numberOfLines={1}>
          {getDisplayName(plant)}
        </Text>
        {plant.location ? (
          <Text style={styles.tileMeta} numberOfLines={1}>
            {plant.location}
          </Text>
        ) : plant.nickname ? (
          <Text style={styles.tileMeta} numberOfLines={1}>
            {plant.commonNames[0] ?? plant.scientificName}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centred: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.loose,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(45, 88, 66, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.loose,
  },
  stateTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  stateBody: {
    ...Typography.body,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.tight,
  },
  stateButton: {
    alignSelf: "stretch",
    marginTop: Spacing.spacious,
  },
  listContent: {
    paddingBottom: Spacing.extra,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.tight,
    marginHorizontal: Spacing.default,
    paddingHorizontal: Spacing.default,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glass,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    padding: 0,
  },
  sorts: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.default,
    gap: Spacing.tight,
  },
  sort: {
    paddingHorizontal: Spacing.default,
    minHeight: 34,
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glass,
  },
  sortActive: {
    backgroundColor: Colors.leaf,
    borderColor: Colors.leaf,
  },
  sortText: {
    ...Typography.caption1,
    color: Colors.textSecondary,
  },
  sortTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  noResults: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingVertical: Spacing.spacious,
  },
  gridRow: {
    paddingHorizontal: Spacing.default,
    gap: Spacing.default,
    marginBottom: Spacing.default,
  },
  tile: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.glass,
    justifyContent: "flex-end",
  },
  tileHero: {
    height: 220,
    marginHorizontal: Spacing.default,
    marginBottom: Spacing.default,
  },
  tileGrid: {
    flex: 1,
    aspectRatio: 0.8,
  },
  tilePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  tileFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
  },
  tileLabel: {
    padding: Spacing.default,
  },
  tileName: {
    ...Typography.subheadline,
    color: "#FFFFFF",
  },
  tileNameHero: {
    ...Typography.headline,
    color: "#FFFFFF",
  },
  tileMeta: {
    ...Typography.caption1,
    color: "rgba(255, 255, 255, 0.82)",
    marginTop: 2,
  },
  hint: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.tight,
  },
});
