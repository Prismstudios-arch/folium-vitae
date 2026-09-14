import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Linking,
} from "react-native";
import { useState, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { Icon } from "@components/Icon";
import { ScreenHeader } from "@components/ScreenHeader";
import { PlantPhoto } from "@domain/plant";
import { fetchPhotos, addPhoto, deletePhoto } from "@services/database";
import { fingerprintPhoto } from "@services/photoStorage";
import { parseExifDate } from "@services/photoPaths";
import { useGoBack } from "@hooks/useGoBack";

const { width } = Dimensions.get("window");
const PHOTO_SIZE = (width - Spacing.default * 3) / 2;

type Source = "camera" | "library";

export default function PhotoJournalScreen() {
  const goBack = useGoBack("/my-plants");
  const { plantId, plantName } = useLocalSearchParams<{
    plantId: string;
    plantName?: string;
  }>();

  const [photos, setPhotos] = useState<PlantPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Photos whose file has gone — shown as a labelled gap, not a blank tile.
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());

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

  // The journal could only import from the library. A growth journal you
  // can't photograph your plant into today is missing its main use.
  const handleAddPhoto = () => {
    if (!plantId || saving) return;

    Alert.alert("Add a photo", undefined, [
      { text: "Take photo", onPress: () => void pickPhoto("camera") },
      { text: "Choose from library", onPress: () => void pickPhoto("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const pickPhoto = async (source: Source) => {
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            "Camera access is off",
            "Allow camera access for Sorrel in Settings to take journal photos.",
            [
              { text: "Not now", style: "cancel" },
              { text: "Open Settings", onPress: () => void Linking.openSettings() },
            ]
          );
          return;
        }
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : // EXIF is read only for the date the photo was taken; nothing
            // else from it is kept.
            await ImagePicker.launchImageLibraryAsync({ ...options, exif: true });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];

      // The old code hashed the image "so the same photo is not stored
      // twice" and then never compared the hash with anything. This does.
      const fingerprint = fingerprintPhoto(asset.uri);
      if (fingerprint && photos.some((p) => p.imageHash === fingerprint)) {
        Alert.alert("Already in the journal", "That photo has already been added for this plant.");
        return;
      }

      const dateTaken =
        source === "library" ? (parseExifDate(asset.exif) ?? new Date()) : new Date();

      // Alert.prompt is iOS-only — on Android it silently does nothing, and
      // the photo would never be saved. Captions are optional, so Android
      // saves straight away.
      if (Platform.OS === "ios") {
        Alert.prompt(
          "Add a note",
          "Anything worth remembering about this photo?",
          [
            {
              text: "Skip",
              style: "cancel",
              onPress: () => void savePhoto(asset.uri, fingerprint, dateTaken),
            },
            {
              text: "Save",
              onPress: (caption?: string) => void savePhoto(asset.uri, fingerprint, dateTaken, caption),
            },
          ],
          "plain-text",
          ""
        );
      } else {
        await savePhoto(asset.uri, fingerprint, dateTaken);
      }
    } catch (error) {
      console.error("Failed to add photo:", error);
      Alert.alert(
        source === "camera" ? "Couldn't open the camera" : "Couldn't open your photos",
        "Check Sorrel's permissions in Settings, then try again."
      );
    }
  };

  const savePhoto = async (
    uri: string,
    fingerprint: string | null,
    dateTaken: Date,
    caption?: string
  ) => {
    if (!plantId) return;

    setSaving(true);
    try {
      // addPhoto copies the file out of the picker's cache, which iOS clears
      // whenever it likes.
      const saved = await addPhoto(plantId, {
        dateTaken,
        imagePath: uri,
        imageHash: fingerprint ?? uri,
        caption: caption?.trim() || undefined,
      });

      setPhotos((current) =>
        [saved, ...current].sort((a, b) => b.dateTaken.getTime() - a.dateTaken.getTime())
      );
    } catch (error) {
      console.error("Failed to save photo:", error);
      Alert.alert("Couldn't save", "That photo wasn't added. Try again.");
    } finally {
      setSaving(false);
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

  const header = (
    <ScreenHeader onBack={goBack} title="Photo journal" subtitle={plantName || undefined} />
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <ActivityIndicator size="large" color={Colors.leaf} style={styles.loader} />
      </View>
    );
  }

  if (!plantId) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No plant selected</Text>
          <Text style={styles.emptyText}>Open a plant from your collection to see its journal.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {header}

        {photos.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon name="photo.stack" size={30} />
            </View>
            <Text style={styles.emptyTitle}>No photos yet</Text>
            <Text style={styles.emptyText}>
              Add a photo every few weeks and you'll be able to see how it has grown.
            </Text>
          </View>
        ) : (
          <View style={styles.gridWrap}>
            <Text style={styles.hint}>Press and hold a photo to delete it.</Text>
            {/* A wrapping grid of Views rather than a FlatList: a virtualised
                list nested in a ScrollView warns and gains nothing here. */}
            <View style={styles.grid}>
              {photos.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.photoCard}
                  onLongPress={() => handleDeletePhoto(item.id)}
                  accessibilityHint="Press and hold to delete"
                >
                  {unavailable.has(item.id) ? (
                    <View style={[styles.photoImage, styles.photoMissing]}>
                      <Text style={styles.photoMissingText}>Photo no longer on this phone</Text>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: item.imagePath }}
                      style={styles.photoImage}
                      onError={() => setUnavailable((prev) => new Set(prev).add(item.id))}
                    />
                  )}
                  <View style={styles.photoInfo}>
                    <Text style={styles.photoDate}>{formatDate(item.dateTaken)}</Text>
                    {item.caption ? (
                      <Text style={styles.photoCaption} numberOfLines={2}>
                        {item.caption}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Add a photo" onPress={handleAddPhoto} disabled={saving} loading={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loader: {
    marginTop: Spacing.spacious,
  },
  content: {
    flex: 1,
  },
  gridWrap: {
    paddingHorizontal: Spacing.default,
  },
  hint: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginBottom: Spacing.default,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: Spacing.default,
    rowGap: Spacing.default,
    paddingBottom: Spacing.default,
  },
  photoCard: {
    width: PHOTO_SIZE,
  },
  photoImage: {
    width: "100%",
    height: PHOTO_SIZE,
    borderRadius: 14,
    backgroundColor: Colors.glass,
  },
  photoMissing: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.default,
  },
  photoMissingText: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  photoInfo: {
    paddingTop: Spacing.tight,
  },
  photoDate: {
    ...Typography.caption1,
    color: Colors.textPrimary,
    fontWeight: "600",
  },
  photoCaption: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.extra,
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
  emptyTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    marginBottom: Spacing.tight,
  },
  emptyText: {
    ...Typography.body,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.default,
  },
});
