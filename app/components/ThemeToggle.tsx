import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme, colors } = useTheme();
  const isDark = theme === "dark";

  return (
    <TouchableOpacity
      onPress={toggleTheme}
      style={[
        styles.toggleButton,
        {
          backgroundColor: colors.cardBackground, // Use a consistent background from your theme
          borderColor: colors.inputBorder,       // Add a border for better contrast
        },
      ]}
    >
      <Ionicons
        name={isDark ? "sunny" : "moon"}
        size={24}
        color={isDark ? "#facc15" : colors.text} // Use theme's text color for the moon icon
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    padding: 10,
    borderRadius: 20,
    borderWidth: 0, // This makes the borderColor visible
    alignItems: "center",
    justifyContent: "center",
  },
});
