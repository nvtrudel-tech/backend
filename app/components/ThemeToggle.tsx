// app/components/ThemeToggle.tsx
import React from "react";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <TouchableOpacity
      onPress={toggleTheme}
      style={{
        position: "absolute",
        top: 50,
        right: 20,
        backgroundColor: isDark ? "#333" : "#eee",
        borderRadius: 20,
        padding: 10,
        zIndex: 999,
      }}
    >
      <Ionicons
        name={isDark ? "sunny" : "moon"}
        size={24}
        color={isDark ? "#facc15" : "#1e3a8a"}
      />
    </TouchableOpacity>
  );
}
