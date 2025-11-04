import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeType = "light" | "dark";

// --- Theme Color Definitions ---
const lightColors = {
  background: "#ffffff",
  text: "#1f2937", // Dark Gray
  subText: "#505050", // Medium Gray
  primaryButton: "#3b82f6", // Blue
  primaryButtonText: "#ffffff",
  cardBackground: "#f3f4f6", // Lightest Gray
  inputBorder: "#d1d5db", // Border Gray
  gradient: ["#3b82f6", "#6366f1"],
};

const darkColors = {
  background: "#121212", // Very Dark Gray
  text: "#e5e7eb", // Light Gray
  subText: "#9ca3af", // Cooler Gray
  primaryButton: "#2563eb", // Royal Blue
  primaryButtonText: "#ffffff",
  cardBackground: "#1f2937", // Dark Blue-Gray
  inputBorder: "#374151", // Darker Border
  gradient: ["#1f2937", "#111827"], // Darker gradient
};

interface Colors {
  inputBackground: ColorValue | undefined;
  background: string;
  text: string;
  subText: string;
  primaryButton: string;
  primaryButtonText: string;
  cardBackground: string;
  inputBorder: string;
  gradient: string[];
}

interface ThemeContextType {
  theme: ThemeType;
  colors: Colors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  colors: lightColors,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeType>("light");

  // Determine the current color set based on the theme state
  const colors = theme === "dark" ? darkColors : lightColors;

  // Load saved theme from AsyncStorage on component mount
  useEffect(() => {
    const loadTheme = async () => {
      const saved = await AsyncStorage.getItem("appTheme");
      if (saved) setTheme(saved as ThemeType);
    };
    loadTheme();
  }, []);

  // Function to switch between themes and persist the choice
  const toggleTheme = async () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    await AsyncStorage.setItem("appTheme", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

// Exporting default to satisfy Expo Router's requirement when it checks for the file
export default ThemeContext;
