import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Alert, Dimensions, Platform, Linking } from "react-native";
import { useState, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Radius, Spacing, Tiles, Typography, type Palette } from "@constants/theme";
import { useColors, useThemedStyles } from "@hooks/useTheme";
import { Button } from "@components/Button";
import { IconTile } from "@components/ListGroup";
import { ScreenHeader, HeaderIconButton } from "@components/ScreenHeader";
import { PlantPhoto } from "@domain/plant";
import { fetchPhotos, addPhoto, deletePhoto } from "@services/database";
import { fingerprintPhoto } from "@services/photoStorage";
import { parseExifDate } from "@services/photoPaths";
import { useGoBack } from "@hooks/useGoBack";

const { width } = Dimensions.get("window");
const GAP = Spacing.default - 4;
const PHOTO_SIZE = (width - Spacing.default * 2 - GAP) / 2;

type Source = "camera" | "library";

export default function PhotoJournalScreen() {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  const goBack = useGoBack("/my-plants");
  const { plantId, plantName } = useLocalSearchParams<{ plantId: string; plantName?: string }>();

  const [photos, setPhotos] = useState<PlantPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Photos whose file has gone — a labelled gap, not a blank tile.
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
          Alert.alert("Camera access is off", "Allow camera access for Sorrel in Settings to take journal photos.", [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ]);
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
          : // EXIF is read only for the date the photo was taken.
            await ImagePicker.launchImageLibraryAsync({ ...options, exif: true });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];

      const fingerprint = fingerprintPhoto(asset.uri);
      if (fingerprint && photos.some((p) => p.imageHash === fingerprint)) {
        Alert.alert("Already in the journal", "That photo has already been added for this plant.");
        return;
      }

      const dateTaken = source === "library" ? (parseExifDate(asset.exif) ?? new Date()) : new Date();

      // Alert.prompt is iOS-only; Android saves straight away.
      if (Platform.OS === "ios") {
        Alert.prompt(
          "Add a note",
          "Anything worth remembering about this photo?",
          [
            { text: "Skip", style: "cancel", onPress: () => void savePhoto(asset.uri, fingerprint, dateTaken) },
            { text: "Save", onPress: (caption?: string) => void savePhoto(asset.uri, fingerprint, dateTaken, caption) },
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

  const savePhoto = async (uri: string, fingerprint: string | null, dateTaken: Date, caption?: string) => {
    if (!plantId) return;

    setSaving(true);
    try {
      // addPhoto copies the file out of the picker's cache, which iOS clears.
      const saved = await addPhoto(plantId, {
        dateTaken,
        imagePath: uri,
        imageHash: fingerprint ?? uri,
        caption: caption?.trim() || undefined,
      });

      setPhotos((current) => [saved, ...current].sort((a, b) => b.dateTaken.getTime() - a.dateTaken.getTime()));
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

  const header = (
    <ScreenHeader
      onBack={goBack}
      title="Journal"
      subtitle={plantName || undefined}
      right={plantId && photos.length > 0 ? <HeaderIconButton icon="plus" label="Add a photo" onPress={handleAddPhoto} /> : undefined}
    />
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <ActivityIndicator size="large" color={Colors.brand} style={styles.loader} />
      </View>
    );
  }

  if (!plantId) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.stateCard}>
          <IconTile icon="photo.stack" color={Tiles.grey} size={52} />
          <Text style={styles.stateTitle}>No plant selected</Text>
          <Text style={styles.stateBody}>Open a plant from your collection to see its journal.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {header}

      {photos.length === 0 ? (
        <View style={styles.stateCard}>
          <IconTile icon="photo.stack" color={Tiles.purple} size={56} />
          <Text style={styles.stateTitle}>Start a growth journal</Text>
          <Text style={styles.stateBody}>Add a photo every few weeks and you'll be able to see how it has grown.</Text>
          <Button label="Add the first photo" icon="camera.fill" onPress={handleAddPhoto} loading={saving} style={styles.stateButton} />
        </View>
      ) : (
        <View style={styles.gridWrap}>
          {/* A wrapping grid of Views: a FlatList nested in a ScrollView
              warns and gains nothing here. */}
          <View style={styles.grid}>
            {photos.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.photoCard, pressed && styles.pressed]}
                onLongPress={() => handleDeletePhoto(item.id)}
                accessibilityRole="image"
                accessibilityLabel={[
                  `Photo from ${item.dateTaken.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}`,
                  item.caption,
                ]
                  .filter(Boolean)
                  .join(". ")}
                accessibilityHint="Press and hold to delete"
              >
                {unavailable.has(item.id) ? (
                  <View style={[styles.photo, styles.photoMissing]}>
                    <Text style={styles.photoMissingText}>Photo no longer on this phone</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: item.imagePath }}
                    style={styles.photo}
                    onError={() => setUnavailable((prev) => new Set(prev).add(item.id))}
                  />
                )}
                <View style={styles.photoInfo}>
                  <Text style={styles.photoDate}>
                    {item.dateTaken.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  </Text>
                  {item.caption ? (
                    <Text style={styles.photoCaption} numberOfLines={2}>
                      {item.caption}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>Press and hold a photo to delete it.</Text>
          <Button label="Add a photo" icon="camera.fill" onPress={handleAddPhoto} loading={saving} style={styles.addButton} />
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (Colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.bg,
    },
    scrollContent: {
      paddingBottom: Spacing.extra,
    },
    loader: {
      marginTop: Spacing.spacious,
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
    gridWrap: {
      paddingHorizontal: Spacing.default,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: GAP,
      rowGap: GAP,
    },
    photoCard: {
      width: PHOTO_SIZE,
      borderRadius: Radius.lg,
      backgroundColor: Colors.card,
      overflow: "hidden",
    },
    pressed: {
      opacity: 0.9,
    },
    photo: {
      width: "100%",
      height: PHOTO_SIZE,
      backgroundColor: Colors.separator,
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
      padding: Spacing.default - 4,
    },
    photoDate: {
      ...Typography.caption1,
      fontWeight: "600",
      color: Colors.textPrimary,
    },
    photoCaption: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    hint: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      textAlign: "center",
      marginTop: Spacing.default,
    },
    addButton: {
      marginTop: Spacing.default,
    },
  });
