import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { AppState } from "react-native";
import AppNavigator from "./navigation/AppNavigator";

// TODO 1: use the same API base URL the rest of your app uses
const API_URL = "https://backend-tknm.onrender.com/api";

// TODO 2: return the logged-in user's or worker's _id.
// Change "user" to whatever key you save your login under, and
// adjust ._id if your stored object uses a different field.
const getUserId = async () => {
  try {
    const raw = await AsyncStorage.getItem("user");
    return raw ? JSON.parse(raw)._id : null;
  } catch (e) {
    return null;
  }
};

const clearBadge = async () => {
  try {
    // Clears the number on the app icon
    await Notifications.setBadgeCountAsync(0);

    // Clears the count stored on the server
    const userId = await getUserId();
    if (userId) {
      await fetch(`${API_URL}/notifications/clear/${userId}`, {
        method: "POST",
      });
    }
  } catch (e) {
    console.log("Failed to clear badge:", e);
  }
};

export default function App() {
  useEffect(() => {
    clearBadge(); // when the app first opens

    // and every time it comes back to the foreground
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") clearBadge();
    });

    return () => sub.remove();
  }, []);

  return <AppNavigator />;
}