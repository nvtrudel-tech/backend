import sys

path = "app/chat/[appointmentId].tsx"
with open(path, "r") as f:
    content = f.read()

original = content

old_import = '''import * as ImagePicker from "expo-image-picker";'''
new_import = '''import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";'''
assert old_import in content, "IMPORT ANCHOR NOT FOUND"
content = content.replace(old_import, new_import, 1)

old_pick = '''  const handlePickImage = async () => {
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
  };'''
new_pick = '''  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    try {
      // Resize/compress before converting to base64. Large base64 data URIs
      // can silently fail to render as an <Image> on some Android devices,
      // so we keep the payload small and consistent across all devices.
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        {
          compress: 0.5,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      if (manipulated.base64) {
        const base64Image = `data:image/jpeg;base64,${manipulated.base64}`;
        setPendingImage(base64Image);
      }
    } catch (error) {
      console.error("Image resize error:", error);
    }
  };'''
assert old_pick in content, "PICK IMAGE ANCHOR NOT FOUND"
content = content.replace(old_pick, new_pick, 1)

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Chat screen patched to resize images before base64 conversion.")
