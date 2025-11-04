import { Stack } from "expo-router";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
// --- NEW: Import i18n config ---
// Path based on your file tree
import "../app/lib/translations/i18n";
import { ThemeProvider } from "./context/ThemeContext";
// ---

export default function Layout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Stack
          // Set the initial screen to 'index', and protect routes internally
          initialRouteName="index" 
          screenOptions={{
            headerShown: false,
          }}
        >
          {/* Main App Screens */}
          <Stack.Screen name="index" />
          <Stack.Screen name="calendar" />
          <Stack.Screen name="schedule" />
          <Stack.Screen name="profile" /> {/* --- ADDED: Profile screen route --- */}
          
          {/* Authentication Screens */}
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          
          {/* Worker-specific Screens */}
          <Stack.Screen name="worker/dashboard" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
