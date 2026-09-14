import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { SFSymbol } from "expo-symbols";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { Icon } from "@components/Icon";
import { completeOnboarding, saveUserPreferences } from "@services/userPreferences";

/**
 * First run.
 *
 * The previous version pinned each page to the full window height and
 * switched scrolling off. Once every screen was padded clear of the notch,
 * the page was taller than the space it had, its button sat below the bottom
 * edge, and nobody could get past the welcome screen. The button now lives
 * in a footer that is always on screen, and the content above it scrolls if
 * it ever needs to — at large text sizes, or on a small phone.
 *
 * It also dropped a "How did you find us?" step. The answer was saved on the
 * phone and never sent anywhere, beside a note claiming "we use this to
 * improve our marketing".
 */

type Step = "welcome" | "promise" | "household";
const STEPS: Step[] = ["welcome", "promise", "household"];

export default function OnboardingScreen() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  // Null until answered: this one drives safety warnings, so it isn't
  // pre-selected for them.
  const [hasChildrenOrPets, setHasChildrenOrPets] = useState<boolean | null>(null);
  const [finishing, setFinishing] = useState(false);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const handleComplete = async () => {
    if (finishing) return;
    setFinishing(true);

    try {
      await saveUserPreferences({
        hasChildrenOrPets: hasChildrenOrPets === true,
        // Someone with children or pets has told us they want to know about
        // toxicity; turning the warnings on is the point of having asked.
        ...(hasChildrenOrPets ? { showToxicityWarnings: true } : {}),
      });

      await completeOnboarding();
      router.replace("/scan");
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      Alert.alert(
        "Couldn't save that",
        "Your answer wasn't stored. You can carry on and set it later in Settings.",
        [
          { text: "Try again", style: "cancel" },
          { text: "Carry on", onPress: () => router.replace("/scan") },
        ]
      );
    } finally {
      setFinishing(false);
    }
  };

  const handlePrimary = () => {
    if (isLast) {
      void handleComplete();
    } else {
      setStepIndex(stepIndex + 1);
    }
  };

  return (
    <View style={styles.container}>
      {/* Progress is real information here: three steps, in order. */}
      <View
        style={styles.progress}
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${stepIndex + 1} of ${STEPS.length}`}
      >
        {STEPS.map((s, index) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              index <= stepIndex && styles.progressDotReached,
              index === stepIndex && styles.progressDotCurrent,
            ]}
          />
        ))}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View key={step} entering={FadeInDown.duration(320)}>
          {step === "welcome" && <Welcome />}
          {step === "promise" && <Promise />}
          {step === "household" && (
            <Household value={hasChildrenOrPets} onChange={setHasChildrenOrPets} />
          )}
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={isLast ? "Scan your first plant" : "Continue"}
          onPress={handlePrimary}
          loading={finishing}
          disabled={isLast && hasChildrenOrPets === null}
        />

        {stepIndex > 0 ? (
          <TouchableOpacity
            onPress={() => setStepIndex(stepIndex - 1)}
            style={styles.secondaryAction}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryActionText}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.secondaryAction} />
        )}
      </View>
    </View>
  );
}

function Welcome() {
  return (
    <View>
      <Image
        source={require("../assets/brand-mark.png")}
        style={styles.mark}
        accessibilityIgnoresInvertColors
        accessibilityLabel="Sorrel"
      />
      <Text style={styles.brand}>Sorrel</Text>
      <Text style={styles.lede}>
        Point your camera at a plant. We'll tell you what it is — and exactly how sure we are.
      </Text>

      <View style={styles.list}>
        <Row
          icon="camera.viewfinder"
          title="Identify in seconds"
          body="One clear photo is usually enough. When it isn't, we say so."
        />
        <Row
          icon="drop.fill"
          title="Care notes"
          body="Light, water and toxicity for the plants our library covers."
        />
        <Row
          icon="leaf.fill"
          title="Your collection"
          body="A watering log, reminders and a photo journal for every plant you keep."
        />
      </View>
    </View>
  );
}

function Promise() {
  return (
    <View>
      <Text style={styles.heading}>Three promises</Text>
      <Text style={styles.sub}>The things plant apps usually get wrong.</Text>

      <View style={styles.list}>
        <Row
          icon="checkmark.seal.fill"
          title="We say when we're not sure"
          body="Every answer shows how confident we are, with the other possibilities alongside."
        />
        <Row
          icon="lock.open.fill"
          title="No traps"
          body="You see the price before any trial starts, and you can cancel from Settings at any time."
        />
        <Row
          icon="book.closed.fill"
          title="No made-up advice"
          body="Care notes come from a fixed library, never generated on the fly. If nobody has reviewed a plant's notes yet, we tell you."
        />
      </View>
    </View>
  );
}

function Household({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <View>
      <Text style={styles.heading}>Anyone at home who might chew a leaf?</Text>
      <Text style={styles.sub}>
        Children or pets. We'll make sure toxicity warnings are switched on.
      </Text>

      <View style={styles.choices}>
        <Choice
          icon="pawprint.fill"
          label="Yes, children or pets"
          selected={value === true}
          onPress={() => onChange(true)}
        />
        <Choice
          icon="house.fill"
          label="No, just me"
          selected={value === false}
          onPress={() => onChange(false)}
        />
      </View>

      <Text style={styles.fine}>You can change this in Settings whenever you like.</Text>
    </View>
  );
}

function Row({ icon, title, body }: { icon: SFSymbol; title: string; body: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={22} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
    </View>
  );
}

function Choice({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: SFSymbol;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <Icon name={icon} size={22} color={selected ? "#FFFFFF" : Colors.leaf} />
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
      {selected ? <Icon name="checkmark" size={18} color="#FFFFFF" weight="bold" /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  progress: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingTop: Spacing.default,
    paddingBottom: Spacing.tight,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.glass,
  },
  progressDotReached: {
    backgroundColor: Colors.leafLight,
  },
  progressDotCurrent: {
    width: 22,
    backgroundColor: Colors.leaf,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.loose,
    paddingVertical: Spacing.loose,
  },
  mark: {
    width: 88,
    height: 88,
    marginBottom: Spacing.loose,
  },
  brand: {
    ...Typography.displayLarge,
    letterSpacing: 0.5,
    color: Colors.textPrimary,
  },
  lede: {
    ...Typography.bodyLarge,
    lineHeight: 24,
    color: Colors.textSecondary,
    marginTop: Spacing.tight,
  },
  heading: {
    ...Typography.display,
    color: Colors.textPrimary,
  },
  sub: {
    ...Typography.bodyLarge,
    lineHeight: 24,
    color: Colors.textSecondary,
    marginTop: Spacing.tight,
  },
  list: {
    marginTop: Spacing.spacious,
    gap: Spacing.loose,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.default,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(45, 88, 66, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    paddingTop: 2,
  },
  rowTitle: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
  },
  rowBody: {
    ...Typography.body,
    lineHeight: 21,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  choices: {
    marginTop: Spacing.spacious,
    gap: Spacing.default,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.default,
    minHeight: 60,
    paddingHorizontal: Spacing.default,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.glass,
    backgroundColor: Colors.background,
  },
  choiceSelected: {
    backgroundColor: Colors.leaf,
    borderColor: Colors.leaf,
  },
  choiceLabel: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    flex: 1,
  },
  choiceLabelSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  fine: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginTop: Spacing.loose,
  },
  footer: {
    paddingHorizontal: Spacing.loose,
    paddingTop: Spacing.default,
    paddingBottom: Spacing.tight,
  },
  secondaryAction: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.compact,
  },
  secondaryActionText: {
    ...Typography.bodyLarge,
    color: Colors.leaf,
  },
});
