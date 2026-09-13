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
  Platform,
} from "react-native";
import { useState, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { PlantPhoto } from "@domain/plant";
import { fetchPhotos, addPhoto, deletePhoto } from "@services/database";
import { hashImage } from "@services/capture";

const { width } = Dimensions.get("window");
const PHOTO_SIZE = (width - Spacing.default * 3) / 2;

export default function PhotoJournalScreen() {
  const router = useRouter();
  const { plantId, plantName } = useLocalSearchParams<{
    plantId: string;
    plantName?: string;
  }>();

  const [photos, setPhotos] = useState<PlantPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    void loadPhotos();
  }, [plantId]);

  const loadPhotos = async () => {
    if (!plantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setPhotos(await fetchPhotos(plantId));
    } catch (error) {
      console.error("Failed to load photos:", error);
      Alert.alert("Couldn't load photos", "Your journal is saved but wouldn't open.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoto = async () => {
    if (!plantId || uploading) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        // Needed to fingerprint the image so the same photo is not stored
        // twice. The picker gives a URI we cannot read the bytes of otherwise.
        base64: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const image = result.assets[0];

      // Alert.prompt is iOS-only — on Android it silently does nothing, and
      // the photo would never be saved. Captions are optional, so Android
      // saves straight away rather than being handed a dialog that no-ops.
      if (Platform.OS === "ios") {
        Alert.prompt(
          "Add a note",
          "Anything worth remembering about this photo?",
          [
            { text: "Skip", style: "cancel", onPress: () => void savePhoto(image) },
            {
              text: "Save",
              // Alert.prompt types the callback loosely; annotated so React
              // 19's stricter inference does not fall back to any.
              onPress: (caption?: string) => void savePhoto(image, caption),
            },
          ],
          "plain-text",
          ""
        );
      } else {
        await savePhoto(image);
      }
    } catch (error) {
      console.error("Failed to pick image:", error);
      Alert.alert("Couldn't open your photos", "Check Sorrel has permission in Settings.");
    }
  };

  const savePhoto = async (image: ImagePicker.ImagePickerAsset, caption?: string) => {
    if (!plantId) return;

    setUploading(true);
    try {
      const saved = await addPhoto(plantId, {
        dateTaken: new Date(),
        imagePath: image.uri,
        imageHash: image.base64 ? await hashImage(image.base64) : image.uri,
        caption: caption?.trim() || undefined,
      });

      setPhotos((current) =>
        [saved, ...current].sort((a, b) => b.dateTaken.getTime() - a.dateTaken.getTime())
      );
    } catch (error) {
      console.error("Failed to save photo:", error);
      Alert.alert("Couldn't save", "That photo wasn't added. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    Alert.alert("Delete photo", "Remove this photo from the journal?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const previous = photos;
          setPhotos(photos.filter((p) => p.id !== photoId));

          try {
            await deletePhoto(photoId);
          } catch (error) {
            console.error("Failed to delete photo:", error);
            setPhotos(previous);
            Alert.alert("Couldn't delete", "That photo is still there. Try again.");
          }
        },
      },
    ]);
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

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
                  source={{ uri: item.imagePath }}
                  style={styles.photoImage}
                  onError={() => console.warn("Photo failed to load:", item.id)}
                />
                <View style={styles.photoInfo}>
                  <Text style={styles.photoDate}>{formatDate(item.dateTaken)}</Text>
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
