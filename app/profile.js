import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
// --- NEW: Import i18n ---
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform, ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// --- REMOVED: LanguageSwitcher ---
import ThemeToggle from "./components/ThemeToggle";
import { useTheme } from "./context/ThemeContext";

const API_URL = "https://backend-tknm.onrender.com/api";

// --- NEW: Language options array ---
const LANGUAGES = [
  { label: "English", value: "en" },
  { label: "Français", value: "fr" },
  { label: "Español", value: "es" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { i18n } = useTranslation(); // --- NEW: Get i18n instance ---

  const [userId, setUserId] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- NEW: State for selected language ---
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);

  // Fetch user data on load
  useEffect(() => {
    const loadUserData = async () => {
      setIsLoading(true);
      const userString = await AsyncStorage.getItem("user");
      // --- NEW: Load saved language and apply it ---
      const savedLang = await AsyncStorage.getItem("language");
      if (savedLang) {
        setSelectedLanguage(savedLang);
        i18n.changeLanguage(savedLang); // Apply on load
      }
      // ---

      if (!userString) {
        router.replace("/login");
        return;
      }
      
      const user = JSON.parse(userString);
      setUserId(user._id);

      try {
        // Fetch full user details from backend
        const response = await fetch(`${API_URL}/auth/user/${user._id}`);
        if (!response.ok) throw new Error("Could not fetch user data.");
        
        const userData = await response.json();
        
        setName(userData.name || "");
        setEmail(userData.email || "");
        setPhone(userData.phone || "");
        setProfileImage(userData.profileImageBase64 || null);
        
      } catch (error) { 
        Alert.alert("Error", error.message || "Could not load profile.");
        // Fallback to AsyncStorage data
        setName(user.name || "");
        setEmail(user.email || "");
      } finally {
        setIsLoading(false);
      }
    };
    loadUserData();
  }, []);

  // --- NEW: Handle Language Change ---
  const handleChangeLanguage = async (langValue: string) => {
    setSelectedLanguage(langValue); // Update UI state
    i18n.changeLanguage(langValue); // Change app language
    await AsyncStorage.setItem("language", langValue); // Save choice
  };

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setProfileImage(base64Image);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setIsSaving(true);

    try {
      const updatedData = {
        name,
        email,
        phone,
        profileImageBase64: profileImage,
      };

      const response = await fetch(`${API_URL}/auth/user/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) throw new Error("Failed to save profile.");

      const savedUser = await response.json();

      // Update local storage as well
      await AsyncStorage.setItem("user", JSON.stringify(savedUser));
      
      Alert.alert("Success", "Your profile has been updated.");

    } catch (error) {
      Alert.alert("Error", error.message || "Could not save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Confirm Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        onPress: async () => {
          if (userId) {
            try {
              // Remove push token from server
              await fetch(`${API_URL}/auth/save-push-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId, token: null }),
              });
            } catch (e) {
              console.error("Failed to remove customer token on logout:", e);
            }
          }
          await AsyncStorage.removeItem("user");
          router.replace("/login");
        },
        style: "destructive",
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primaryButton} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* --- Header --- */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Profile</Text>
          <View style={styles.headerIcons}>
            <ThemeToggle />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* --- Profile Picture --- */}
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: profileImage || `https://i.pravatar.cc/150?u=${userId}` }}
              style={[styles.avatar, { borderColor: colors.background }]}
            />
            <TouchableOpacity style={[styles.cameraIcon, {backgroundColor: colors.primaryButton, borderColor: colors.background}]} onPress={handlePickImage}>
              <Ionicons name="camera" size={20} color={colors.primaryButtonText} />
            </TouchableOpacity>
          </View>

          {/* --- Form --- */}
          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.subText }]}>Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor={colors.subText}
            />

            <Text style={[styles.label, { color: colors.subText }]}>Email Address</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={colors.subText}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={false} // --- Typically email is not editable ---
            />

            <Text style={[styles.label, { color: colors.subText }]}>Phone Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="(123) 456-7890"
              placeholderTextColor={colors.subText}
              keyboardType="phone-pad"
            />
            
            {/* --- NEW: Language Option --- */}
            <Text style={[styles.label, { color: colors.subText }]}>Language</Text>
            <View style={styles.languageContainer}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.value}
                  onPress={() => handleChangeLanguage(lang.value)}
                  style={[
                    styles.langButton,
                    selectedLanguage === lang.value
                      ? { backgroundColor: colors.primaryButton }
                      : { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, borderWidth: 1 }
                  ]}
                >
                  <Text style={[
                    styles.langButtonText,
                    selectedLanguage === lang.value
                      ? { color: colors.primaryButtonText }
                      : { color: colors.text }
                  ]}>
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* --- Actions --- */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primaryButton }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.primaryButtonText} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.primaryButtonText }]}>Save Changes</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.logoutButton, { borderColor: '#ef4444' }]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
              <Text style={styles.logoutButtonText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0', // Will be overridden by theme
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scrollContent: {
    padding: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    // borderColor: '#FFF', // Will be overridden by theme
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 5,
    right: '30%',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    // borderColor: '#FFF', // Will be overridden by theme
  },
  form: {
    marginBottom: 30,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 20,
  },
  // --- NEW: Language Container Styles ---
  languageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  langButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  langButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  // ---
  buttonContainer: {
    paddingBottom: 40,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 15,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
    marginLeft: 8,
  },
});

