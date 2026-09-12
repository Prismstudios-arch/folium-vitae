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

interface WaterLog {
  id: string;
  date: string;
  amount: "light" | "moderate" | "heavy";
  notes?: string;
  createdAt: string;
}

export default function WaterLogScreen() {
  const router = useRouter();
  const { plantId, plantName } = useLocalSearchParams();
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedAmount, setSelectedAmount] = useState<"light" | "moderate" | "heavy">("moderate");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadWaterLogs();
  }, []);

  const loadWaterLogs = async () => {
    setLoading(true);
    try {
      // TODO: Load from backend API
      const mockLogs: WaterLog[] = [
        {
          id: "log-1",
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          amount: "moderate",
          notes: "Plant looked dry",
          createdAt: new Date().toISOString(),
        },
        {
          id: "log-2",
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          amount: "heavy",
          notes: "Summer watering",
          createdAt: new Date().toISOString(),
        },
      ];
      setLogs(mockLogs);
    } catch (error) {
      Alert.alert("Error", "Failed to load watering logs");
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
    try {
      // TODO: Save to backend
      const newLog: WaterLog = {
        id: "log-" + Date.now(),
        date: selectedDate.toISOString(),
        amount: selectedAmount,
        notes: notes || undefined,
        createdAt: new Date().toISOString(),
      };

      setLogs([newLog, ...logs]);

      // TODO: Schedule next watering reminder based on plant type
      Alert.alert("Success", `Plant watered on ${selectedDate.toLocaleDateString()}`);

      // Reset form
      setSelectedDate(new Date());
      setSelectedAmount("moderate");
      setNotes("");
    } catch (error) {
      Alert.alert("Error", "Failed to save watering log");
    }
  };

  const handleDeleteLog = (logId: string) => {
    Alert.alert("Delete Entry", "Are you sure you want to delete this watering log?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        onPress: () => {
          // TODO: Delete from backend
          setLogs(logs.filter((l) => l.id !== logId));
        },
        style: "destructive",
      },
    ]);
  };

  const getAmountLabel = (amount: string) => {
    const labels: Record<string, string> = {
      light: "Light watering",
      moderate: "Moderate watering",
      heavy: "Heavy watering",
    };
    return labels[amount] || amount;
  };

  const getAmountEmoji = (amount: string) => {
    const emojis: Record<string, string> = {
      light: "💧",
      moderate: "💦",
      heavy: "🌊",
    };
    return emojis[amount] || "💧";
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
            {(["light", "moderate", "heavy"] as const).map((amount) => (
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
