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
import type { SFSymbol } from "expo-symbols";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { Icon } from "@components/Icon";
import { ScreenHeader } from "@components/ScreenHeader";
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

/** Emoji (💧💦🌊) made these look like a chat app. One symbol, filling up. */
const AMOUNTS: Array<{ amount: WaterAmount; label: string; icon: SFSymbol }> = [
  { amount: WaterAmount.Light, label: "Light", icon: "drop" },
  { amount: WaterAmount.Moderate, label: "Moderate", icon: "drop.halffull" },
  { amount: WaterAmount.Heavy, label: "Heavy", icon: "drop.fill" },
];

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

  const handleAllowReminders = async () => {
    const result = await requestReminderPermission();
    setPermission(result);
    if (result.granted) void syncReminder();
  };

  const header = (
    <ScreenHeader onBack={goBack} title="Watering log" subtitle={plantName || undefined} />
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

  // Reminders default to on, but the iOS permission is asked for here — once
  // there's enough history for a reminder to be useful — rather than cold at
  // launch, where most people refuse.
  let reminder: ReactNode = null;
  if (remindersOn && reminderChecked && permission) {
    if (!permission.granted) {
      if (rhythm && rhythm.medianDays >= 1) {
        reminder = permission.canAskAgain ? (
          <TouchableOpacity onPress={handleAllowReminders} style={styles.reminderAction} accessibilityRole="button">
            <Icon name="bell.fill" size={15} />
            <Text style={styles.reminderActionText}>Remind me when it's usually time to check</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => void Linking.openSettings()}
            style={styles.reminderAction}
            accessibilityRole="button"
          >
            <Icon name="bell.fill" size={15} />
            <Text style={styles.reminderActionText}>Turn on notifications for Sorrel in Settings</Text>
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
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {header}

        <View style={styles.body}>
          <View style={styles.addLogSection}>
            <Text style={styles.sectionTitle}>Log a watering</Text>

            {/* The compact picker is always present and opens its own
                calendar. Future dates are refused: a watering that hasn't
                happened yet isn't history. */}
            <View style={styles.dateRow}>
              <Text style={styles.fieldLabel}>Date</Text>
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

            <Text style={styles.fieldLabel}>Amount</Text>
            <View style={styles.amountButtons}>
              {AMOUNTS.map(({ amount, label, icon }) => {
                const active = selectedAmount === amount;
                return (
                  <TouchableOpacity
                    key={amount}
                    style={[styles.amountButton, active && styles.amountButtonActive]}
                    onPress={() => setSelectedAmount(amount)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Icon name={icon} size={22} color={active ? "#FFFFFF" : Colors.leaf} />
                    <Text style={[styles.amountText, active && styles.amountTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
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

            <Button label="Log watering" onPress={handleAddLog} loading={saving} disabled={saving} />
          </View>

          {/* Watering guidance. Every line has something real behind it: the
              species notes, this user's own rhythm, and the season for their
              hemisphere. */}
          <View style={styles.careSection}>
            <Text style={styles.sectionTitle}>Watering guidance</Text>

            {care ? (
              <>
                <Text style={styles.careTip}>
                  {care.matchedAt === "genus"
                    ? `Plants in this genus usually ${describeWaterFrequency(care.guide.water.frequency)}.`
                    : `This plant ${describeWaterFrequency(care.guide.water.frequency)}.`}
                </Text>
                {care.guide.water.seasonalModifier ? (
                  <Text style={styles.careTip}>{care.guide.water.seasonalModifier}</Text>
                ) : null}
                {care.unreviewed ? (
                  <Text style={styles.careCaveat}>
                    These notes haven't been reviewed by a horticulturist yet.
                  </Text>
                ) : null}
              </>
            ) : null}

            {rhythm ? <Text style={styles.careTip}>{describeRhythm(rhythm)}</Text> : null}

            <Text style={styles.careTip}>{describeSeasonForWatering(currentSeason(hemisphere))}</Text>

            {reminder}

            <Text style={styles.careCaveat}>
              Check the soil before watering — light, warmth and pot size change how fast it dries.
            </Text>
          </View>

          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>History</Text>

            {logs.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Icon name="drop" size={26} color={Colors.textSecondary} />
                <Text style={styles.emptyText}>No watering logged yet</Text>
                <Text style={styles.emptySubtext}>Log a watering above to start the history.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.hint}>Press and hold an entry to delete it.</Text>
                {logs.map((item) => {
                  const amount = AMOUNTS.find((a) => a.amount === item.amount);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.logItem}
                      onLongPress={() => handleDeleteLog(item.id)}
                      accessibilityHint="Press and hold to delete"
                    >
                      <View style={styles.logIcon}>
                        <Icon name={amount?.icon ?? "drop"} size={18} />
                      </View>
                      <View style={styles.logContent}>
                        <Text style={styles.logDate}>
                          {new Date(item.date).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                        {/* Entries saved before the amount was recorded
                            genuinely have none; they just say "Watered". */}
                        <Text style={styles.logAmount}>
                          {amount ? `${amount.label} watering` : "Watered"}
                        </Text>
                        {/* Ternary, not &&: an empty-string note would render a
                            bare string and crash React Native. */}
                        {item.notes ? <Text style={styles.logNotes}>{item.notes}</Text> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </View>
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
  content: {
    flex: 1,
  },
  body: {
    paddingHorizontal: Spacing.default,
    paddingBottom: Spacing.extra,
    gap: Spacing.loose,
  },
  addLogSection: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glass,
    backgroundColor: Colors.surface,
    padding: Spacing.default,
  },
  sectionTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    marginBottom: Spacing.default,
  },
  fieldLabel: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginBottom: Spacing.tight,
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.default,
  },
  amountButtons: {
    flexDirection: "row",
    gap: Spacing.tight,
    marginBottom: Spacing.default,
  },
  amountButton: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.glass,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.compact,
    backgroundColor: Colors.background,
  },
  amountButtonActive: {
    backgroundColor: Colors.leaf,
    borderColor: Colors.leaf,
  },
  amountText: {
    ...Typography.caption1,
    color: Colors.textPrimary,
  },
  amountTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  notesInput: {
    ...Typography.body,
    minHeight: 72,
    paddingHorizontal: Spacing.default,
    paddingTop: Spacing.default,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.glass,
    marginBottom: Spacing.default,
    color: Colors.textPrimary,
    textAlignVertical: "top",
  },
  careSection: {
    gap: Spacing.tight,
  },
  careTip: {
    ...Typography.body,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  careCaveat: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
  reminderAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.tight,
    minHeight: 44,
  },
  reminderActionText: {
    ...Typography.bodyLarge,
    color: Colors.leaf,
    fontWeight: "600",
    flexShrink: 1,
  },
  historySection: {},
  hint: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginBottom: Spacing.tight,
  },
  emptyHistory: {
    alignItems: "center",
    paddingVertical: Spacing.spacious,
    paddingHorizontal: Spacing.default,
    gap: Spacing.tight,
  },
  emptyText: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
  },
  emptySubtext: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  logItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.default,
    paddingVertical: Spacing.default,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.glass,
  },
  logIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(45, 88, 66, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  logContent: {
    flex: 1,
    gap: 2,
  },
  logDate: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
  },
  logAmount: {
    ...Typography.caption1,
    color: Colors.textSecondary,
  },
  logNotes: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginTop: Spacing.compact,
  },
});
