import sys

path = "app/chat/[appointmentId].tsx"
with open(path, "r") as f:
    content = f.read()

original = content

# 1. Add ImagePicker and Image imports
old_imports = '''import AsyncStorage from "@react-native-async-storage/async-storage";
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
import * as Notifications from "expo-notifications";
import { socket } from "../lib/socket";'''
new_imports = '''import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
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
import { socket } from "../lib/socket";'''
assert old_imports in content, "IMPORTS ANCHOR NOT FOUND"
content = content.replace(old_imports, new_imports, 1)

# 2. Replace sendMessage with a version that supports an optional pending image,
#    and add a handlePickImage function.
old_send = '''  const sendMessage = () => {
    const senderId = effectiveSelfId;
    const receiverId = otherUserId ? String(otherUserId) : "";

    if (!text.trim() || !senderId || !receiverId || !appointmentId) {
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
      },
      (response: any) => {
        setSending(false);

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
  };'''
new_send = '''  const [pendingImage, setPendingImage] = useState<string | null>(null);

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
  };'''
assert old_send in content, "SEND ANCHOR NOT FOUND"
content = content.replace(old_send, new_send, 1)

# 3. Render an image in the bubble when present
old_bubble = '''          <Text
            style={[
              styles.messageText,
              mine ? styles.myMessageText : styles.otherMessageText,
            ]}
          >
            {item?.text || ""}
          </Text>'''
new_bubble = '''          {item?.imageBase64 && (
            <Image
              source={{ uri: item.imageBase64 }}
              style={styles.messageImage}
              resizeMode="cover"
            />
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
          )}'''
assert old_bubble in content, "BUBBLE ANCHOR NOT FOUND"
content = content.replace(old_bubble, new_bubble, 1)

# 4. Add image preview + picker button to the input bar
old_input_bar = '''        <View style={styles.inputBar}>
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
        </View>'''
new_input_bar = '''        {pendingImage && (
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
        </View>'''
assert old_input_bar in content, "INPUT BAR ANCHOR NOT FOUND"
content = content.replace(old_input_bar, new_input_bar, 1)

# 5. Add new styles
old_styles_marker = "const styles = StyleSheet.create({"
new_styles_marker = '''const styles = StyleSheet.create({
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
  },'''
assert old_styles_marker in content, "STYLES ANCHOR NOT FOUND"
content = content.replace(old_styles_marker, new_styles_marker, 1)

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Chat screen patched with image support.")
