import { View, Text, StyleSheet, TextInput, FlatList, Pressable } from "react-native";
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Radius, Spacing, Tiles, Typography, type Palette } from "@constants/theme";
import { useColors, useThemedStyles } from "@hooks/useTheme";
import { Button } from "@components/Button";
import { Icon } from "@components/Icon";
import { IconTile } from "@components/ListGroup";
import { ScreenHeader } from "@components/ScreenHeader";
import { useGoBack } from "@hooks/useGoBack";
import { careDatabaseStats, listCareGuides, searchCareGuides } from "@services/careDatabase";
import { formatCommonName } from "@utils/plantNames";
import type { CareGuide } from "@domain/plant";

function guideName(guide: CareGuide): string {
  return guide.commonNames[0] ? formatCommonName(guide.commonNames[0]) : guide.scientificName;
}

/**
 * The care library without a scan — for a plant you already know the name of,
 * or one you're thinking of buying. Every name a record answers to is
 * searchable, including old ones like "Calathea" and "Sansevieria".
 */
export default function PlantLookupScreen() {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const goBack = useGoBack("/");
  const [query, setQuery] = useState("");

  const all = useMemo(() => listCareGuides().sort((a, b) => guideName(a).localeCompare(guideName(b))), []);
  const stats = useMemo(() => careDatabaseStats(), []);
  const results = useMemo(() => (query.trim() ? searchCareGuides(query) : all), [query, all]);

  const header = (
    <View>
      <ScreenHeader
        onBack={goBack}
        backLabel="Home"
        title="Look up a plant"
        subtitle={`Care notes for ${stats.species} plants, plus general notes for ${stats.genera} plant groups.`}
      />
      <View style={styles.search}>
        <Icon name="magnifyingglass" size={16} color={Colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Monstera, peace lily, basil…"
          placeholderTextColor={Colors.textDisabled}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="Search the care library"
        />
      </View>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={results}
      keyExtractor={(guide) => guide.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={header}
      renderItem={({ item, index }) => {
        const last = index === results.length - 1;
        return (
          <Pressable
            onPress={() => router.push({ pathname: "/care-guide", params: { name: item.scientificName } })}
            style={({ pressed }) => [
              styles.row,
              index === 0 && styles.rowFirst,
              last && styles.rowLast,
              pressed && styles.rowPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${guideName(item)}, ${item.scientificName}`}
          >
            <View style={[styles.rowBody, !last && styles.rowDivider]}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{guideName(item)}</Text>
                <Text style={styles.rowSubtitle}>{item.scientificName}</Text>
              </View>
              <Icon name="chevron.right" size={13} color={Colors.textDisabled} weight="semibold" />
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <IconTile icon="book.closed.fill" color={Tiles.grey} size={44} />
          <Text style={styles.emptyTitle}>Not in the care library yet</Text>
          <Text style={styles.emptyBody}>
            Nothing matches “{query.trim()}”. A scan will still identify it, with general notes for its plant group where
            we have them.
          </Text>
          <Button label="Scan a plant" icon="camera.fill" onPress={() => router.push("/scan")} style={styles.emptyButton} />
        </View>
      }
    />
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
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.tight,
      marginHorizontal: Spacing.default,
      marginBottom: Spacing.default,
      paddingHorizontal: Spacing.default - 4,
      minHeight: 44,
      borderRadius: Radius.md,
      backgroundColor: Colors.card,
    },
    searchInput: {
      ...Typography.bodyLarge,
      flex: 1,
      color: Colors.textPrimary,
      paddingVertical: Spacing.tight,
    },
    row: {
      marginHorizontal: Spacing.default,
      paddingLeft: Spacing.default,
      backgroundColor: Colors.card,
    },
    rowFirst: {
      borderTopLeftRadius: Radius.md + 2,
      borderTopRightRadius: Radius.md + 2,
    },
    rowLast: {
      borderBottomLeftRadius: Radius.md + 2,
      borderBottomRightRadius: Radius.md + 2,
    },
    rowPressed: {
      backgroundColor: Colors.fill,
    },
    rowBody: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.tight,
      paddingVertical: 11,
      paddingRight: Spacing.default,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.separator,
    },
    rowText: {
      flex: 1,
    },
    rowTitle: {
      ...Typography.bodyLarge,
      color: Colors.textPrimary,
    },
    rowSubtitle: {
      ...Typography.caption1,
      fontStyle: "italic",
      color: Colors.textSecondary,
      marginTop: 1,
    },
    empty: {
      alignItems: "center",
      gap: Spacing.tight,
      marginHorizontal: Spacing.default,
      padding: Spacing.loose,
      borderRadius: Radius.xl,
      backgroundColor: Colors.card,
    },
    emptyTitle: {
      ...Typography.headline,
      color: Colors.textPrimary,
      textAlign: "center",
      marginTop: Spacing.tight,
    },
    emptyBody: {
      ...Typography.body,
      lineHeight: 22,
      color: Colors.textSecondary,
      textAlign: "center",
    },
    emptyButton: {
      alignSelf: "stretch",
      marginTop: Spacing.default,
    },
  });
