// app/_layout.tsx
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "./context/ThemeContext";

export default function Layout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Stack
          initialRouteName="login"
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="calendar" />
          <Stack.Screen name="schedule" />
          <Stack.Screen name="worker/dashboard" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
