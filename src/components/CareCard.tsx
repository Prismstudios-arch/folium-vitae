import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import type { SFSymbol } from "expo-symbols";
import { CareGuide, ToxicityLevel } from "@domain/plant";
import { Colors, Spacing, Typography } from "@constants/theme";
import {
  Units,
  describeLight,
  describeWaterShort,
  describeSoil,
  formatTemperatureRange,
} from "@services/careFormatting";
import { ToxicityBadge } from "./Card";
import { Icon } from "./Icon";

interface CareCardProps {
  guide: CareGuide;
  compactMode?: boolean;
  /** From Settings. The card ignored this and always showed Celsius. */
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

function ToxicityBadges({ guide }: { guide: CareGuide }) {
  return (
    <View style={styles.toxicBadges}>
      {guide.toxicity.cats !== ToxicityLevel.None && (
        <ToxicityBadge type="cats" level={guide.toxicity.cats} />
      )}
      {guide.toxicity.dogs !== ToxicityLevel.None && (
        <ToxicityBadge type="dogs" level={guide.toxicity.dogs} />
      )}
      {guide.toxicity.humans !== ToxicityLevel.None && (
        <ToxicityBadge type="humans" level={guide.toxicity.humans} />
      )}
    </View>
  );
}

/**
 * Care notes. DESIGN.md: no card styling in the full view, dividers between
 * sections, a consistent icon on the left and the text on the right. The
 * icons were emoji; they are SF Symbols in the brand colour now.
 */
export function CareCard({ guide, compactMode = false, units = "metric" }: CareCardProps) {
  const temperature = formatTemperatureRange(
    guide.temperature.minCelsius,
    guide.temperature.maxCelsius,
    units
  );
  const humidity = `${guide.humidity.minPercent}–${guide.humidity.maxPercent}%`;

  if (compactMode) {
    return (
      <View style={styles.compactContainer}>
        <Text style={styles.heading}>Care summary</Text>

        <CareRow icon="sun.max.fill" label="Light" value={describeLight(guide.light)} />
        <CareRow icon="drop.fill" label="Water" value={describeWaterShort(guide.water.frequency)} />
        <CareRow icon="thermometer.medium" label="Temperature" value={temperature} />
        <CareRow icon="humidity.fill" label="Humidity" value={humidity} last={!hasToxicity(guide)} />

        {hasToxicity(guide) && (
          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.rowIcon}>
              <Icon name="exclamationmark.triangle.fill" size={18} color={Colors.toxicity} />
            </View>
            <View style={styles.content}>
              <Text style={styles.label}>Toxicity</Text>
              <ToxicityBadges guide={guide} />
            </View>
          </View>
        )}
      </View>
    );
  }

  // Ternaries rather than && throughout: an empty string from the care data
  // would otherwise render as a bare text node and crash React Native.
  return (
    <ScrollView style={styles.fullContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>{guide.commonNames[0] ?? guide.scientificName}</Text>
        <Text style={styles.scientific}>{guide.scientificName}</Text>
        {guide.taxonomy ? <Text style={styles.taxonomy}>{guide.taxonomy}</Text> : null}
      </View>

      {guide.lastReviewedAt ? (
        <Text style={styles.reviewDate}>
          Care notes reviewed{" "}
          {new Date(guide.lastReviewedAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
          })}
        </Text>
      ) : null}

      <CareSection icon="sun.max.fill" title="Light">
        <Text style={styles.text}>{describeLight(guide.light)}</Text>
        {guide.light.notes ? <Text style={styles.notes}>{guide.light.notes}</Text> : null}
      </CareSection>

      <CareSection icon="drop.fill" title="Watering">
        <Text style={styles.text}>{describeWaterShort(guide.water.frequency)}</Text>
        {guide.water.notes ? <Text style={styles.notes}>{guide.water.notes}</Text> : null}
        {guide.water.seasonalModifier ? (
          <Text style={styles.seasonal}>Through the year: {guide.water.seasonalModifier}</Text>
        ) : null}
      </CareSection>

      <CareSection icon="mountain.2.fill" title="Soil">
        <Text style={styles.text}>{describeSoil(guide.soil.type)}</Text>
        {guide.soil.drainage ? <Text style={styles.notes}>{guide.soil.drainage}</Text> : null}
      </CareSection>

      <CareSection icon="thermometer.medium" title="Temperature">
        <Text style={styles.text}>{temperature}</Text>
      </CareSection>

      <CareSection icon="humidity.fill" title="Humidity">
        <Text style={styles.text}>{humidity}</Text>
      </CareSection>

      {hasToxicity(guide) && (
        <CareSection icon="exclamationmark.triangle.fill" title="Toxicity" iconColor={Colors.toxicity}>
          <ToxicityBadges guide={guide} />
          {guide.toxicity.notes ? <Text style={styles.notes}>{guide.toxicity.notes}</Text> : null}
        </CareSection>
      )}

      {guide.feeding ? (
        <CareSection icon="leaf.fill" title="Feeding">
          <Text style={styles.text}>{guide.feeding}</Text>
        </CareSection>
      ) : null}

      {guide.repotting ? (
        <CareSection icon="arrow.triangle.2.circlepath" title="Repotting">
          <Text style={styles.text}>{guide.repotting}</Text>
        </CareSection>
      ) : null}

      {guide.commonProblems && guide.commonProblems.length > 0 ? (
        <CareSection icon="ladybug.fill" title="Common problems">
          {guide.commonProblems.map((problem, idx) => (
            <Text key={idx} style={styles.text}>
              • {problem}
            </Text>
          ))}
        </CareSection>
      ) : null}

      <View style={styles.footer}>
        {guide.growthHabit ? <Text style={styles.footerText}>Growth: {guide.growthHabit}</Text> : null}
        {guide.matureSize ? <Text style={styles.footerText}>Size: {guide.matureSize}</Text> : null}
      </View>
    </ScrollView>
  );
}

interface CareSectionProps {
  icon: SFSymbol;
  title: string;
  iconColor?: string;
  children: React.ReactNode;
}

function CareSection({ icon, title, iconColor = Colors.leaf, children }: CareSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <Icon name={icon} size={22} color={iconColor} />
        <Text style={styles.sectionHeading}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

interface CareRowProps {
  icon: SFSymbol;
  label: string;
  value: string;
  last?: boolean;
}

function CareRow({ icon, label, value, last = false }: CareRowProps) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={18} />
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compactContainer: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glass,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.default,
    paddingTop: Spacing.default,
  },
  fullContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.default,
  },
  heading: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
    marginBottom: Spacing.tight,
  },
  header: {
    marginBottom: Spacing.loose,
  },
  title: {
    ...Typography.display,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  scientific: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontStyle: "italic",
    marginBottom: Spacing.tight,
  },
  taxonomy: {
    ...Typography.caption1,
    color: Colors.textSecondary,
  },
  reviewDate: {
    ...Typography.caption2,
    color: Colors.textSecondary,
    marginBottom: Spacing.loose,
    fontStyle: "italic",
  },
  section: {
    marginBottom: Spacing.loose,
    paddingBottom: Spacing.loose,
    borderBottomColor: Colors.glass,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.default,
    marginBottom: Spacing.tight,
  },
  sectionHeading: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
  },
  sectionContent: {
    marginLeft: 38,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.default,
    paddingVertical: Spacing.tight + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.glass,
  },
  rowLast: {
    borderBottomWidth: 0,
    paddingBottom: Spacing.default,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(45, 88, 66, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  label: {
    ...Typography.caption2,
    color: Colors.textSecondary,
  },
  value: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: "500",
    marginTop: 1,
  },
  text: {
    ...Typography.body,
    color: Colors.textPrimary,
    lineHeight: 22,
    marginBottom: Spacing.tight,
  },
  notes: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginTop: Spacing.tight,
  },
  seasonal: {
    ...Typography.caption1,
    color: Colors.soil,
    marginTop: Spacing.tight,
    fontWeight: "600",
  },
  toxicBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.tight,
    marginTop: Spacing.compact,
  },
  footer: {
    paddingTop: Spacing.loose,
  },
  footerText: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginBottom: Spacing.tight,
  },
});
