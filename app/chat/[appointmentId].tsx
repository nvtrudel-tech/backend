import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { socket } from "../lib/socket";

const API_URL = "http://172.20.10.3:6000/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function AppointmentChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [currentUser, setCurrentUser] = useState<any>(null);
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

    if (senderId && effectiveSelfId && senderId === effectiveSelfId) return true;
    if (senderId && otherUserId && senderId === String(otherUserId)) return false;
    if (receiverId && otherUserId && receiverId === String(otherUserId)) return true;
    if (receiverId && effectiveSelfId && receiverId === effectiveSelfId) return false;

    return false;
  };

  const markConversationRead = async (activeUserId: string) => {
    try {
      await fetch(`${API_URL}/chat/read/${appointmentId}/${activeUserId}`, {
        method: "PUT",
      }).catch(() => {});
    } catch (error) {
      console.error("Mark read error:", error);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("chat-messages", {
          name: "Chat Messages",
          importance: Notifications.AndroidImportance.MAX,
          sound: "default",
          vibrationPattern: [0, 250, 250, 250],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      console.log("Notification permission status:", finalStatus);
    } catch (error) {
      console.error("Notification permission error:", error);
    }
  };

  useEffect(() => {
    requestNotificationPermission();

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;

      if (data?.appointmentId) {
        router.push({
          pathname: "/chat/[appointmentId]",
          params: {
            appointmentId: String(data.appointmentId),
            otherUserId: String(data.otherUserId || ""),
            otherUserName: String(data.otherUserName || "Conversation"),
            selfUserId: String(data.selfUserId || ""),
          },
        });
      }
    });

    return () => {
      responseSub.remove();
    };
  }, [router]);

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

        const msgRes = await fetch(`${API_URL}/chat/messages/${appointmentId}`);
        if (!msgRes.ok) {
          throw new Error("Failed to load messages.");
        }

        const data = await msgRes.json();

        if (!mounted) return;
        setMessages(Array.isArray(data) ? data : []);

        const activeUserId = selfUserId
          ? String(selfUserId)
          : parsedUser?._id
            ? String(parsedUser._id)
            : "";

        if (activeUserId) {
          await markConversationRead(activeUserId);

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

    const onReceiveMessage = async (message: any) => {
      const msgAppointmentId =
        typeof message?.appointment === "object"
          ? message?.appointment?._id
          : message?.appointment;

      if (String(msgAppointmentId) !== String(appointmentId)) return;

      setMessages((prev) => {
        const exists = prev.some((m) => String(m._id) === String(message._id));
        if (exists) return prev;
        return [...prev, message];
      });

      const mine = isMessageMine(message);

      if (!mine && effectiveSelfId) {
        await markConversationRead(effectiveSelfId);
      }

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };

    socket.on("receive_message", onReceiveMessage);

    return () => {
      mounted = false;
      socket.off("receive_message", onReceiveMessage);
    };
  }, [appointmentId, selfUserId, effectiveSelfId]);

  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.4,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]?.base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setPendingImage(base64Image);
    }
  };

  const sendMessage = () => {
    const senderId = effectiveSelfId;
    const receiverId = otherUserId ? String(otherUserId) : "";

    if ((!text.trim() && !pendingImage) || !senderId || !receiverId || !appointmentId) {
      return;
    }

    setSending(true);

    socket.emit(
      "send_message",
      {
        appointmentId: String(appointmentId),
        senderId,
        receiverId,
        text: text.trim(),
        imageBase64: pendingImage || undefined,
      },
      (response: any) => {
        setSending(false);

        if (!response?.ok) {
          console.log("send_message failed:", response?.message);
          return;
        }

        setText("");
        setPendingImage(null);

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
  };

  const renderItem = ({ item }: any) => {
    const mine = isMessageMine(item);

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
          {item?.imageBase64 && (
            <TouchableOpacity onPress={() => setViewingImage(item.imageBase64)}>
              <Image
                source={{ uri: item.imageBase64 }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}

          {!!item?.text && (
            <Text
              style={[
                styles.messageText,
                mine ? styles.myMessageText : styles.otherMessageText,
              ]}
            >
              {item.text}
            </Text>
          )}

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
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {pendingImage && (
          <View style={styles.pendingImageBar}>
            <Image source={{ uri: pendingImage }} style={styles.pendingImageThumb} />
            <TouchableOpacity onPress={() => setPendingImage(null)}>
              <Ionicons name="close-circle" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handlePickImage}
            disabled={sending}
          >
            <Ionicons name="image-outline" size={24} color="#2563eb" />
          </TouchableOpacity>

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
            style={[
              styles.sendButton,
              (!text.trim() && !pendingImage) || sending ? styles.sendButtonDisabled : null,
            ]}
            onPress={sendMessage}
            disabled={(!text.trim() && !pendingImage) || sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={!!viewingImage}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingImage(null)}
      >
        <TouchableOpacity
          style={styles.imageViewerBackdrop}
          activeOpacity={1}
          onPress={() => setViewingImage(null)}
        >
          {viewingImage && (
            <Image
              source={{ uri: viewingImage }}
              style={styles.imageViewerFull}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            style={styles.imageViewerClose}
            onPress={() => setViewingImage(null)}
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  imageViewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageViewerFull: {
    width: "100%",
    height: "80%",
  },
  imageViewerClose: {
    position: "absolute",
    top: 50,
    right: 20,
    padding: 8,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 6,
  },
  attachButton: {
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  pendingImageBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  pendingImageThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
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
    paddingBottom: 12,
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
    backgroundColor: "#2563eb",
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
    color: "#ffffff",
  },
  otherMessageText: {
    color: "#111827",
  },
  timeText: {
    fontSize: 11,
    marginTop: 4,
  },
  myTimeText: {
    color: "rgba(255,255,255,0.8)",
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