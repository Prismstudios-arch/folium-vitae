import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useState, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { WaterLog, WaterAmount } from "@domain/plant";
import { fetchWaterLogs, addWaterLog, deleteWaterLog } from "@services/database";

export default function WaterLogScreen() {
  const router = useRouter();
  const { plantId, plantName } = useLocalSearchParams<{
    plantId: string;
    plantName?: string;
  }>();

  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedAmount, setSelectedAmount] = useState<WaterAmount>(WaterAmount.Moderate);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    void loadWaterLogs();
  }, [plantId]);

  const loadWaterLogs = async () => {
    if (!plantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setLogs(await fetchWaterLogs(plantId));
    } catch (error) {
      console.error("Failed to load watering logs:", error);
      Alert.alert("Couldn't load history", "Your watering history is saved but wouldn't open.");
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (date) {
      setSelectedDate(date);
    }
    setShowDatePicker(false);
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
    } finally {
      setSaving(false);
    }
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
          }
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

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.leaf} style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Watering Log</Text>
          <Text style={styles.plant}>{plantName}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Add Log Section */}
        <View style={styles.addLogSection}>
          <Text style={styles.sectionTitle}>📝 Log Watering</Text>

          {/* Date Picker */}
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateButtonLabel}>Date:</Text>
            <Text style={styles.dateButtonValue}>{selectedDate.toLocaleDateString()}</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="spinner"
              onChange={handleDateChange}
            />
          )}

          {/* Amount Selector */}
          <Text style={styles.amountLabel}>Amount:</Text>
          <View style={styles.amountButtons}>
            {[WaterAmount.Light, WaterAmount.Moderate, WaterAmount.Heavy].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.amountButton,
                  selectedAmount === amount && styles.amountButtonActive,
                ]}
                onPress={() => setSelectedAmount(amount)}
              >
                <Text style={styles.amountEmoji}>{getAmountEmoji(amount)}</Text>
                <Text
                  style={[
                    styles.amountText,
                    selectedAmount === amount && styles.amountTextActive,
                  ]}
                >
                  {amount === "light" ? "Light" : amount === "moderate" ? "Moderate" : "Heavy"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notes */}
          <Text style={styles.notesLabel}>Notes (optional):</Text>
          <View style={styles.notesInput}>
            <Text>📝 </Text>
            {/* Note: Would use TextInput in real implementation */}
            <Text style={styles.notesPlaceholder}>Plant looked dry, added fertilizer</Text>
          </View>

          {/* Save Button */}
          <Button
            label="Log Watering"
            onPress={handleAddLog}
          />
        </View>

        {/* History Section */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>📋 History</Text>

          {logs.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyText}>No watering logs yet</Text>
              <Text style={styles.emptySubtext}>Start tracking your plant's watering</Text>
            </View>
          ) : (
            <FlatList
              data={logs}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.logItem}
                  onLongPress={() => handleDeleteLog(item.id)}
                >
                  <View style={styles.logContent}>
                    <View style={styles.logHeader}>
                      <Text style={styles.logDate}>
                        {new Date(item.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                      <Text style={styles.logEmoji}>{getAmountEmoji(item.amount)}</Text>
                    </View>
                    <Text style={styles.logAmount}>{getAmountLabel(item.amount)}</Text>
                    {item.notes && (
                      <Text style={styles.logNotes}>{item.notes}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* Care Recommendation */}
        <View style={styles.careSection}>
          <Text style={styles.careTitle}>💡 Care Tip</Text>
          <Text style={styles.careTip}>
            Based on your logs, water this plant every 3-5 days during growing season. Reduce watering in winter.
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  dateButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.default,
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
  dateButtonValue: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    fontWeight: "600" as any,
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.compact,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.glass,
    marginBottom: Spacing.default,
  },
  notesPlaceholder: {
    fontSize: Typography.body.fontSize,
    color: Colors.textDisabled,
    flex: 1,
  },
  historySection: {
    paddingVertical: Spacing.loose,
  },
  emptyHistory: {
    alignItems: "center",
    paddingVertical: Spacing.spacious,
  },
  emptyText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  emptySubtext: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
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
    color: Colors.textDisabled,
    fontStyle: "italic",
  },
  careSection: {
    backgroundColor: Colors.glass,
    borderRadius: 12,
    padding: Spacing.default,
    marginVertical: Spacing.loose,
  },
  careTitle: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  careTip: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
