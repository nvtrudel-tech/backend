import sys

path = "app/chat/[appointmentId].tsx"
with open(path, "r") as f:
    content = f.read()

original = content

# 1. Add Modal to imports
old_imports = '''import {
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
} from "react-native";'''
new_imports = '''import {
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
} from "react-native";'''
assert old_imports in content, "IMPORTS ANCHOR NOT FOUND"
content = content.replace(old_imports, new_imports, 1)

# 2. Add state for the full-screen image, right after pendingImage state
old_state = '''  const [pendingImage, setPendingImage] = useState<string | null>(null);'''
new_state = '''  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);'''
assert old_state in content, "STATE ANCHOR NOT FOUND"
content = content.replace(old_state, new_state, 1)

# 3. Wrap the message image in a TouchableOpacity that opens the viewer
old_bubble_image = '''          {item?.imageBase64 && (
            <Image
              source={{ uri: item.imageBase64 }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          )}'''
new_bubble_image = '''          {item?.imageBase64 && (
            <TouchableOpacity onPress={() => setViewingImage(item.imageBase64)}>
              <Image
                source={{ uri: item.imageBase64 }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}'''
assert old_bubble_image in content, "BUBBLE IMAGE ANCHOR NOT FOUND"
content = content.replace(old_bubble_image, new_bubble_image, 1)

# 4. Add the full-screen viewer Modal right before the closing </SafeAreaView>
old_closing = '''      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}'''
new_closing = '''      </KeyboardAvoidingView>

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
}'''
assert old_closing in content, "CLOSING ANCHOR NOT FOUND"
content = content.replace(old_closing, new_closing, 1)

# 5. Add styles for the viewer
old_styles_marker = "const styles = StyleSheet.create({"
new_styles_marker = '''const styles = StyleSheet.create({
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
  },'''
assert old_styles_marker in content, "STYLES ANCHOR NOT FOUND"
content = content.replace(old_styles_marker, new_styles_marker, 1)

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Full-screen image viewer added.")
