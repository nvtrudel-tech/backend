import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { socket } from "../lib/socket";

const API_URL = "https://backend-tknm.onrender.com/api";

export default function AppointmentChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const appointmentId = useMemo(() => {
    const value = params.appointmentId;
    return Array.isArray(value) ? value[0] : value;
  }, [params.appointmentId]);

  const otherUserId = useMemo(() => {
    const value = params.otherUserId;
    return Array.isArray(value) ? value[0] : value;
  }, [params.otherUserId]);

  const otherUserName = useMemo(() => {
    const value = params.otherUserName;
    return Array.isArray(value) ? value[0] : value;
  }, [params.otherUserName]);

  const selfUserId = useMemo(() => {
    const value = params.selfUserId;
    return Array.isArray(value) ? value[0] : value;
  }, [params.selfUserId]);

  const effectiveSelfId = useMemo(() => {
    if (selfUserId) return String(selfUserId);
    if (currentUser?._id) return String(currentUser._id);
    return "";
  }, [selfUserId, currentUser]);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const timeA = new Date(a?.createdAt || 0).getTime();
      const timeB = new Date(b?.createdAt || 0).getTime();
      return timeA - timeB;
    });
  }, [messages]);

  const extractId = (value: any) => {
    if (!value) return "";
    if (typeof value === "object") {
      return String(value._id || value.id || "");
    }
    return String(value);
  };

  const getSenderId = (message: any) => {
    if (!message) return "";

    const candidates = [
      message?.sender?._id,
      message?.sender,
      message?.senderId,
      message?.from?._id,
      message?.from,
      message?.user?._id,
      message?.user,
      message?.author?._id,
      message?.author,
    ];

    for (const candidate of candidates) {
      const id = extractId(candidate);
      if (id) return id;
    }

    return "";
  };

  const getReceiverId = (message: any) => {
    if (!message) return "";

    const candidates = [
      message?.receiver?._id,
      message?.receiver,
      message?.receiverId,
      message?.to?._id,
      message?.to,
    ];

    for (const candidate of candidates) {
      const id = extractId(candidate);
      if (id) return id;
    }

    return "";
  };

  const isMessageMine = (message: any) => {
    const senderId = getSenderId(message);
    const receiverId = getReceiverId(message);

    if (senderId && effectiveSelfId && senderId === effectiveSelfId) {
      return true;
    }

    if (senderId && otherUserId && senderId === String(otherUserId)) {
      return false;
    }

    if (receiverId && otherUserId && receiverId === String(otherUserId)) {
      return true;
    }

    if (receiverId && effectiveSelfId && receiverId === effectiveSelfId) {
      return false;
    }

    console.log("UNRESOLVED MESSAGE SIDE", {
      message,
      senderId,
      receiverId,
      effectiveSelfId,
      otherUserId,
      conversation,
    });

    return false;
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const userString = await AsyncStorage.getItem("user");
        const parsedUser = userString ? JSON.parse(userString) : null;

        if (!mounted) return;
        setCurrentUser(parsedUser);

        if (!appointmentId) {
          setLoading(false);
          return;
        }

        const convRes = await fetch(`${API_URL}/chat/conversation/${appointmentId}`, {
          method: "POST",
        });

        if (!convRes.ok) {
          throw new Error("This chat is not available.");
        }

        const convData = await convRes.json();
        if (mounted) {
          setConversation(convData);
        }

        const msgRes = await fetch(`${API_URL}/chat/messages/${appointmentId}`);
        if (!msgRes.ok) {
          throw new Error("Failed to load messages.");
        }

        const data = await msgRes.json();

        if (!mounted) return;
        setMessages(Array.isArray(data) ? data : []);

        console.log("CHAT PARAMS", {
          appointmentId,
          selfUserId,
          otherUserId,
          parsedUserId: parsedUser?._id,
        });

        console.log("CHAT CONVERSATION", convData);
        console.log("CHAT MESSAGES RAW", data);

        const activeUserId = selfUserId
          ? String(selfUserId)
          : parsedUser?._id
          ? String(parsedUser._id)
          : "";

        if (activeUserId) {
          await fetch(`${API_URL}/chat/read/${appointmentId}/${activeUserId}`, {
            method: "PUT",
          }).catch(() => {});

          socket.emit("join_conversation", {
            appointmentId: String(appointmentId),
            userId: activeUserId,
          });
        }
      } catch (error) {
        console.error("Chat init error:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const onReceiveMessage = (message: any) => {
      const msgAppointmentId =
        typeof message?.appointment === "object"
          ? message?.appointment?._id
          : message?.appointment;

      if (String(msgAppointmentId) !== String(appointmentId)) return;

      console.log("RECEIVED SOCKET MESSAGE", message);

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
  }, [appointmentId, selfUserId, otherUserId]);

  const sendMessage = () => {
    const senderId = effectiveSelfId;
    const receiverId = otherUserId ? String(otherUserId) : "";

    if (!text.trim() || !senderId || !receiverId || !appointmentId) {
      return;
    }

    console.log("SEND MESSAGE PAYLOAD", {
      appointmentId: String(appointmentId),
      senderId,
      receiverId,
      text: text.trim(),
    });

    setSending(true);

    socket.emit(
      "send_message",
      {
        appointmentId: String(appointmentId),
        senderId,
        receiverId,
        text: text.trim(),
      },
      (response: any) => {
        setSending(false);

        console.log("SEND MESSAGE RESPONSE", response);

        if (!response?.ok) {
          console.log("send_message failed:", response?.message);
          return;
        }

        setText("");

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
  };

  const renderItem = ({ item }: any) => {
    const senderId = getSenderId(item);
    const receiverId = getReceiverId(item);
    const mine = isMessageMine(item);

    console.log("RENDER MESSAGE", {
      text: item?.text,
      senderId,
      receiverId,
      effectiveSelfId,
      otherUserId,
      mine,
      raw: item,
    });

    return (
      <View
        style={[
          styles.messageRow,
          mine ? styles.messageRowMine : styles.messageRowOther,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            mine ? styles.myBubble : styles.otherBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              mine ? styles.myMessageText : styles.otherMessageText,
            ]}
          >
            {item?.text || ""}
          </Text>

          <Text
            style={[
              styles.timeText,
              mine ? styles.myTimeText : styles.otherTimeText,
            ]}
          >
            {item?.createdAt
              ? new Date(item.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
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
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>{otherUserName || "Conversation"}</Text>
            <Text style={styles.headerSubtitle}>Appointment chat</Text>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={sortedMessages}
          keyExtractor={(item, index) => String(item?._id || index)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#6b7280"
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
    backgroundColor: "#efeae2",
  },
  container: {
    flex: 1,
    backgroundColor: "#efeae2",
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
    paddingHorizontal: 10,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  messageRow: {
    width: "100%",
    marginBottom: 8,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  myBubble: {
    backgroundColor: "#dcf8c6",
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: "#111827",
  },
  otherMessageText: {
    color: "#111827",
  },
  timeText: {
    fontSize: 11,
    marginTop: 4,
  },
  myTimeText: {
    color: "#6b7280",
    textAlign: "right",
    alignSelf: "flex-end",
  },
  otherTimeText: {
    color: "#6b7280",
    textAlign: "left",
    alignSelf: "flex-start",
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
    color: "#111827",
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