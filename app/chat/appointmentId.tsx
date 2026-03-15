import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { socket } from "../../backend/lib/socket";

const API_URL = "https://backend-tknm.onrender.com/api";

export default function AppointmentChatScreen() {
  const router = useRouter();
  const { appointmentId, otherUserId, otherUserName } = useLocalSearchParams<{
    appointmentId: string;
    otherUserId: string;
    otherUserName: string;
  }>();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const safeAppointmentId = useMemo(
    () => (Array.isArray(appointmentId) ? appointmentId[0] : appointmentId),
    [appointmentId]
  );

  const safeOtherUserId = useMemo(
    () => (Array.isArray(otherUserId) ? otherUserId[0] : otherUserId),
    [otherUserId]
  );

  const safeOtherUserName = useMemo(
    () => (Array.isArray(otherUserName) ? otherUserName[0] : otherUserName),
    [otherUserName]
  );

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const userString = await AsyncStorage.getItem("user");
        const parsedUser = userString ? JSON.parse(userString) : null;

        if (!mounted) return;
        setCurrentUser(parsedUser);

        if (!parsedUser?._id || !safeAppointmentId) {
          setLoading(false);
          return;
        }

        const convRes = await fetch(`${API_URL}/chat/conversation/${safeAppointmentId}`, {
          method: "POST",
        });

        if (!convRes.ok) {
          throw new Error("This chat is not available.");
        }

        const msgRes = await fetch(`${API_URL}/chat/messages/${safeAppointmentId}`);
        if (!msgRes.ok) {
          throw new Error("Failed to load messages.");
        }

        const data = await msgRes.json();

        if (!mounted) return;
        setMessages(Array.isArray(data) ? data : []);

        socket.emit("join_conversation", {
          appointmentId: safeAppointmentId,
          userId: parsedUser._id,
        });
      } catch (error) {
        console.error("Chat init error:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    init();

    const onReceiveMessage = (message: any) => {
      const msgAppointmentId =
        typeof message?.appointment === "object"
          ? message?.appointment?._id
          : message?.appointment;

      if (String(msgAppointmentId) !== String(safeAppointmentId)) return;

      setMessages((prev) => {
        const exists = prev.some((m) => String(m._id) === String(message._id));
        if (exists) return prev;
        return [...prev, message];
      });

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };

    socket.on("receive_message", onReceiveMessage);

    return () => {
      mounted = false;
      socket.off("receive_message", onReceiveMessage);
    };
  }, [safeAppointmentId]);

  const sendMessage = async () => {
    if (!text.trim() || !currentUser?._id || !safeAppointmentId || !safeOtherUserId) return;

    setSending(true);

    const payload = {
      appointmentId: safeAppointmentId,
      senderId: currentUser._id,
      receiverId: safeOtherUserId,
      text: text.trim(),
    };

    socket.emit("send_message", payload, (response: any) => {
      setSending(false);

      if (!response?.ok) {
        console.log("send_message failed:", response?.message);
        return;
      }

      setText("");
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
  };

  const renderItem = ({ item }: any) => {
    const senderId =
      typeof item?.sender === "object" ? item?.sender?._id : item?.sender;

    const isMine = String(senderId) === String(currentUser?._id);

    return (
      <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}>
        <View style={[styles.messageBubble, isMine ? styles.myBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isMine ? styles.myMessageText : styles.otherMessageText]}>
            {item.text}
          </Text>
          <Text style={[styles.timeText, isMine ? styles.myTimeText : styles.otherTimeText]}>
            {new Date(item.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>{safeOtherUserName || "Conversation"}</Text>
            <Text style={styles.headerSubtitle}>Appointment chat</Text>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => String(item._id || index)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={text}
            onChangeText={setText}
            multiline
            editable={!sending}
          />

          <TouchableOpacity
            style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  backButton: {
    marginRight: 8,
    padding: 4,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    paddingBottom: 24,
  },
  messageRow: {
    marginBottom: 10,
    flexDirection: "row",
  },
  messageRowMine: {
    justifyContent: "flex-end",
  },
  messageRowOther: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "78%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  myBubble: {
    backgroundColor: "#2563eb",
    borderBottomRightRadius: 6,
  },
  otherBubble: {
    backgroundColor: "#f3f4f6",
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: "#ffffff",
  },
  otherMessageText: {
    color: "#111827",
  },
  timeText: {
    fontSize: 11,
    marginTop: 5,
    alignSelf: "flex-end",
  },
  myTimeText: {
    color: "rgba(255,255,255,0.8)",
  },
  otherTimeText: {
    color: "#6b7280",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#fff",
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});