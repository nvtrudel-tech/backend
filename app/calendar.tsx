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
// Import SafeAreaView from react-native-safe-area-context
import { SafeAreaView } from "react-native-safe-area-context";
import ThemeToggle from "./components/ThemeToggle";
import { useTheme } from "./context/ThemeContext";

export default function CalendarView() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { service } = params; // Receive service from index screen

  const [selectedDate, setSelectedDate] = useState(new Date());
  const { colors, theme } = useTheme();
  const isDarkMode = theme === "dark";

  // --- NEW STATE for Android modal pickers ---
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  // ---

  // --- MODIFIED: Format both date and time ---
  const formattedDate = selectedDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = selectedDate.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  // ---

  // --- MODIFIED: onChange handler to support Android modal flow ---
  const onChange = (event: any, date?: Date) => {
    // Hide the modal on Android
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    
    // Check if a date was selected (not cancelled)
    if (date) {
      // Set a minimum date of 'now' to prevent booking in the past
      if (date < new Date()) {
        setSelectedDate(new Date());
      } else {
        setSelectedDate(date);
      }
      
      // --- Android-specific flow: show time picker after date picker ---
      if (Platform.OS === 'android' && pickerMode === 'date' && event.type !== 'dismissed') {
        // Automatically show the time picker right after they pick a date
        showPickerMode('time');
      }
    }
  };
  
  // --- NEW: Helper function to show the Android picker ---
  const showPickerMode = (mode: 'date' | 'time') => {
    setPickerMode(mode);
    setShowPicker(true);
  };
  // ---

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.contentContainer}>
        {/* --- Header --- */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButtonTouch}>
            <Text style={[styles.backButton, { color: colors.text }]}>{"<"}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Book a {service}</Text>
          <ThemeToggle />
        </View>

        {/* --- MODIFIED: Platform-specific pickers --- */}
        {Platform.OS === 'ios' ? (
          // --- iOS: Show inline spinner ---
          <View style={[styles.calendarCard, { backgroundColor: colors.cardBackground, shadowColor: colors.shadow }]}>
            <DateTimePicker
              value={selectedDate}
              mode="datetime"
              display="spinner" 
              onChange={onChange}
              themeVariant={isDarkMode ? "dark" : "light"}
              textColor={colors.text} 
              style={styles.dateTimePicker}
              minimumDate={new Date()} // Prevent booking in the past
              minuteInterval={15} // Optional: Snap to 15-min intervals
            />
          </View>
        ) : (
          // --- Android: Show buttons to launch modal pickers ---
          <View style={styles.androidPickerContainer}>
            <TouchableOpacity 
              onPress={() => showPickerMode('date')}
              style={[styles.androidButton, { backgroundColor: colors.cardBackground, shadowColor: colors.shadow }]}
            >
              <Text style={[styles.androidButtonText, { color: colors.text }]}>Select Date</Text>
              <Text style={[styles.androidButtonSubText, { color: colors.primaryButton }]}>{formattedDate}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => showPickerMode('time')}
              style={[styles.androidButton, { backgroundColor: colors.cardBackground, shadowColor: colors.shadow }]}
            >
              <Text style={[styles.androidButtonText, { color: colors.text }]}>Select Time</Text>
              <Text style={[styles.androidButtonSubText, { color: colors.primaryButton }]}>{formattedTime}</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* --- NEW: Conditionally render the modal picker for Android --- */}
        {showPicker && Platform.OS === 'android' && (
           <DateTimePicker
            value={selectedDate}
            mode={pickerMode}
            display="default" // 'default' opens the native Android modal
            onChange={onChange}
            themeVariant={isDarkMode ? "dark" : "light"}
            minimumDate={new Date()}
            minuteInterval={15}
          />
        )}

        {/* --- Selected Date Display (for iOS only, Android shows in buttons) --- */}
        {Platform.OS === 'ios' && (
          <View style={styles.selectedDateContainer}>
            <Text style={[styles.selectedDateLabel, { color: colors.subText }]}>Selected Date & Time:</Text>
            <Text style={[styles.selectedDate, { color: colors.text }]}>
              {formattedDate} at {formattedTime}
            </Text>
          </View>
        )}

        {/* --- Confirm Button --- */}
        <TouchableOpacity
          style={[styles.confirmButton, { backgroundColor: colors.primaryButton }]}
          onPress={() =>
            router.push({
              pathname: "/schedule",
              params: { 
                selectedDate: selectedDate.toISOString(),
                service: service 
              },
            })
          }
        >
          <Text style={[styles.confirmText, { color: colors.primaryButtonText }]}>Confirm Time</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// --- New, Modern Styles ---
const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  contentContainer: { 
    flex: 1, 
    paddingHorizontal: 20,
    paddingBottom: 40, // Add padding to bottom
    paddingTop: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20, 
    paddingTop: Platform.OS === 'android' ? 15 : 0,
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
    textAlign: 'center', 
    marginHorizontal: 10, // Give space for back button and toggle
  },
  calendarCard: { // iOS only
    borderRadius: 15,
    padding: 10,
    elevation: 3, 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  dateTimePicker: { // iOS only
    width: "100%",
    height: 350, 
  },
  androidPickerContainer: { // Android only
    marginTop: 20,
  },
  androidButton: { // Android only
    padding: 20,
    borderRadius: 15,
    elevation: 3, 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 20,
    alignItems: 'center'
  },
  androidButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  androidButtonSubText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  selectedDateContainer: { // iOS only
    alignItems: 'center',
    marginVertical: 25,
  },
  selectedDateLabel: { // iOS only
    fontSize: 16,
    fontWeight: '500',
  },
  selectedDate: { // iOS only
    fontSize: 20, 
    fontWeight: 'bold',
    marginTop: 4,
  },
  confirmButton: { 
    paddingVertical: 16, 
    borderRadius: 15, 
    alignItems: "center",
    marginTop: 'auto', // Pushes the button to the bottom
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  confirmText: { 
    fontSize: 17, 
    textAlign: "center", 
    fontWeight: "bold" 
  },
});

