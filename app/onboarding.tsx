import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import type { SFSymbol } from "expo-symbols";
import { Colors, Radius, Shadow, Spacing, Tiles, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { Icon } from "@components/Icon";
import { IconTile } from "@components/ListGroup";
import { completeOnboarding, saveUserPreferences } from "@services/userPreferences";

/**
 * First run: a brand welcome, the promises, and one safety question.
 *
 * The button always sits in a footer that's on screen — an earlier version
 * pinned each page to the window height with scrolling off, so the button
 * ended up below the bottom edge and nobody could get past the first page.
 */

type Step = "welcome" | "promise" | "household";
const STEPS: Step[] = ["welcome", "promise", "household"];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stepIndex, setStepIndex] = useState(0);
  // Null until answered: this drives safety warnings, so it isn't
  // pre-selected for anyone.
  const [hasChildrenOrPets, setHasChildrenOrPets] = useState<boolean | null>(null);
  const [finishing, setFinishing] = useState(false);

  const step = STEPS[stepIndex];
  const isWelcome = step === "welcome";
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

  const next = () => (isLast ? void handleComplete() : setStepIndex(stepIndex + 1));

  return (
    <View style={[styles.container, !isWelcome && styles.containerLight]}>
      <StatusBar style={isWelcome ? "light" : "dark"} />

      {isWelcome ? (
        <Animated.View entering={FadeIn.duration(400)} style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={[Colors.brandLit, Colors.brandDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Image
            source={require("../assets/illustrations/hero-sprig.png")}
            // Below the feature list and clear of the button, so no leaf
            // ever sits behind text.
            style={[styles.welcomeArt, { bottom: insets.bottom + 140, right: -70, width: 260, height: 234 }]}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
      ) : null}

      {/* Three steps, in order: progress is real information here. */}
      <View
        style={[styles.progress, { paddingTop: insets.top + Spacing.default }]}
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${stepIndex + 1} of ${STEPS.length}`}
      >
        {STEPS.map((s, index) => (
          <View
            key={s}
            style={[
              styles.dot,
              isWelcome ? styles.dotOnDark : styles.dotOnLight,
              index === stepIndex && (isWelcome ? styles.dotCurrentOnDark : styles.dotCurrent),
            ]}
          />
        ))}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, isWelcome && styles.bodyContentWelcome]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View key={step} entering={FadeInDown.duration(380)}>
          {step === "welcome" && <Welcome />}
          {step === "promise" && <Promises />}
          {step === "household" && (
            <Household value={hasChildrenOrPets} onChange={setHasChildrenOrPets} />
          )}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.tight }]}>
        <Button
          label={isWelcome ? "Get started" : isLast ? "Start identifying" : "Continue"}
          variant={isWelcome ? "inverse" : "primary"}
          icon={isLast ? "camera.fill" : undefined}
          onPress={next}
          loading={finishing}
          disabled={isLast && hasChildrenOrPets === null}
        />

        {stepIndex > 0 ? (
          <Pressable
            onPress={() => setStepIndex(stepIndex - 1)}
            style={styles.back}
            accessibilityRole="button"
          >
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        ) : (
          <Text style={styles.welcomeFine}>No account needed</Text>
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
      <Text style={styles.welcomeTitle}>Know every{"\n"}plant you grow.</Text>
      <Text style={styles.welcomeBody}>
        Point your camera at a plant. Sorrel tells you what it is — and exactly how sure it is.
      </Text>

      <View style={styles.welcomePoints}>
        <WelcomePoint icon="camera.viewfinder" text="Identify a plant in seconds" />
        <WelcomePoint icon="drop.fill" text="Watering log and gentle reminders" />
        <WelcomePoint icon="photo.stack" text="A photo journal for every plant" />
      </View>
    </View>
  );
}

function WelcomePoint({ icon, text }: { icon: SFSymbol; text: string }) {
  return (
    <View style={styles.welcomePoint}>
      <View style={styles.welcomePointIcon}>
        <Icon name={icon} size={16} color={Colors.brandBright} weight="semibold" />
      </View>
      <Text style={styles.welcomePointText}>{text}</Text>
    </View>
  );
}

function Promises() {
  return (
    <View>
      <Text style={styles.title}>Built on three promises</Text>
      <Text style={styles.lede}>The things plant apps usually get wrong.</Text>

      <View style={styles.cards}>
        <PromiseCard
          icon="checkmark.seal.fill"
          color={Tiles.green}
          title="We say when we're not sure"
          body="Every answer shows how confident we are, with the other possibilities alongside."
        />
        <PromiseCard
          icon="lock.open.fill"
          color={Tiles.blue}
          title="No traps"
          body="You see the price before any trial starts, and you can cancel from Settings at any time."
        />
        <PromiseCard
          icon="book.closed.fill"
          color={Tiles.amber}
          title="No made-up advice"
          body="Care notes come from a fixed library, never generated on the fly. If nobody has reviewed a plant's notes yet, we tell you."
        />
      </View>
    </View>
  );
}

function PromiseCard({
  icon,
  color,
  title,
  body,
}: {
  icon: SFSymbol;
  color: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.card}>
      <IconTile icon={icon} color={color} size={40} />
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBody}>{body}</Text>
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
      <Text style={styles.title}>Anyone at home who might chew a leaf?</Text>
      <Text style={styles.lede}>
        Children or pets. We'll make sure toxicity warnings are switched on.
      </Text>

      <View style={styles.cards}>
        <Choice
          icon="pawprint.fill"
          color={Tiles.orange}
          title="Yes, children or pets"
          detail="Warn me about toxic plants"
          selected={value === true}
          onPress={() => onChange(true)}
        />
        <Choice
          icon="house.fill"
          color={Tiles.teal}
          title="No, just me"
          detail="Warnings stay on; you can turn them off"
          selected={value === false}
          onPress={() => onChange(false)}
        />
      </View>

      <Text style={styles.fine}>You can change this in Settings whenever you like.</Text>
    </View>
  );
}

function Choice({
  icon,
  color,
  title,
  detail,
  selected,
  onPress,
}: {
  icon: SFSymbol;
  color: string;
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.cardPressed]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <IconTile icon={icon} color={color} size={40} />
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBody}>{detail}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <Icon name="checkmark" size={13} color="#FFFFFF" weight="bold" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brandDeep,
  },
  containerLight: {
    backgroundColor: Colors.bg,
  },
  welcomeArt: {
    position: "absolute",
    right: -70,
    width: 360,
    height: 324,
  },
  progress: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingBottom: Spacing.tight,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotOnDark: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  dotOnLight: {
    backgroundColor: Colors.separator,
  },
  dotCurrent: {
    width: 24,
    backgroundColor: Colors.brand,
  },
  dotCurrentOnDark: {
    width: 24,
    backgroundColor: "#FFFFFF",
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
  bodyContentWelcome: {
    justifyContent: "flex-start",
    paddingTop: Spacing.spacious,
  },
  mark: {
    width: 72,
    height: 72,
    marginBottom: Spacing.loose,
  },
  welcomeTitle: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  welcomeBody: {
    ...Typography.bodyLarge,
    lineHeight: 25,
    color: "rgba(255, 255, 255, 0.82)",
    marginTop: Spacing.default,
    maxWidth: 330,
  },
  welcomePoints: {
    marginTop: Spacing.spacious,
    gap: Spacing.default,
  },
  welcomePoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.default - 4,
  },
  welcomePointIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  welcomePointText: {
    ...Typography.bodyLarge,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  title: {
    ...Typography.displayLarge,
    color: Colors.textPrimary,
  },
  lede: {
    ...Typography.bodyLarge,
    lineHeight: 24,
    color: Colors.textSecondary,
    marginTop: Spacing.tight,
  },
  cards: {
    marginTop: Spacing.loose,
    gap: Spacing.default - 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.default - 2,
    padding: Spacing.default,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: "transparent",
    ...Shadow.card,
  },
  cardSelected: {
    borderColor: Colors.brand,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
  },
  cardBody: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.separator,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    backgroundColor: Colors.brand,
    borderColor: Colors.brand,
  },
  fine: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginTop: Spacing.loose,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: Spacing.loose,
    paddingTop: Spacing.default,
  },
  back: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.compact,
  },
  backText: {
    ...Typography.bodyLarge,
    color: Colors.brand,
    fontWeight: "600",
  },
  welcomeFine: {
    ...Typography.caption1,
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
    minHeight: 44,
    lineHeight: 44,
    marginTop: Spacing.compact,
  },
});
