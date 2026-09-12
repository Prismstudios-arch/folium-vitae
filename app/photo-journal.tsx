import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { useState, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";

interface PlantPhoto {
  id: string;
  url: string;
  thumbnailUrl: string;
  caption: string;
  date: string;
  uploadedAt: string;
}

const { width } = Dimensions.get("window");
const PHOTO_SIZE = (width - Spacing.default * 3) / 2;

export default function PhotoJournalScreen() {
  const router = useRouter();
  const { plantId, plantName } = useLocalSearchParams();
  const [photos, setPhotos] = useState<PlantPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      // TODO: Load from backend API
      const mockPhotos: PlantPhoto[] = [
        {
          id: "photo-1",
          url: "https://via.placeholder.com/400x300",
          thumbnailUrl: "https://via.placeholder.com/100x100",
          caption: "First photo - just got it",
          date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          uploadedAt: new Date().toISOString(),
        },
      ];
      setPhotos(mockPhotos);
    } catch (error) {
      Alert.alert("Error", "Failed to load photos");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const image = result.assets[0];

        // Show caption input dialog
        promptCaption((caption) => {
          uploadPhoto(image.uri, caption);
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const promptCaption = (onCaption: (caption: string) => void) => {
    let caption = "";

    Alert.prompt(
      "Photo Caption",
      "Add a note about this photo (optional)",
      [
        {
          text: "Skip",
          onPress: () => onCaption(""),
          style: "cancel",
        },
        {
          text: "Add",
          onPress: () => onCaption(caption),
        },
      ],
      "plain-text",
      ""
    );
  };

  const uploadPhoto = async (uri: string, caption: string) => {
    setUploading(true);
    try {
      // TODO: Upload to backend
      // For now, add to local state
      const newPhoto: PlantPhoto = {
        id: "photo-" + Date.now(),
        url: uri,
        thumbnailUrl: uri,
        caption: caption || "Photo from " + new Date().toLocaleDateString(),
        date: new Date().toISOString(),
        uploadedAt: new Date().toISOString(),
      };

      setPhotos([newPhoto, ...photos]);
      Alert.alert("Success", "Photo added to your plant's journal");
    } catch (error) {
      Alert.alert("Error", "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    Alert.alert("Delete Photo", "Are you sure you want to delete this photo?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        onPress: () => {
          // TODO: Delete from backend
          setPhotos(photos.filter((p) => p.id !== photoId));
        },
        style: "destructive",
      },
    ]);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.leaf} style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Photo Journal</Text>
        <Text style={styles.plantName}>{plantName}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {photos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📸</Text>
            <Text style={styles.emptyTitle}>No photos yet</Text>
            <Text style={styles.emptyText}>
              Start building a visual history of your plant. Track its growth over time!
            </Text>
          </View>
        ) : (
          <FlatList
            data={photos}
            numColumns={2}
            columnWrapperStyle={styles.row}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.photoCard}
                onLongPress={() => handleDeletePhoto(item.id)}
              >
                <Image
                  source={{ uri: item.thumbnailUrl }}
                  style={styles.photoImage}
                  onError={() => console.log("Image load error")}
                />
                <View style={styles.photoInfo}>
                  <Text style={styles.photoDate}>{formatDate(item.date)}</Text>
                  {item.caption && (
                    <Text style={styles.photoCaption} numberOfLines={2}>
                      {item.caption}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Add Photo"
          onPress={handleAddPhoto}
          disabled={uploading}
        />
      </View>

      {uploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator size="large" color={Colors.leaf} />
          <Text style={styles.uploadingText}>Uploading photo...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: Spacing.default,
    paddingTop: Spacing.default,
    paddingBottom: Spacing.loose,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass,
  },
  backButton: {
    fontSize: Typography.body.fontSize,
    color: Colors.leaf,
    fontWeight: "600" as any,
    marginBottom: Spacing.compact,
  },
  title: {
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  plantName: {
    fontSize: Typography.subheadline.fontSize,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.compact,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: Spacing.default,
  },
  photoCard: {
    width: PHOTO_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.glass,
  },
  photoImage: {
    width: "100%",
    height: PHOTO_SIZE,
    backgroundColor: Colors.glass,
  },
  photoInfo: {
    padding: Spacing.compact,
    backgroundColor: Colors.background,
  },
  photoDate: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    fontWeight: "600" as any,
    marginBottom: Spacing.compact,
  },
  photoCaption: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textPrimary,
    lineHeight: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.spacious,
    marginTop: Spacing.spacious,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: Spacing.default,
  },
  emptyTitle: {
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  emptyText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: Spacing.default,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: Spacing.default,
    paddingBottom: Spacing.spacious,
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadingText: {
    marginTop: Spacing.default,
    fontSize: Typography.body.fontSize,
    color: "#FFFFFF",
  },
});
