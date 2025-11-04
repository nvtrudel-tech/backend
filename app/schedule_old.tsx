import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import ThemeToggle from "./components/ThemeToggle";
import { useTheme } from "./context/ThemeContext";

// Define the API URL for your backend
const API_URL = "http://172.20.10.14:6000/api";

export default function ScheduleScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const { selectedDate } = params;

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<any | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Hardcoded services list, same as the one in the worker dashboard
  const serviceCategories = [
    "Electrician", "Plumber", "Drywall", "Carpenter", 
    "Roofer", "Fire/Alarm", "Home Automation", "HVAC", 
    "Painter", "Heavy Equipment"
  ];

  const fetchWorkers = useCallback(async () => {
    try {
      // NOTE: This assumes you have an endpoint to get all users, which we filter by role.
      // You may need to create a dedicated endpoint like GET /api/workers
      const response = await fetch(`${API_URL}/users`);
      if (!response.ok) throw new Error("Failed to fetch workers");
      
      const allUsers = await response.json();
      const availableWorkers = allUsers.filter(
        (user: any) => user.role === 'worker' || user.role === 'specialist'
      );
      setWorkers(availableWorkers);
    } catch (error) {
      console.error("Fetch workers error:", error);
      Alert.alert("Error", "Could not load available specialists.");
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const userString = await AsyncStorage.getItem("user");
      if (userString) {
        setCustomerId(JSON.parse(userString)._id);
      }
      fetchWorkers();
    };
    initialize();
  }, [fetchWorkers]);

  const handleBookAppointment = async () => {
    if (!selectedService || !selectedWorker || !customerId || !selectedDate) {
      Alert.alert("Incomplete Information", "Please select a service and a specialist.");
      return;
    }
    setLoading(true);
    try {
      const appointmentData = {
        customer: customerId,
        worker: selectedWorker._id,
        service: selectedService,
        date: selectedDate,
      };

      const response = await fetch(`${API_URL}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || "Failed to create appointment");
      }
      
      Alert.alert("Success!", "Your appointment has been booked.");
      router.replace("/"); // Navigate back to home screen on success

    } catch (error: any) {
      console.error("Booking error:", error);
      Alert.alert("Booking Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backButton, { color: colors.text }]}>{"<"}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Schedule Details</Text>
          <ThemeToggle />
        </View>

        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Selected Date</Text>
          <Text style={{ color: colors.subText }}>
            {new Date(selectedDate as string).toLocaleDateString()}
          </Text>
        </View>
        
        <Text style={[styles.subHeader, { color: colors.text }]}>1. Choose a Service</Text>
        <View style={styles.listContainer}>
          {serviceCategories.map(service => (
            <TouchableOpacity
              key={service}
              style={[
                styles.itemButton,
                { 
                  backgroundColor: selectedService === service ? colors.primaryButton : colors.cardBackground,
                  borderColor: colors.inputBorder
                }
              ]}
              onPress={() => setSelectedService(service)}
            >
              <Text style={{ color: selectedService === service ? colors.primaryButtonText : colors.text }}>
                {service}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.subHeader, { color: colors.text }]}>2. Choose a Specialist</Text>
        <View style={styles.listContainer}>
          {workers.length > 0 ? workers.map(worker => (
            <TouchableOpacity
              key={worker._id}
              style={[
                styles.itemButton,
                {
                  backgroundColor: selectedWorker?._id === worker._id ? colors.primaryButton : colors.cardBackground,
                  borderColor: colors.inputBorder
                }
              ]}
              onPress={() => setSelectedWorker(worker)}
            >
              <Text style={{ color: selectedWorker?._id === worker._id ? colors.primaryButtonText : colors.text }}>
                {worker.name}
              </Text>
            </TouchableOpacity>
          )) : <Text style={{ color: colors.subText }}>No specialists available.</Text>}
        </View>

        <TouchableOpacity
          style={[styles.confirmButton, { backgroundColor: colors.primaryButton, opacity: loading ? 0.7 : 1 }]}
          onPress={handleBookAppointment}
          disabled={loading}
        >
          <Text style={[styles.confirmText, { color: colors.primaryButtonText }]}>
            {loading ? "Booking..." : "Book Now"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    justifyContent: "space-between",
  },
  backButton: { fontSize: 24, fontWeight: "bold" },
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  section: {
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  subHeader: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 10,
  },
  listContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  itemButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    margin: 5,
  },
  confirmButton: {
    marginTop: 30,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmText: {
    fontSize: 16,
    textAlign: "center",
    fontWeight: "bold",
  },
});
