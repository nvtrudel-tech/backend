import { Ionicons } from "@expo/vector-icons";
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useTheme } from "../context/ThemeContext";

// Define your languages
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  // Add more languages here in the future
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const onSelectLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setModalVisible(false);
  };

  return (
    <>
      {/* --- 1. The Hammer Icon Button --- */}
      <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.button}>
        <Ionicons name="hammer" size={28} color={colors.text} />
      </TouchableOpacity>

      {/* --- 2. The Language Selection Modal --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable 
          style={styles.modalBackdrop} 
          onPress={() => setModalVisible(false)} // Close when tapping backdrop
        >
          <Pressable 
            style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}
            onPress={() => {}} // Prevents backdrop tap from closing when tapping content
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Choose a Language</Text>
            
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageButton,
                  { 
                    backgroundColor: i18n.language === lang.code ? colors.primaryButton : colors.background,
                    borderColor: colors.inputBorder
                  }
                ]}
                onPress={() => onSelectLanguage(lang.code)}
              >
                <Text 
                  style={[
                    styles.languageButtonText, 
                    { color: i18n.language === lang.code ? colors.primaryButtonText : colors.text }
                  ]}
                >
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 5, // Make it easier to tap
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    width: '80%',
    maxWidth: 300,
    borderRadius: 15,
    padding: 20,
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  languageButton: {
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 10,
  },
  languageButtonText: {
    fontSize: 16,
    fontWeight: '600',
  }
});

