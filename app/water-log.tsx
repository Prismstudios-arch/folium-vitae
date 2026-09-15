import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, TextInput, Linking } from "react-native";
import { useState, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { SFSymbol } from "expo-symbols";
import { Colors, Radius, Spacing, Tiles, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { Icon } from "@components/Icon";
import { IconTile, ListGroup, ListRow } from "@components/ListGroup";
import { ScreenHeader } from "@components/ScreenHeader";
import { WaterLog, WaterAmount } from "@domain/plant";
import { fetchWaterLogs, addWaterLog, deleteWaterLog, fetchPlant } from "@services/database";
import { lookupCareGuide, CareLookupResult } from "@services/careDatabase";
import { getUserPreferences } from "@services/userPreferences";
import { refreshWateringReminder, getReminderPermission, requestReminderPermission } from "@services/wateringReminders";
import {
  summariseWatering,
  describeWaterFrequency,
  describeRhythm,
  currentSeason,
  describeSeasonForWatering,
  Hemisphere,
  Season,
} from "@services/wateringInsights";
import { useGoBack } from "@hooks/useGoBack";

/** One symbol, filling up — rather than 💧💦🌊. */
const AMOUNTS: Array<{ amount: WaterAmount; label: string; icon: SFSymbol }> = [
  { amount: WaterAmount.Light, label: "Light", icon: "drop" },
  { amount: WaterAmount.Moderate, label: "Moderate", icon: "drop.halffull" },
  { amount: WaterAmount.Heavy, label: "Heavy", icon: "drop.fill" },
];

const SEASON_ICON: Record<Season, SFSymbol> = {
  spring: "leaf.fill",
  summer: "sun.max.fill",
  autumn: "wind",
  winter: "snowflake",
};

export default function WaterLogScreen() {
  const goBack = useGoBack("/my-plants");
  const { plantId, plantName } = useLocalSearchParams<{ plantId: string; plantName?: string }>();

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
      const [history, plant, prefs] = await Promise.all([fetchWaterLogs(plantId), fetchPlant(plantId), getUserPreferences()]);
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

  /** Reminders follow the history. Best effort: never at the cost of the log. */
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

      // Date order, not prepended: entries can be backdated.
      setLogs((current) => [saved, ...current].sort((a, b) => b.date.getTime() - a.date.getTime()));
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
          // Remove immediately; restore if the delete fails.
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

  const header = <ScreenHeader onBack={goBack} title="Watering" subtitle={plantName || undefined} />;

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <ActivityIndicator size="large" color={Colors.brand} style={styles.loader} />
      </View>
    );
  }

  // Reached without a plant, every tap would silently do nothing. Say so.
  if (!plantId) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.stateCard}>
          <IconTile icon="drop.fill" color={Tiles.grey} size={52} />
          <Text style={styles.stateTitle}>No plant selected</Text>
          <Text style={styles.stateBody}>Open a plant from your collection to log watering.</Text>
        </View>
      </View>
    );
  }

  const rhythm = summariseWatering(logs);
  const season = currentSeason(hemisphere);

  // Reminders default to on; the iOS permission is asked for here, once
  // there's enough history for a reminder to mean something.
  const reminderRow = (() => {
    if (!remindersOn || !reminderChecked || !permission) return null;

    if (!permission.granted) {
      if (!rhythm || rhythm.medianDays < 1) return null;
      return permission.canAskAgain ? (
        <ListRow icon="bell.fill" tint={Tiles.red} title="Get a reminder" subtitle="When it's usually time to check" onPress={handleAllowReminders} />
      ) : (
        <ListRow icon="bell.slash.fill" tint={Tiles.grey} title="Notifications are off" subtitle="Turn them on for Sorrel in Settings" onPress={() => void Linking.openSettings()} />
      );
    }

    return (
      <ListRow
        icon="bell.fill"
        tint={Tiles.red}
        title="Reminder"
        subtitle={
          nextReminder
            ? `We'll remind you on ${nextReminder.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}`
            : "Log a couple of waterings and Sorrel will remind you when it's usually time"
        }
      />
    );
  })();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {header}

      <View style={styles.form}>
        <View style={styles.formRow}>
          <Text style={styles.formLabel}>Date</Text>
          {/* Future dates refused: a watering that hasn't happened isn't history. */}
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="compact"
            maximumDate={new Date()}
            onChange={(_event, date) => {
              if (date) setSelectedDate(date);
            }}
            accentColor={Colors.brand}
          />
        </View>

        <Text style={styles.formLabel}>Amount</Text>
        <View style={styles.amounts}>
          {AMOUNTS.map(({ amount, label, icon }) => {
            const active = selectedAmount === amount;
            return (
              <Pressable
                key={amount}
                style={[styles.amount, active && styles.amountActive]}
                onPress={() => setSelectedAmount(amount)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <Icon name={icon} size={22} color={active ? Colors.brand : Colors.textSecondary} weight="semibold" />
                <Text style={[styles.amountText, active && styles.amountTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          style={styles.notes}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add a note (optional)"
          placeholderTextColor={Colors.textDisabled}
          multiline
          maxLength={280}
          returnKeyType="done"
          blurOnSubmit
        />

        <Button label="Log watering" icon="drop.fill" onPress={handleAddLog} loading={saving} disabled={saving} />
      </View>

      {/* Every line has something real behind it: the species notes, this
          user's own rhythm, and the season for their hemisphere. */}
      <ListGroup
        title="Guidance"
        footer={`Check the soil before watering — light, warmth and pot size change how fast it dries.${care?.unreviewed ? " These care notes haven't been reviewed by a horticulturist yet." : ""}`}
      >
        {care ? (
          <ListRow
            icon="leaf.fill"
            tint={Tiles.green}
            title={care.matchedAt === "genus" ? "For this genus" : "For this plant"}
            subtitle={`${care.matchedAt === "genus" ? "Usually" : "It"} ${describeWaterFrequency(care.guide.water.frequency)}.${care.guide.water.seasonalModifier ? ` ${care.guide.water.seasonalModifier}` : ""}`}
          />
        ) : null}
        {rhythm ? <ListRow icon="clock.fill" tint={Tiles.blue} title="Your rhythm" subtitle={describeRhythm(rhythm)} /> : null}
        <ListRow
          icon={SEASON_ICON[season]}
          tint={Tiles.amber}
          title={season.charAt(0).toUpperCase() + season.slice(1)}
          subtitle={describeSeasonForWatering(season)}
        />
        {reminderRow}
      </ListGroup>

      {logs.length === 0 ? (
        <View style={styles.emptyHistory}>
          <Text style={styles.emptyTitle}>No waterings logged yet</Text>
          <Text style={styles.emptyBody}>Your history will appear here.</Text>
        </View>
      ) : (
        <ListGroup title="History" footer="Press and hold an entry to delete it.">
          {logs.map((item) => {
            const amount = AMOUNTS.find((a) => a.amount === item.amount);
            // Entries saved before the amount was recorded just say "Watered".
            const detail = [amount ? `${amount.label} watering` : "Watered", item.notes].filter(Boolean).join(" · ");
            return (
              <ListRow
                key={item.id}
                icon={amount?.icon ?? "drop"}
                tint={Tiles.blue}
                title={new Date(item.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                subtitle={detail}
                onLongPress={() => handleDeleteLog(item.id)}
              />
            );
          })}
        </ListGroup>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    paddingBottom: Spacing.extra,
  },
  loader: {
    marginTop: Spacing.spacious,
  },
  stateCard: {
    margin: Spacing.default,
    alignItems: "center",
    padding: Spacing.loose,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    gap: Spacing.tight,
  },
  stateTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    marginTop: Spacing.tight,
  },
  stateBody: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  form: {
    marginHorizontal: Spacing.default,
    marginBottom: Spacing.loose,
    padding: Spacing.default,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    gap: Spacing.default - 4,
  },
  formRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  formLabel: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
  },
  amounts: {
    flexDirection: "row",
    gap: Spacing.tight,
  },
  amount: {
    flex: 1,
    minHeight: 68,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.separator,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  amountActive: {
    borderColor: Colors.brand,
    backgroundColor: Colors.brandTint,
  },
  amountText: {
    ...Typography.caption1,
    color: Colors.textSecondary,
  },
  amountTextActive: {
    color: Colors.brandDark,
    fontWeight: "600",
  },
  notes: {
    ...Typography.body,
    minHeight: 64,
    paddingHorizontal: Spacing.default - 2,
    paddingTop: Spacing.default - 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
    color: Colors.textPrimary,
    textAlignVertical: "top",
  },
  emptyHistory: {
    alignItems: "center",
    paddingVertical: Spacing.loose,
    gap: 4,
  },
  emptyTitle: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
  },
  emptyBody: {
    ...Typography.caption1,
    color: Colors.textSecondary,
  },
});
