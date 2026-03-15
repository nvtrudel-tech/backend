import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ThemeToggle from "./components/ThemeToggle";
import { useTheme } from "./context/ThemeContext";

export default function CalendarView() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { service } = params;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const { colors, theme } = useTheme();
  const isDarkMode = theme === "dark";

  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");

  const formattedDate = selectedDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedTime = selectedDate.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const onChange = (event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }

    if (date) {
      if (date < new Date()) {
        setSelectedDate(new Date());
      } else {
        setSelectedDate(date);
      }

      if (
        Platform.OS === "android" &&
        pickerMode === "date" &&
        event.type !== "dismissed"
      ) {
        showPickerMode("time");
      }
    }
  };

  const showPickerMode = (mode: "date" | "time") => {
    setPickerMode(mode);
    setShowPicker(true);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButtonTouch}>
            <Text style={[styles.backButton, { color: colors.text }]}>{"<"}</Text>
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Book a {service}
          </Text>

          <ThemeToggle />
        </View>

        {Platform.OS === "ios" ? (
          <View style={styles.iosPickerOuter}>
            <View
              style={[
                styles.calendarCard,
                {
                  backgroundColor: colors.cardBackground,
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <DateTimePicker
                value={selectedDate}
                mode="datetime"
                display="spinner"
                onChange={onChange}
                themeVariant={isDarkMode ? "dark" : "light"}
                textColor={colors.text}
                style={styles.dateTimePicker}
                minimumDate={new Date()}
                minuteInterval={15}
              />
            </View>
          </View>
        ) : (
          <View style={styles.androidPickerContainer}>
            <TouchableOpacity
              onPress={() => showPickerMode("date")}
              style={[
                styles.androidButton,
                {
                  backgroundColor: colors.cardBackground,
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <Text style={[styles.androidButtonText, { color: colors.text }]}>
                Select Date
              </Text>
              <Text style={[styles.androidButtonSubText, { color: colors.primaryButton }]}>
                {formattedDate}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => showPickerMode("time")}
              style={[
                styles.androidButton,
                {
                  backgroundColor: colors.cardBackground,
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <Text style={[styles.androidButtonText, { color: colors.text }]}>
                Select Time
              </Text>
              <Text style={[styles.androidButtonSubText, { color: colors.primaryButton }]}>
                {formattedTime}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {showPicker && Platform.OS === "android" && (
          <DateTimePicker
            value={selectedDate}
            mode={pickerMode}
            display="default"
            onChange={onChange}
            themeVariant={isDarkMode ? "dark" : "light"}
            minimumDate={new Date()}
            minuteInterval={15}
          />
        )}

        {Platform.OS === "ios" && (
          <View style={styles.selectedDateContainer}>
            <Text style={[styles.selectedDateLabel, { color: colors.subText }]}>
              Selected Date & Time:
            </Text>
            <Text style={[styles.selectedDate, { color: colors.text }]}>
              {formattedDate} at {formattedTime}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.confirmButton, { backgroundColor: colors.primaryButton }]}
          onPress={() =>
            router.push({
              pathname: "/schedule",
              params: {
                selectedDate: selectedDate.toISOString(),
                service: service,
              },
            })
          }
        >
          <Text style={[styles.confirmText, { color: colors.primaryButtonText }]}>
            Confirm Time
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 10,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingTop: Platform.OS === "android" ? 15 : 0,
  },

  backButtonTouch: {
    padding: 8,
    marginLeft: -8,
  },

  backButton: {
    fontSize: 28,
    fontWeight: "300",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 10,
  },

  iosPickerOuter: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  calendarCard: {
    width: "100%",
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 2,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: "visible",
  },

  dateTimePicker: {
    width: "100%",
    height: 260,
    alignSelf: "center",
  },

  androidPickerContainer: {
    marginTop: 20,
  },

  androidButton: {
    padding: 20,
    borderRadius: 15,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 20,
    alignItems: "center",
  },

  androidButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },

  androidButtonSubText: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 8,
  },

  selectedDateContainer: {
    alignItems: "center",
    marginVertical: 25,
    paddingHorizontal: 10,
  },

  selectedDateLabel: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },

  selectedDate: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 4,
    textAlign: "center",
  },

  confirmButton: {
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: "center",
    marginTop: "auto",
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },

  confirmText: {
    fontSize: 17,
    textAlign: "center",
    fontWeight: "bold",
  },
});