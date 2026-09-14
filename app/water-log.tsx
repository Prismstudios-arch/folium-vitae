import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Linking,
} from "react-native";
import { useState, useEffect, ReactNode } from "react";
import { useLocalSearchParams } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { WaterLog, WaterAmount } from "@domain/plant";
import { fetchWaterLogs, addWaterLog, deleteWaterLog, fetchPlant } from "@services/database";
import { lookupCareGuide, CareLookupResult } from "@services/careDatabase";
import { getUserPreferences } from "@services/userPreferences";
import {
  refreshWateringReminder,
  getReminderPermission,
  requestReminderPermission,
} from "@services/wateringReminders";
import {
  summariseWatering,
  describeWaterFrequency,
  describeRhythm,
  currentSeason,
  describeSeasonForWatering,
  Hemisphere,
} from "@services/wateringInsights";
import { useGoBack } from "@hooks/useGoBack";

export default function WaterLogScreen() {
  const goBack = useGoBack("/my-plants");
  const { plantId, plantName } = useLocalSearchParams<{
    plantId: string;
    plantName?: string;
  }>();

  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [care, setCare] = useState<CareLookupResult | null>(null);
  const [hemisphere, setHemisphere] = useState<Hemisphere>("north");
  const [remindersOn, setRemindersOn] = useState(false);
  const [nextReminder, setNextReminder] = useState<Date | null>(null);
  const [reminderChecked, setReminderChecked] = useState(false);
  const [permission, setPermission] = useState<{ granted: boolean; canAskAgain: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedAmount, setSelectedAmount] = useState<WaterAmount>(WaterAmount.Moderate);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    void load();
  }, [plantId]);

  const load = async () => {
    if (!plantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [history, plant, prefs] = await Promise.all([
        fetchWaterLogs(plantId),
        fetchPlant(plantId),
        getUserPreferences(),
      ]);
      setLogs(history);
      setCare(plant ? lookupCareGuide(plant.scientificName) : null);
      setHemisphere(prefs.hemisphere);
      setRemindersOn(prefs.notificationsEnabled);
    } catch (error) {
      console.error("Failed to load watering logs:", error);
      Alert.alert("Couldn't load history", "Your watering history is saved but wouldn't open.");
    } finally {
      setLoading(false);
    }

    void syncReminder();
  };

  /**
   * Reminders follow the history, so any change to it reschedules. Best
   * effort: a reminder failing to schedule must never cost the log itself.
   */
  const syncReminder = async () => {
    if (!plantId) return;

    try {
      setPermission(await getReminderPermission());
      setNextReminder(await refreshWateringReminder(plantId));
    } catch (error) {
      console.warn("Couldn't update watering reminder:", error);
      setNextReminder(null);
    } finally {
      setReminderChecked(true);
    }
  };

  const handleAddLog = async () => {
    if (!plantId || saving) return;

    setSaving(true);
    try {
      const saved = await addWaterLog(plantId, {
        date: selectedDate,
        amount: selectedAmount,
        notes: notes.trim() || undefined,
      });

      // Insert in date order rather than at the top — the user can backdate
      // an entry, and prepending would put it above more recent waterings.
      setLogs((current) =>
        [saved, ...current].sort((a, b) => b.date.getTime() - a.date.getTime())
      );

      setSelectedDate(new Date());
      setSelectedAmount(WaterAmount.Moderate);
      setNotes("");
    } catch (error) {
      console.error("Failed to save watering log:", error);
      Alert.alert("Couldn't save", "That watering wasn't recorded. Try again.");
      return;
    } finally {
      setSaving(false);
    }

    void syncReminder();
  };

  const handleDeleteLog = (logId: string) => {
    Alert.alert("Delete entry", "Remove this watering from the history?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const previous = logs;
          // Remove it immediately, then put it back if the delete fails —
          // the list should never show a row that is already gone.
          setLogs(logs.filter((l) => l.id !== logId));

          try {
            await deleteWaterLog(logId);
          } catch (error) {
            console.error("Failed to delete watering log:", error);
            setLogs(previous);
            Alert.alert("Couldn't delete", "That entry is still there. Try again.");
            return;
          }

          void syncReminder();
        },
      },
    ]);
  };

  // Entries saved before the amount was recorded genuinely have none, so
  // these say so rather than assuming a value on the user's behalf.
  const getAmountLabel = (amount?: WaterAmount) => {
    const labels: Record<WaterAmount, string> = {
      [WaterAmount.Light]: "Light watering",
      [WaterAmount.Moderate]: "Moderate watering",
      [WaterAmount.Heavy]: "Heavy watering",
    };
    return amount ? labels[amount] : "Watered";
  };

  const getAmountEmoji = (amount?: WaterAmount) => {
    const emojis: Record<WaterAmount, string> = {
      [WaterAmount.Light]: "💧",
      [WaterAmount.Moderate]: "💦",
      [WaterAmount.Heavy]: "🌊",
    };
    return amount ? emojis[amount] : "💧";
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={goBack} accessibilityRole="button">
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Watering Log</Text>
      {plantName ? <Text style={styles.plant}>{plantName}</Text> : null}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <ActivityIndicator size="large" color={Colors.leaf} style={styles.loader} />
      </View>
    );
  }

  // Reached without a plant, the form would render and every tap would
  // silently do nothing. Say so instead.
  if (!plantId) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.emptyHistory}>
          <Text style={styles.emptyText}>No plant selected</Text>
          <Text style={styles.emptySubtext}>Open a plant from your collection to log watering.</Text>
        </View>
      </View>
    );
  }

  const rhythm = summariseWatering(logs);

  const handleAllowReminders = async () => {
    const result = await requestReminderPermission();
    setPermission(result);
    if (result.granted) void syncReminder();
  };

  // Reminders default to on, but the iOS permission is asked for here — once
  // there's enough history for a reminder to be useful — rather than cold at
  // launch, where most people refuse. Never asked before, a reminder would
  // simply never have fired.
  let reminder: ReactNode = null;
  if (remindersOn && reminderChecked && permission) {
    if (!permission.granted) {
      if (rhythm && rhythm.medianDays >= 1) {
        reminder = permission.canAskAgain ? (
          <TouchableOpacity onPress={handleAllowReminders} accessibilityRole="button">
            <Text style={styles.reminderAction}>Remind me when it's usually time to check →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => void Linking.openSettings()} accessibilityRole="button">
            <Text style={styles.reminderAction}>
              Notifications are off for Sorrel. Turn them on in Settings →
            </Text>
          </TouchableOpacity>
        );
      }
    } else if (nextReminder) {
      reminder = (
        <Text style={styles.careTip}>
          We'll remind you to check it on{" "}
          {nextReminder.toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          .
        </Text>
      );
    } else {
      reminder = (
        <Text style={styles.careTip}>
          Log a couple of waterings and Sorrel will remind you when it's usually time to check.
        </Text>
      );
    }
  }

  return (
    <View style={styles.container}>
      {header}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.addLogSection}>
          <Text style={styles.sectionTitle}>Log watering</Text>

          {/* The spinner picker this replaced was closed by its own onChange,
              which on iOS fires on the first tick of the wheel — so it shut
              the moment you touched it. The compact picker is always present
              and opens its own calendar. Future dates are refused: a watering
              that hasn't happened yet isn't history. */}
          <View style={styles.dateRow}>
            <Text style={styles.dateButtonLabel}>Date</Text>
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="compact"
              maximumDate={new Date()}
              onChange={(_event, date) => {
                if (date) setSelectedDate(date);
              }}
              accentColor={Colors.leaf}
            />
          </View>

          <Text style={styles.amountLabel}>Amount</Text>
          <View style={styles.amountButtons}>
            {[WaterAmount.Light, WaterAmount.Moderate, WaterAmount.Heavy].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.amountButton,
                  selectedAmount === amount && styles.amountButtonActive,
                ]}
                onPress={() => setSelectedAmount(amount)}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedAmount === amount }}
              >
                <Text style={styles.amountEmoji}>{getAmountEmoji(amount)}</Text>
                <Text
                  style={[
                    styles.amountText,
                    selectedAmount === amount && styles.amountTextActive,
                  ]}
                >
                  {amount === WaterAmount.Light
                    ? "Light"
                    : amount === WaterAmount.Moderate
                      ? "Moderate"
                      : "Heavy"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notes — this was a grey Text styled to look like an input, with
              a comment saying a real one would come later. Nothing could be
              typed, so every note ever saved was empty. */}
          <Text style={styles.notesLabel}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. soil was bone dry, added feed"
            placeholderTextColor={Colors.textDisabled}
            multiline
            maxLength={280}
            returnKeyType="done"
            blurOnSubmit
          />

          <Button
            label="Log watering"
            onPress={handleAddLog}
            loading={saving}
            disabled={saving}
          />
        </View>

        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>History</Text>

          {logs.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyText}>No watering logged yet</Text>
              <Text style={styles.emptySubtext}>Log a watering above to start the history.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.hint}>Press and hold an entry to delete it.</Text>
              {/* Plain map rather than a FlatList: a virtualised list nested
                  in a ScrollView warns and gains nothing at this size. */}
              {logs.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.logItem}
                  onLongPress={() => handleDeleteLog(item.id)}
                  accessibilityHint="Press and hold to delete"
                >
                  <View style={styles.logContent}>
                    <View style={styles.logHeader}>
                      <Text style={styles.logDate}>
                        {new Date(item.date).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                      <Text style={styles.logEmoji}>{getAmountEmoji(item.amount)}</Text>
                    </View>
                    <Text style={styles.logAmount}>{getAmountLabel(item.amount)}</Text>
                    {/* Ternary, not &&: an empty-string note from an older row
                        would render a bare string and crash React Native. */}
                    {item.notes ? <Text style={styles.logNotes}>{item.notes}</Text> : null}
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>

        {/* Watering guidance. Previously a fixed "Based on your logs, water
            every 3-5 days" shown for every plant, reading no logs — advice
            that would rot a cactus. Every line now has something real
            behind it: the species notes, this user's own rhythm, and the
            season for their hemisphere. */}
        <View style={styles.careSection}>
          <Text style={styles.careTitle}>Watering guidance</Text>

          {care && (
            <>
              <Text style={styles.careTip}>
                {care.matchedAt === "genus"
                  ? `Plants in this genus usually ${describeWaterFrequency(care.guide.water.frequency)}.`
                  : `This plant ${describeWaterFrequency(care.guide.water.frequency)}.`}
              </Text>
              {care.guide.water.seasonalModifier ? (
                <Text style={styles.careTip}>{care.guide.water.seasonalModifier}</Text>
              ) : null}
              {care.unreviewed && (
                <Text style={styles.careCaveat}>
                  These notes haven't been reviewed by a horticulturist yet.
                </Text>
              )}
            </>
          )}

          {rhythm ? <Text style={styles.careTip}>{describeRhythm(rhythm)}</Text> : null}

          <Text style={styles.careTip}>
            {describeSeasonForWatering(currentSeason(hemisphere))}
          </Text>

          {reminder}

          <Text style={styles.careCaveat}>
            Check the soil before watering — light, warmth and pot size change how fast it dries.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loader: {
    marginTop: Spacing.spacious,
  },
  header: {
    paddingHorizontal: Spacing.default,
    paddingTop: Spacing.default,
    paddingBottom: Spacing.loose,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass,
  },
  backButton: {
    fontSize: Typography.body.fontSize,
    color: Colors.leaf,
    fontWeight: "600" as any,
    marginBottom: Spacing.compact,
  },
  title: {
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight as any,
    color: Colors.textPrimary,
  },
  plant: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.default,
  },
  addLogSection: {
    backgroundColor: Colors.glass,
    borderRadius: 12,
    padding: Spacing.default,
    marginVertical: Spacing.loose,
  },
  sectionTitle: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.default,
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.compact,
    paddingHorizontal: Spacing.compact,
    backgroundColor: Colors.background,
    borderRadius: 8,
    marginBottom: Spacing.default,
    borderWidth: 1,
    borderColor: Colors.glass,
  },
  dateButtonLabel: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
  },
  amountLabel: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  amountButtons: {
    flexDirection: "row",
    gap: Spacing.compact,
    marginBottom: Spacing.default,
  },
  amountButton: {
    flex: 1,
    paddingVertical: Spacing.default,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.glass,
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  amountButtonActive: {
    backgroundColor: Colors.leaf,
    borderColor: Colors.leaf,
  },
  amountEmoji: {
    fontSize: 24,
    marginBottom: Spacing.compact,
  },
  amountText: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textPrimary,
  },
  amountTextActive: {
    color: "#FFFFFF",
    fontWeight: "600" as any,
  },
  notesLabel: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  notesInput: {
    minHeight: 64,
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.compact,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.glass,
    marginBottom: Spacing.default,
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    textAlignVertical: "top",
  },
  historySection: {
    paddingVertical: Spacing.loose,
  },
  hint: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    marginBottom: Spacing.compact,
  },
  emptyHistory: {
    alignItems: "center",
    paddingVertical: Spacing.spacious,
    paddingHorizontal: Spacing.default,
  },
  emptyText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  emptySubtext: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  logItem: {
    backgroundColor: Colors.glass,
    borderRadius: 8,
    padding: Spacing.default,
    marginBottom: Spacing.default,
  },
  logContent: {
    gap: Spacing.compact,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logDate: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
  },
  logEmoji: {
    fontSize: 20,
  },
  logAmount: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
  },
  logNotes: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
  careSection: {
    backgroundColor: Colors.glass,
    borderRadius: 12,
    padding: Spacing.default,
    marginVertical: Spacing.loose,
    gap: Spacing.compact,
  },
  careTitle: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
  },
  careTip: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  reminderAction: {
    fontSize: Typography.body.fontSize,
    color: Colors.leaf,
    fontWeight: "600" as any,
  },
  careCaveat: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
});
