import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { usePlants } from "@hooks/usePlants";
import { SavedPlant, getDisplayName, getMostRecentPhoto } from "@domain/plant";

type SortBy = "name" | "date" | "recent";

export default function MyPlantsScreen() {
  const router = useRouter();
  const { plants, loading, error, loadPlants, removePlant } = usePlants();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [filteredPlants, setFilteredPlants] = useState<SavedPlant[]>([]);

  useEffect(() => {
    loadPlants();
  }, []);

  // Filter and sort plants
  useEffect(() => {
    let result = plants;

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.nickname?.toLowerCase().includes(query) ||
          p.scientificName.toLowerCase().includes(query) ||
          p.commonNames.some((n) => n.toLowerCase().includes(query))
      );
    }

    // Sort
    switch (sortBy) {
      case "date":
        result = [...result].sort((a, b) => {
          const dateA = a.acquisitionDate || new Date();
          const dateB = b.acquisitionDate || new Date();
          return dateB.getTime() - dateA.getTime();
        });
        break;
      case "recent":
        result = [...result].sort((a, b) => {
          const photoA = getMostRecentPhoto(a)?.dateTaken || new Date(0);
          const photoB = getMostRecentPhoto(b)?.dateTaken || new Date(0);
          return photoB.getTime() - photoA.getTime();
        });
        break;
      case "name":
      default:
        result = [...result].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
    }

    setFilteredPlants(result);
  }, [plants, searchQuery, sortBy]);

  const handleDelete = (plant: SavedPlant) => {
    removePlant(plant.id).catch((err) => {
      console.error("Failed to delete plant:", err);
    });
  };

  const handlePlantPress = (plant: SavedPlant) => {
    router.push({
      pathname: "/plant-detail",
      params: { id: plant.id },
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.leaf} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error.message}</Text>
        <Button label="Try Again" onPress={loadPlants} style={styles.marginTop} />
      </View>
    );
  }

  if (plants.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🌱</Text>
        <Text style={styles.emptyTitle}>No plants yet</Text>
        <Text style={styles.emptySubtitle}>Scan your first plant to get started</Text>
        <Button label="Scan a Plant" onPress={() => router.push("/scan")} style={styles.marginTop} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Plants</Text>
        <Text style={styles.count}>{filteredPlants.length} plant{filteredPlants.length !== 1 ? "s" : ""}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search plants..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={Colors.textDisabled}
        />
      </View>

      {/* Sort Buttons */}
      <View style={styles.sortContainer}>
        <SortButton label="Name" active={sortBy === "name"} onPress={() => setSortBy("name")} />
        <SortButton label="Added" active={sortBy === "date"} onPress={() => setSortBy("date")} />
        <SortButton label="Recent" active={sortBy === "recent"} onPress={() => setSortBy("recent")} />
      </View>

      {/* Grid */}
      {filteredPlants.length === 0 ? (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>No plants match "{searchQuery}"</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPlants}
          renderItem={({ item }) => <PlantGridItem plant={item} onPress={handlePlantPress} onDelete={handleDelete} />}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          scrollEnabled={true}
          contentContainerStyle={styles.gridContainer}
        />
      )}

      {/* Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/scan")}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

interface PlantGridItemProps {
  plant: SavedPlant;
  onPress: (plant: SavedPlant) => void;
  onDelete: (plant: SavedPlant) => void;
}

function PlantGridItem({ plant, onPress, onDelete }: PlantGridItemProps) {
  const coverPhoto = getMostRecentPhoto(plant);

  return (
    <TouchableOpacity style={styles.gridItem} onPress={() => onPress(plant)}>
      {coverPhoto ? (
        <Image
          source={{ uri: `file://${coverPhoto.imagePath}` }}
          style={styles.gridImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.gridImage, styles.noImage]}>
          <Text style={styles.noImageIcon}>🌿</Text>
        </View>
      )}

      {/* Overlay */}
      <View style={styles.overlay}>
        <Text style={styles.plantName}>{getDisplayName(plant)}</Text>
        {plant.location && <Text style={styles.location}>{plant.location}</Text>}
      </View>

      {/* Delete Button */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(plant)}
        activeOpacity={0.7}
      >
        <Text style={styles.deleteButtonText}>×</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

interface SortButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function SortButton({ label, active, onPress }: SortButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.sortButton, active && styles.sortButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.sortButtonText, active && styles.sortButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: Spacing.default,
  },
  emptyTitle: {
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.tight,
  },
  emptySubtitle: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    marginBottom: Spacing.spacious,
  },
  header: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.default,
  },
  title: {
    fontSize: Typography.display.fontSize,
    fontWeight: Typography.display.fontWeight as any,
    color: Colors.textPrimary,
  },
  count: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    marginTop: Spacing.compact,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.default,
    marginBottom: Spacing.default,
    paddingHorizontal: Spacing.default,
    backgroundColor: Colors.glass,
    borderRadius: 8,
    height: 44,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: Spacing.tight,
    color: Colors.textSecondary,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    padding: 0,
  },
  sortContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.default,
    marginBottom: Spacing.default,
    gap: Spacing.tight,
  },
  sortButton: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.compact,
    borderRadius: 16,
    backgroundColor: Colors.glass,
  },
  sortButtonActive: {
    backgroundColor: Colors.leaf,
  },
  sortButtonText: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
  },
  sortButtonTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  gridContainer: {
    paddingHorizontal: Spacing.compact,
    paddingBottom: Spacing.spacious,
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: Spacing.default,
  },
  gridItem: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: Colors.glass,
    position: "relative",
  },
  gridImage: {
    width: "100%",
    height: "100%",
    backgroundColor: Colors.glass,
  },
  noImage: {
    justifyContent: "center",
    alignItems: "center",
  },
  noImageIcon: {
    fontSize: 32,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.tight,
    paddingVertical: Spacing.tight,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  plantName: {
    fontSize: Typography.caption1.fontSize,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  location: {
    fontSize: Typography.caption2.fontSize,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: Spacing.compact,
  },
  deleteButton: {
    position: "absolute",
    top: Spacing.tight,
    right: Spacing.tight,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.error,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 24,
    color: "#FFFFFF",
    fontWeight: "300",
  },
  fab: {
    position: "absolute",
    bottom: Spacing.default,
    right: Spacing.default,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.leaf,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  fabText: {
    fontSize: 36,
    color: "#FFFFFF",
    marginTop: -2,
  },
  noResults: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noResultsText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: Typography.body.fontSize,
    color: Colors.error,
    textAlign: "center",
  },
  marginTop: {
    marginTop: Spacing.spacious,
  },
});
