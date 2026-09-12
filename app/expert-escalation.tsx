import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";

interface Message {
  id: string;
  author: "user" | "expert";
  text: string;
  timestamp: string;
  avatar?: string;
}

interface ExpertTicket {
  id: string;
  status: "pending" | "assigned" | "resolved";
  expertName?: string;
  expertAvatar?: string;
  position?: number;
  estimatedWaitTime?: string;
  messages: Message[];
  createdAt: string;
}

export default function ExpertEscalationScreen() {
  const router = useRouter();
  const { plantId, plantName } = useLocalSearchParams();
  const [ticket, setTicket] = useState<ExpertTicket | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadOrCreateTicket();
  }, []);

  const loadOrCreateTicket = async () => {
    setLoading(true);
    try {
      // TODO: Load existing ticket or create new one from backend
      const mockTicket: ExpertTicket = {
        id: "ticket-" + Date.now(),
        status: "pending",
        position: 3,
        estimatedWaitTime: "2-4 hours",
        messages: [
          {
            id: "msg-1",
            author: "user",
            text: "Hi, my plant has yellow leaves. Can you help?",
            timestamp: new Date(Date.now() - 60000).toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
      };

      setTicket(mockTicket);
    } catch (error) {
      console.error("Failed to load ticket:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !ticket) return;

    setSending(true);
    try {
      const newMessage: Message = {
        id: "msg-" + Date.now(),
        author: "user",
        text: messageText,
        timestamp: new Date().toISOString(),
      };

      setTicket({
        ...ticket,
        messages: [...ticket.messages, newMessage],
      });

      setMessageText("");

      // TODO: Send to backend
      // TODO: Receive response from expert (simulate with delay)
      setTimeout(() => {
        const expertReply: Message = {
          id: "msg-" + (Date.now() + 1),
          author: "expert",
          text: "Thanks for providing that information. Let me help you with that. Yellow leaves can indicate overwatering, nutrient deficiency, or pests. Can you tell me...",
          timestamp: new Date().toISOString(),
        };

        setTicket((prev) =>
          prev
            ? { ...prev, messages: [...prev.messages, expertReply] }
            : null
        );
      }, 1000);
    } finally {
      setSending(false);
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.leaf} style={styles.loader} />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load expert chat</Text>
        <Button label="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Expert Help</Text>
          <Text style={styles.plant}>{plantName}</Text>
        </View>
      </View>

      {ticket.status === "pending" && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusIcon}>⏳</Text>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>Position in Queue: #{ticket.position}</Text>
            <Text style={styles.statusText}>
              Estimated wait: {ticket.estimatedWaitTime}
            </Text>
          </View>
        </View>
      )}

      {ticket.status === "assigned" && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusIcon}>✅</Text>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>Expert Assigned</Text>
            <Text style={styles.statusText}>{ticket.expertName}</Text>
          </View>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={ticket.messages}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.author === "user"
                ? styles.userMessage
                : styles.expertMessage,
            ]}
          >
            <Text style={[
              styles.messageText,
              item.author === "user"
                ? styles.userMessageText
                : styles.expertMessageText,
            ]}>
              {item.text}
            </Text>
            <Text style={[
              styles.timestamp,
              item.author === "user"
                ? styles.userTimestamp
                : styles.expertTimestamp,
            ]}>
              {new Date(item.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        )}
      />

      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          placeholder="Type your message..."
          placeholderTextColor={Colors.textDisabled}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={500}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!messageText.trim() || sending}
        >
          <Text style={styles.sendIcon}>
            {sending ? "..." : "➤"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  statusBanner: {
    flexDirection: "row",
    backgroundColor: Colors.glass,
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.default,
    alignItems: "center",
    gap: Spacing.default,
  },
  statusIcon: {
    fontSize: 24,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
  },
  statusText: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.default,
  },
  messageBubble: {
    marginBottom: Spacing.default,
    maxWidth: "85%",
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.compact,
    borderRadius: 12,
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: Colors.leaf,
  },
  expertMessage: {
    alignSelf: "flex-start",
    backgroundColor: Colors.glass,
  },
  messageText: {
    fontSize: Typography.body.fontSize,
    lineHeight: 20,
  },
  userMessageText: {
    color: "#FFFFFF",
  },
  expertMessageText: {
    color: Colors.textPrimary,
  },
  timestamp: {
    fontSize: Typography.caption2.fontSize,
    marginTop: Spacing.compact,
  },
  userTimestamp: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  expertTimestamp: {
    color: Colors.textDisabled,
  },
  inputArea: {
    flexDirection: "row",
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.default,
    borderTopWidth: 1,
    borderTopColor: Colors.glass,
    gap: Spacing.compact,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.glass,
    borderRadius: 24,
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.compact,
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.leaf,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: Colors.textDisabled,
  },
  sendIcon: {
    fontSize: 20,
    color: "#FFFFFF",
  },
  errorText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    textAlign: "center",
    marginVertical: Spacing.spacious,
  },
});
