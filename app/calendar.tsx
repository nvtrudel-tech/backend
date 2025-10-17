import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Switch,
} from "react-native";

export default function CalendarView() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDarkMode, setIsDarkMode] = useState(true);

  const formattedDate = selectedDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const onChange = (_event: any, date?: Date) => {
    if (date) setSelectedDate(date);
  };

  const colors = isDarkMode
    ? { background: "#000", text: "#fff", button: "#007BFF", buttonText: "#fff" }
    : { background: "#fff", text: "#000", button: "#3b82f6", buttonText: "#fff" };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backButton, { color: colors.text }]}>{"<"} </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Book an Appointment</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Dark/Light Mode Toggle */}
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 10 }}>
        <Text style={{ color: colors.text, marginRight: 10 }}>
          {isDarkMode ? "Dark Mode" : "Light Mode"}
        </Text>
        <Switch value={isDarkMode} onValueChange={setIsDarkMode} />
      </View>

      {/* iOS Inline Date Picker */}
      <DateTimePicker
        value={selectedDate}
        mode="date"
        display="inline"
        onChange={onChange}
        themeVariant={isDarkMode ? "dark" : "light"} // iOS only
        textColor={colors.text}
        style={{ width: "100%" }}
      />

      {/* Selected Date */}
      <Text style={[styles.selectedDate, { color: colors.text }]}>
        Selected Date: {formattedDate}
      </Text>

      {/* Confirm Button */}
      <TouchableOpacity
        style={[styles.confirmButton, { backgroundColor: colors.button }]}
        onPress={() =>
          router.push({
            pathname: "/schedule",
            params: { selectedDate: selectedDate.toISOString() },
          })
        }
      >
        <Text style={[styles.confirmText, { color: colors.buttonText }]}>Confirm Appointment</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backButton: { fontSize: 24 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "bold" },
  selectedDate: { fontSize: 16, marginVertical: 20 },
  confirmButton: { padding: 15, borderRadius: 12, alignItems: "center" },
  confirmText: { fontSize: 16, textAlign: "center", fontWeight: "bold" },
});
