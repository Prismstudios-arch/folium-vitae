import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { SFSymbol } from "expo-symbols";
import { CareGuide, ToxicityLevel } from "@domain/plant";
import { Colors, Radius, Spacing, Tiles, Typography } from "@constants/theme";
import {
  Units,
  describeLight,
  describeWaterShort,
  describeSoil,
  formatTemperatureRange,
} from "@services/careFormatting";
import { ToxicityBadge } from "./Card";
import { IconTile } from "./ListGroup";

interface CareCardProps {
  guide: CareGuide;
  /** Kept for existing callers; every placement now uses the tile grid. */
  compactMode?: boolean;
  /** From Settings. */
  units?: Units;
}

/**
 * Whether the guide records any toxicity. The toxicity object is always
 * present, so testing it for truthiness put an empty "Toxicity" heading on
 * every harmless plant.
 */
function hasToxicity(guide: CareGuide): boolean {
  const t = guide.toxicity;
  return (
    !!t &&
    (t.cats !== ToxicityLevel.None || t.dogs !== ToxicityLevel.None || t.humans !== ToxicityLevel.None)
  );
}

/**
 * Care at a glance: a grid of tiles for the four things that decide whether
 * a houseplant lives — light, water, warmth, humidity — then soil, feeding
 * and toxicity beneath. The same shape people know from the best plant apps,
 * built only from what the care library actually records.
 */
export function CareCard({ guide, units = "metric" }: CareCardProps) {
  const temperature = formatTemperatureRange(
    guide.temperature.minCelsius,
    guide.temperature.maxCelsius,
    units
  );

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        <CareTile icon="sun.max.fill" color={Tiles.amber} label="Light" value={describeLight(guide.light)} />
        <CareTile icon="drop.fill" color={Tiles.blue} label="Water" value={describeWaterShort(guide.water.frequency)} />
        <CareTile icon="thermometer.medium" color={Tiles.orange} label="Temperature" value={temperature} />
        <CareTile
          icon="humidity.fill"
          color={Tiles.teal}
          label="Humidity"
          value={`${guide.humidity.minPercent}–${guide.humidity.maxPercent}%`}
        />
      </View>

      <View style={styles.details}>
        {/* Ternaries rather than && throughout: an empty string from the care
            data would otherwise render as a bare text node and crash. */}
        <Detail icon="mountain.2.fill" color={Tiles.grey} title="Soil" body={describeSoil(guide.soil.type)} note={guide.soil.drainage} />
        {guide.water.notes ? (
          <Detail icon="drop" color={Tiles.blue} title="Watering" body={guide.water.notes} note={guide.water.seasonalModifier} />
        ) : null}
        {guide.feeding ? <Detail icon="leaf.fill" color={Tiles.green} title="Feeding" body={guide.feeding} /> : null}
        {guide.repotting ? (
          <Detail icon="arrow.triangle.2.circlepath" color={Tiles.purple} title="Repotting" body={guide.repotting} />
        ) : null}
        {guide.commonProblems && guide.commonProblems.length > 0 ? (
          <Detail icon="ladybug.fill" color={Tiles.red} title="Common problems" body={guide.commonProblems.join(" · ")} />
        ) : null}
        {hasToxicity(guide) ? (
          <View style={[styles.detail, styles.detailLast]}>
            <IconTile icon="exclamationmark.triangle.fill" color={Tiles.orange} size={30} />
            <View style={styles.detailText}>
              <Text style={styles.detailTitle}>Toxicity</Text>
              <View style={styles.badges}>
                {guide.toxicity.cats !== ToxicityLevel.None && <ToxicityBadge type="cats" level={guide.toxicity.cats} />}
                {guide.toxicity.dogs !== ToxicityLevel.None && <ToxicityBadge type="dogs" level={guide.toxicity.dogs} />}
                {guide.toxicity.humans !== ToxicityLevel.None && (
                  <ToxicityBadge type="humans" level={guide.toxicity.humans} />
                )}
              </View>
              {guide.toxicity.notes ? <Text style={styles.detailNote}>{guide.toxicity.notes}</Text> : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function CareTile({ icon, color, label, value }: { icon: SFSymbol; color: string; label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <IconTile icon={icon} color={color} size={30} />
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

function Detail({
  icon,
  color,
  title,
  body,
  note,
}: {
  icon: SFSymbol;
  color: string;
  title: string;
  body: string;
  note?: string;
}) {
  return (
    <View style={styles.detail}>
      <IconTile icon={icon} color={color} size={30} />
      <View style={styles.detailText}>
        <Text style={styles.detailTitle}>{title}</Text>
        <Text style={styles.detailBody}>{body}</Text>
        {note ? <Text style={styles.detailNote}>{note}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.default - 4,
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
  details: {
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.default,
  },
  detail: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.default - 4,
    paddingVertical: Spacing.default - 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  detailLast: {
    borderBottomWidth: 0,
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
  },
  detailNote: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginTop: Spacing.compact,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
});
