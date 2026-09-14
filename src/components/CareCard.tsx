import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
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
        <Text style={styles.heading}>Care Summary</Text>

        <CareRow icon="💡" label="Light" value={describeLight(guide.light)} />
        <CareRow icon="💧" label="Water" value={describeWaterShort(guide.water.frequency)} />
        <CareRow icon="🌡️" label="Temperature" value={temperature} />
        <CareRow icon="💨" label="Humidity" value={humidity} />

        {hasToxicity(guide) && (
          <View style={styles.row}>
            <Text style={styles.icon}>⚠️</Text>
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

      <CareSection icon="💡" title="Light">
        <Text style={styles.text}>{describeLight(guide.light)}</Text>
        {guide.light.notes ? <Text style={styles.notes}>{guide.light.notes}</Text> : null}
      </CareSection>

      <CareSection icon="💧" title="Watering">
        <Text style={styles.text}>{describeWaterShort(guide.water.frequency)}</Text>
        {guide.water.notes ? <Text style={styles.notes}>{guide.water.notes}</Text> : null}
        {guide.water.seasonalModifier ? (
          <Text style={styles.seasonal}>Through the year: {guide.water.seasonalModifier}</Text>
        ) : null}
      </CareSection>

      <CareSection icon="🌍" title="Soil">
        <Text style={styles.text}>{describeSoil(guide.soil.type)}</Text>
        {guide.soil.drainage ? <Text style={styles.notes}>{guide.soil.drainage}</Text> : null}
      </CareSection>

      <CareSection icon="🌡️" title="Temperature">
        <Text style={styles.text}>{temperature}</Text>
      </CareSection>

      <CareSection icon="💨" title="Humidity">
        <Text style={styles.text}>{humidity}</Text>
      </CareSection>

      {hasToxicity(guide) && (
        <CareSection icon="⚠️" title="Toxicity">
          <ToxicityBadges guide={guide} />
          {guide.toxicity.notes ? <Text style={styles.notes}>{guide.toxicity.notes}</Text> : null}
        </CareSection>
      )}

      {guide.feeding ? (
        <CareSection icon="🌱" title="Feeding">
          <Text style={styles.text}>{guide.feeding}</Text>
        </CareSection>
      ) : null}

      {guide.repotting ? (
        <CareSection icon="🪴" title="Repotting">
          <Text style={styles.text}>{guide.repotting}</Text>
        </CareSection>
      ) : null}

      {guide.commonProblems && guide.commonProblems.length > 0 ? (
        <CareSection icon="🐛" title="Common Problems">
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
  icon: string;
  title: string;
  children: React.ReactNode;
}

function CareSection({ icon, title, children }: CareSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={styles.sectionHeading}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

interface CareRowProps {
  icon: string;
  label: string;
  value: string;
}

function CareRow({ icon, label, value }: CareRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compactContainer: {
    backgroundColor: Colors.glass,
    borderRadius: 12,
    padding: Spacing.default,
  },
  fullContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.default,
  },
  heading: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.default,
  },
  header: {
    marginBottom: Spacing.loose,
  },
  title: {
    fontSize: Typography.display.fontSize,
    fontWeight: Typography.display.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  scientific: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    fontStyle: "italic",
    marginBottom: Spacing.tight,
  },
  taxonomy: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textDisabled,
  },
  reviewDate: {
    fontSize: Typography.caption2.fontSize,
    color: Colors.textDisabled,
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
    marginBottom: Spacing.default,
  },
  sectionIcon: {
    fontSize: 24,
    marginRight: Spacing.default,
  },
  sectionHeading: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
  },
  sectionContent: {
    marginLeft: 32,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.default,
  },
  icon: {
    fontSize: 20,
    marginRight: Spacing.default,
    marginTop: Spacing.compact,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    marginBottom: Spacing.compact,
  },
  value: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  text: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    lineHeight: 22,
    marginBottom: Spacing.tight,
  },
  notes: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    marginTop: Spacing.tight,
    fontStyle: "italic",
  },
  seasonal: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.soil,
    marginTop: Spacing.tight,
    fontWeight: "600",
  },
  toxicBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.tight,
    marginBottom: Spacing.default,
  },
  footer: {
    paddingTop: Spacing.loose,
    borderTopColor: Colors.glass,
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    marginBottom: Spacing.tight,
  },
});
