import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { CareGuide } from "@domain/plant";
import { Colors, Spacing, Typography } from "@constants/theme";
import { ToxicityBadge } from "./Card";

interface CareCardProps {
  guide: CareGuide;
  compactMode?: boolean;
}

export function CareCard({ guide, compactMode = false }: CareCardProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short" });
  };

  if (compactMode) {
    return (
      <View style={styles.compactContainer}>
        <Text style={styles.heading}>Care Summary</Text>

        <CareRow icon="💡" label="Light" value={`${guide.light.min} to ${guide.light.max}`} />
        <CareRow icon="💧" label="Water" value={guide.water.frequency} />
        <CareRow icon="🌡️" label="Temperature" value={`${guide.temperature.minCelsius}–${guide.temperature.maxCelsius}°C`} />
        <CareRow icon="💨" label="Humidity" value={`${guide.humidity.minPercent}–${guide.humidity.maxPercent}%`} />

        {guide.toxicity && (
          <View style={styles.row}>
            <Text style={styles.icon}>⚠️</Text>
            <View style={styles.content}>
              <Text style={styles.label}>Toxicity</Text>
              <View style={styles.toxicBadges}>
                {guide.toxicity.cats !== "none" && (
                  <ToxicityBadge type="cats" level={guide.toxicity.cats} />
                )}
                {guide.toxicity.dogs !== "none" && (
                  <ToxicityBadge type="dogs" level={guide.toxicity.dogs} />
                )}
                {guide.toxicity.humans !== "none" && (
                  <ToxicityBadge type="humans" level={guide.toxicity.humans} />
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  // Full care card
  return (
    <ScrollView style={styles.fullContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{guide.commonNames[0]}</Text>
        <Text style={styles.scientific}>{guide.scientificName}</Text>
        {guide.taxonomy && <Text style={styles.taxonomy}>{guide.taxonomy}</Text>}
      </View>

      {/* Review Info */}
      {guide.lastReviewedAt && (
        <Text style={styles.reviewDate}>
          Care notes reviewed {formatDate(guide.lastReviewedAt)}
        </Text>
      )}

      {/* Light */}
      <CareSection icon="💡" title="Light Requirements">
        <Text style={styles.text}>
          {guide.light.min} to {guide.light.max}
        </Text>
        {guide.light.notes && <Text style={styles.notes}>{guide.light.notes}</Text>}
      </CareSection>

      {/* Water */}
      <CareSection icon="💧" title="Watering">
        <Text style={styles.text}>{guide.water.frequency}</Text>
        {guide.water.notes && <Text style={styles.notes}>{guide.water.notes}</Text>}
        {guide.water.seasonalModifier && (
          <Text style={styles.seasonal}>Season: {guide.water.seasonalModifier}</Text>
        )}
      </CareSection>

      {/* Soil */}
      <CareSection icon="🌍" title="Soil">
        <Text style={styles.text}>{guide.soil.type}</Text>
        {guide.soil.drainage && <Text style={styles.notes}>{guide.soil.drainage}</Text>}
      </CareSection>

      {/* Temperature */}
      <CareSection icon="🌡️" title="Temperature">
        <Text style={styles.text}>
          {guide.temperature.minCelsius}–{guide.temperature.maxCelsius}°C (
          {guide.temperature.minCelsius * 1.8 + 32}–{guide.temperature.maxCelsius * 1.8 + 32}°F)
        </Text>
      </CareSection>

      {/* Humidity */}
      <CareSection icon="💨" title="Humidity">
        <Text style={styles.text}>
          {guide.humidity.minPercent}–{guide.humidity.maxPercent}%
        </Text>
      </CareSection>

      {/* Toxicity */}
      {guide.toxicity && (
        <CareSection icon="⚠️" title="Toxicity">
          <View style={styles.toxicBadges}>
            {guide.toxicity.cats !== "none" && <ToxicityBadge type="cats" level={guide.toxicity.cats} />}
            {guide.toxicity.dogs !== "none" && <ToxicityBadge type="dogs" level={guide.toxicity.dogs} />}
            {guide.toxicity.humans !== "none" && (
              <ToxicityBadge type="humans" level={guide.toxicity.humans} />
            )}
          </View>
          {guide.toxicity.notes && <Text style={styles.notes}>{guide.toxicity.notes}</Text>}
        </CareSection>
      )}

      {/* Feeding */}
      {guide.feeding && (
        <CareSection icon="🌱" title="Feeding">
          <Text style={styles.text}>{guide.feeding}</Text>
        </CareSection>
      )}

      {/* Repotting */}
      {guide.repotting && (
        <CareSection icon="🪴" title="Repotting">
          <Text style={styles.text}>{guide.repotting}</Text>
        </CareSection>
      )}

      {/* Common Problems */}
      {guide.commonProblems && guide.commonProblems.length > 0 && (
        <CareSection icon="🐛" title="Common Problems">
          {guide.commonProblems.map((problem, idx) => (
            <Text key={idx} style={styles.text}>
              • {problem}
            </Text>
          ))}
        </CareSection>
      )}

      {/* Growth Info */}
      <View style={styles.footer}>
        {guide.growthHabit && (
          <Text style={styles.footerText}>Growth: {guide.growthHabit}</Text>
        )}
        {guide.matureSize && <Text style={styles.footerText}>Size: {guide.matureSize}</Text>}
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
