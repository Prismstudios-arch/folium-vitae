import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button, SecondaryButton } from "@components/Button";

/**
 * Expert escalation — not yet available.
 *
 * This screen previously rendered a fabricated conversation: it invented a
 * question the user had not asked, then replied a second later as a
 * "botanist" with canned text. Somebody would reasonably have believed a real
 * person had answered and acted on it for a plant they care about.
 *
 * The feature needs a ticket queue and actual people answering (SPEC 8.2).
 * Neither exists yet, so this says so plainly instead of simulating it.
 */
export default function ExpertEscalationScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.emoji}>🌿</Text>

      <Text style={styles.title}>Ask a human — not ready yet</Text>

      <Text style={styles.body}>
        When Sorrel isn't sure about a plant, the plan is to let you send it to a
        real botanist and get an answer back within a day.
      </Text>

      <Text style={styles.body}>
        That needs actual people on the other end, and we haven't built the queue
        yet. Rather than have the app pretend to connect you to someone, we'd
        rather tell you it isn't there.
      </Text>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>In the meantime</Text>

      <Text style={styles.body}>
        When an identification is uncertain, Sorrel shows you its top three
        candidates and the reasons rather than guessing at one. Comparing those
        against your plant is usually enough to settle it.
      </Text>

      <View style={styles.actions}>
        <Button label="Back to my plant" onPress={() => router.back()} />
        <SecondaryButton
          label="Go to My Plants"
          onPress={() => router.replace("/my-plants")}
          style={styles.secondaryAction}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.loose,
    paddingTop: Spacing.spacious,
  },
  emoji: {
    fontSize: 44,
    marginBottom: Spacing.default,
  },
  title: {
    ...Typography.headline,
    color: Colors.textPrimary,
    marginBottom: Spacing.default,
  },
  sectionTitle: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
    marginBottom: Spacing.tight,
  },
  body: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.default,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.glass,
    marginVertical: Spacing.loose,
  },
  actions: {
    marginTop: Spacing.loose,
  },
  secondaryAction: {
    marginTop: Spacing.tight,
  },
});
