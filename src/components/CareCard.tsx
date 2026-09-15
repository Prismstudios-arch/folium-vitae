import React from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import type { SFSymbol } from "expo-symbols";
import { ToxicityLevel } from "@domain/plant";
import { Radius, Spacing, Tiles, Typography, type Palette } from "@constants/theme";
import { useColors, useThemedStyles } from "@hooks/useTheme";
import type { CareLookupResult } from "@services/careDatabase";
import type { Hemisphere, Season } from "@services/wateringInsights";
import {
  Units,
  SafetyTone,
  describeDifficulty,
  describeHumidity,
  describeLight,
  describeLightPlace,
  describePlacement,
  describeSoil,
  describeToxicityLevel,
  describeToxicitySummary,
  describeWaterCue,
  describeWaterShort,
  formatDegrees,
  formatTemperature,
  seasonalWatering,
} from "@services/careFormatting";
import { Icon } from "./Icon";
import { IconTile } from "./ListGroup";

interface CareCardProps {
  care: CareLookupResult;
  /** From Settings. */
  units?: Units;
  /** From Settings: decides which season it is. */
  hemisphere?: Hemisphere;
  /**
   * "full" shows the pets-and-children section; "summary" only the chip, for
   * screens that already show their own warning; "hidden" when toxicity
   * warnings are switched off in Settings.
   */
  toxicity?: "full" | "summary" | "hidden";
}

const SEASON_ICON: Record<Season, SFSymbol> = {
  spring: "camera.macro",
  summer: "sun.max.fill",
  autumn: "leaf.fill",
  winter: "snowflake",
};

const SEASON_COLOR: Record<Season, string> = {
  spring: Tiles.green,
  summer: Tiles.amber,
  autumn: Tiles.orange,
  winter: Tiles.blue,
};

const WHO: Array<{ key: "cats" | "dogs" | "humans"; label: string; icon: SFSymbol }> = [
  { key: "cats", label: "Cats", icon: "pawprint.fill" },
  { key: "dogs", label: "Dogs", icon: "pawprint.fill" },
  { key: "humans", label: "People", icon: "person.fill" },
];

/**
 * A plant's care guide.
 *
 * It leads with what matters today — how to water in the season it actually
 * is where you live — then the four things that decide whether a plant
 * lives, then how to fix what goes wrong. It says plainly when notes are
 * general to a genus or haven't been reviewed, and where toxicity came from.
 */
export function CareCard({ care, units = "metric", hemisphere = "north", toxicity = "full" }: CareCardProps) {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  const { guide, matchedAt, unreviewed } = care;

  const seasonal = seasonalWatering(guide.water, hemisphere);
  const safety = describeToxicitySummary(guide.toxicity);
  const toxicitySources = guide.sources.filter((source) => source.covers === "toxicity");

  const details: Array<{ icon: SFSymbol; color: string; title: string; body: string }> = [];
  if (guide.light.notes) details.push({ icon: "sun.max.fill", color: Tiles.amber, title: "Light", body: guide.light.notes });
  details.push({
    icon: "square.stack.3d.down.forward.fill",
    color: Tiles.grey,
    title: "Soil",
    body: guide.soil.notes ? `${describeSoil(guide.soil.type)}. ${guide.soil.notes}` : describeSoil(guide.soil.type),
  });
  if (guide.feeding) details.push({ icon: "leaf.fill", color: Tiles.green, title: "Feeding", body: guide.feeding });
  if (guide.repotting) details.push({ icon: "arrow.up.bin.fill", color: Tiles.purple, title: "Repotting", body: guide.repotting });
  if (guide.pruning) details.push({ icon: "scissors", color: Tiles.teal, title: "Pruning", body: guide.pruning });
  if (guide.propagation) details.push({ icon: "arrow.triangle.branch", color: Tiles.blue, title: "Propagation", body: guide.propagation });

  return (
    <View style={styles.container}>
      {matchedAt === "genus" ? (
        <View style={styles.notice}>
          <Icon name="info.circle.fill" size={17} color={Colors.brand} />
          <Text style={styles.noticeText}>
            General notes for <Text style={styles.italic}>{guide.genus}</Text> plants, not written for this exact
            species.
          </Text>
        </View>
      ) : null}

      <View style={styles.pills}>
        <Pill icon="gauge.with.dots.needle.33percent" label={describeDifficulty(guide.difficulty)} />
        <Pill icon={guide.placement === "outdoor" ? "tree.fill" : "house.fill"} label={describePlacement(guide.placement)} />
        {toxicity !== "hidden" ? (
          <Pill
            icon={safety.tone === "safe" ? "checkmark.shield.fill" : "exclamationmark.triangle.fill"}
            label={safety.label}
            tone={safety.tone}
          />
        ) : null}
      </View>

      {seasonal.advice ? (
        <View style={styles.now}>
          <IconTile icon={SEASON_ICON[seasonal.season]} color={SEASON_COLOR[seasonal.season]} size={40} />
          <View style={styles.nowText}>
            <Text style={styles.nowLabel}>
              Watering now · {seasonal.season.charAt(0).toUpperCase() + seasonal.season.slice(1)}
            </Text>
            <Text style={styles.nowBody}>{seasonal.advice}</Text>
            {guide.water.notes ? <Text style={styles.nowNote}>{guide.water.notes}</Text> : null}
          </View>
        </View>
      ) : null}

      <View style={styles.grid}>
        <Tile icon="sun.max.fill" color={Tiles.amber} label="Light" value={describeLight(guide.light)} hint={describeLightPlace(guide.light)} />
        <Tile
          icon="drop.fill"
          color={Tiles.blue}
          label="Water"
          value={describeWaterShort(guide.water.frequency)}
          hint={describeWaterCue(guide.water.frequency)}
        />
        <Tile
          icon="thermometer.medium"
          color={Tiles.orange}
          label="Temperature"
          value={formatTemperature(guide.temperature.minCelsius, guide.temperature.maxCelsius, units)}
          hint={guide.temperature.minCelsius < 0 ? "Survives frost" : `Keep above ${formatDegrees(guide.temperature.minCelsius, units)}`}
        />
        <Tile
          icon="humidity.fill"
          color={Tiles.teal}
          label="Humidity"
          value={`${guide.humidity.minPercent}–${guide.humidity.maxPercent}%`}
          hint={describeHumidity(guide.humidity.minPercent)}
        />
      </View>

      <View style={styles.group}>
        {details.map((detail, index) => (
          <View key={detail.title} style={[styles.detail, index < details.length - 1 && styles.divider]}>
            <IconTile icon={detail.icon} color={detail.color} size={30} />
            <View style={styles.detailText}>
              <Text style={styles.detailTitle}>{detail.title}</Text>
              <Text style={styles.detailBody}>{detail.body}</Text>
            </View>
          </View>
        ))}
      </View>

      {guide.problems.length > 0 ? (
        <View>
          <Text style={styles.groupTitle}>If something looks wrong</Text>
          <View style={styles.group}>
            {guide.problems.map((problem, index) => (
              <View key={problem.symptom} style={[styles.problem, index < guide.problems.length - 1 && styles.divider]}>
                <Text style={styles.problemSymptom}>{problem.symptom}</Text>
                <Text style={styles.problemCause}>{problem.cause}</Text>
                <View style={styles.fix}>
                  <Icon name="arrow.turn.down.right" size={13} color={Colors.brand} weight="semibold" />
                  <Text style={styles.fixText}>{problem.fix}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {toxicity === "full" ? (
        <View>
          <Text style={styles.groupTitle}>Pets and children</Text>
          <View style={[styles.group, styles.groupPadded]}>
            {safety.tone === "safe" ? (
              <View style={styles.safeRow}>
                <IconTile icon="checkmark.shield.fill" color={Tiles.green} size={30} />
                <Text style={styles.detailBody}>
                  {toxicitySources.length > 0
                    ? `Listed as non-toxic on the ${toxicitySources.map((source) => source.short).join(" and the ")}.`
                    : "Not known to be toxic to cats, dogs or people. Any plant can upset a pet's stomach if eaten in quantity."}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.levels}>
                  {WHO.filter(({ key }) => guide.toxicity[key] !== ToxicityLevel.None).map(({ key, label, icon }) => (
                    <LevelPill key={key} icon={icon} label={`${label} · ${describeToxicityLevel(guide.toxicity[key])}`} level={guide.toxicity[key]} />
                  ))}
                </View>
                {guide.toxicity.notes ? <Text style={styles.toxicityNotes}>{guide.toxicity.notes}</Text> : null}
                <Text style={styles.toxicityFine}>
                  If a pet or child has eaten any, contact a vet or your poison service. Don't wait for symptoms.
                </Text>
              </>
            )}

            {toxicitySources.map((source) => (
              <Pressable
                key={source.id}
                onPress={() => void Linking.openURL(source.url)}
                style={styles.sourceLink}
                accessibilityRole="link"
                accessibilityLabel={`Source: ${source.title}`}
              >
                <Icon name="link" size={12} color={Colors.textSecondary} />
                <Text style={styles.sourceText}>{source.short}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {guide.growthHabit || guide.matureSize ? (
        <View>
          <Text style={styles.groupTitle}>About this plant</Text>
          <View style={[styles.group, styles.groupPadded]}>
            {guide.growthHabit ? <Fact label="Growth" value={guide.growthHabit} /> : null}
            {guide.matureSize ? <Fact label="Size" value={guide.matureSize} /> : null}
            <Fact label="Family" value={guide.family} italic />
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Icon
          name={unreviewed ? "exclamationmark.circle" : "checkmark.seal.fill"}
          size={14}
          color={unreviewed ? Colors.textSecondary : Colors.brand}
        />
        <Text style={styles.footerText}>
          {unreviewed
            ? "From Sorrel's care library. Not yet reviewed by a horticulturist."
            : `Reviewed by ${guide.reviewedBy}${
                guide.lastReviewedAt
                  ? `, ${guide.lastReviewedAt.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`
                  : ""
              }.`}
        </Text>
      </View>
    </View>
  );
}

function Pill({ icon, label, tone }: { icon: SFSymbol; label: string; tone?: SafetyTone }) {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  const color =
    tone === "danger" ? Colors.error : tone === "caution" ? Colors.toxicity : tone === "safe" ? Colors.brand : Colors.textSecondary;

  return (
    <View style={styles.pill}>
      <Icon name={icon} size={13} color={color} weight="semibold" />
      <Text style={[styles.pillText, tone && tone !== "safe" ? { color } : null]}>{label}</Text>
    </View>
  );
}

function LevelPill({ icon, label, level }: { icon: SFSymbol; label: string; level: ToxicityLevel }) {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  const background =
    level === ToxicityLevel.Severe ? Colors.error : level === ToxicityLevel.Moderate ? Colors.toxicity : Colors.probably;

  return (
    <View style={[styles.level, { backgroundColor: background }]}>
      <Icon name={icon} size={12} color="#FFFFFF" weight="semibold" />
      <Text style={styles.levelText}>{label}</Text>
    </View>
  );
}

function Tile({ icon, color, label, value, hint }: { icon: SFSymbol; color: string; label: string; value: string; hint: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}. ${hint}`}>
      <IconTile icon={icon} color={color} size={30} />
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileHint}>{hint}</Text>
    </View>
  );
}

function Fact({ label, value, italic = false }: { label: string; value: string; italic?: boolean }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, italic && styles.italic]}>{value}</Text>
    </View>
  );
}

const createStyles = (Colors: Palette) =>
  StyleSheet.create({
    container: {
      gap: Spacing.default - 4,
    },
    italic: {
      fontStyle: "italic",
    },
    notice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.tight,
      padding: Spacing.default - 4,
      borderRadius: Radius.md,
      backgroundColor: Colors.brandTint,
    },
    noticeText: {
      ...Typography.caption1,
      color: Colors.brandDark,
      flex: 1,
    },
    pills: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.tight,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: Spacing.default - 6,
      paddingVertical: 6,
      borderRadius: Radius.pill,
      backgroundColor: Colors.card,
    },
    pillText: {
      ...Typography.caption1,
      fontWeight: "600",
      color: Colors.textPrimary,
    },
    now: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.default - 4,
      padding: Spacing.default,
      borderRadius: Radius.lg,
      backgroundColor: Colors.card,
    },
    nowText: {
      flex: 1,
    },
    nowLabel: {
      ...Typography.overline,
      color: Colors.textSecondary,
    },
    nowBody: {
      ...Typography.subheadline,
      color: Colors.textPrimary,
      marginTop: 2,
    },
    nowNote: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      marginTop: Spacing.compact,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.default - 6,
    },
    tile: {
      flexGrow: 1,
      flexBasis: "46%",
      padding: Spacing.default - 2,
      borderRadius: Radius.lg,
      backgroundColor: Colors.card,
    },
    tileLabel: {
      ...Typography.caption2,
      color: Colors.textSecondary,
      marginTop: Spacing.default - 6,
    },
    tileValue: {
      ...Typography.subheadline,
      fontSize: 16,
      lineHeight: 21,
      color: Colors.textPrimary,
      marginTop: 2,
    },
    tileHint: {
      ...Typography.caption2,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    groupTitle: {
      ...Typography.overline,
      color: Colors.textSecondary,
      marginLeft: Spacing.compact,
      marginTop: Spacing.tight,
      marginBottom: Spacing.tight,
    },
    group: {
      borderRadius: Radius.lg,
      backgroundColor: Colors.card,
      paddingHorizontal: Spacing.default,
    },
    groupPadded: {
      paddingVertical: Spacing.default - 2,
      gap: Spacing.tight,
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.separator,
    },
    detail: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.default - 4,
      paddingVertical: Spacing.default - 2,
    },
    detailText: {
      flex: 1,
    },
    detailTitle: {
      ...Typography.subheadline,
      color: Colors.textPrimary,
    },
    detailBody: {
      ...Typography.body,
      lineHeight: 22,
      color: Colors.textSecondary,
      marginTop: 2,
      flex: 1,
    },
    problem: {
      paddingVertical: Spacing.default - 2,
    },
    problemSymptom: {
      ...Typography.subheadline,
      color: Colors.textPrimary,
    },
    problemCause: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    fix: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      marginTop: Spacing.tight,
    },
    fixText: {
      ...Typography.body,
      lineHeight: 21,
      color: Colors.textPrimary,
      flex: 1,
    },
    safeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.default - 4,
    },
    levels: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    level: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: Spacing.tight + 2,
      paddingVertical: 5,
      borderRadius: Radius.pill,
    },
    levelText: {
      ...Typography.caption1,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    toxicityNotes: {
      ...Typography.body,
      lineHeight: 22,
      color: Colors.textPrimary,
    },
    toxicityFine: {
      ...Typography.caption1,
      color: Colors.textSecondary,
    },
    sourceLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      minHeight: 32,
    },
    sourceText: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      textDecorationLine: "underline",
    },
    fact: {
      gap: 2,
    },
    factLabel: {
      ...Typography.caption2,
      color: Colors.textSecondary,
    },
    factValue: {
      ...Typography.body,
      color: Colors.textPrimary,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: Spacing.compact,
      marginTop: Spacing.compact,
    },
    footerText: {
      ...Typography.caption2,
      color: Colors.textSecondary,
      flex: 1,
    },
  });
