import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

export default function WorkerDashboard() {
  const [available, setAvailable] = useState(true);
  const [clockedIn, setClockedIn] = useState(false);
  const [location, setLocation] = useState<any>(null);

  const toggleAvailability = () => setAvailable(prev => !prev);
  const toggleClockIn = () => setClockedIn(prev => !prev);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location access is needed for GPS map.");
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation.coords);
    })();
  }, []);

  const jobsToday = [
    { time: "9:00 AM", address: "123 Main St", status: "Pending" },
    { time: "1:00 PM", address: "456 Oak Ave", status: "In Progress" },
    { time: "4:30 PM", address: "789 Pine Rd", status: "Completed" },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Worker Dashboard</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Availability</Text>
        <Switch value={available} onValueChange={toggleAvailability} />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Clock In/Out</Text>
        <TouchableOpacity
          onPress={toggleClockIn}
          style={[styles.clockButton, { backgroundColor: clockedIn ? "red" : "green" }]}
        >
          <Text style={styles.clockText}>{clockedIn ? "Clock Out" : "Clock In"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subHeader}>Current Location</Text>
      {location ? (
        <MapView
          style={styles.map}
          region={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title="You are here"
          />
        </MapView>
      ) : (
        <Text style={styles.loadingText}>Loading map...</Text>
      )}

      <Text style={styles.subHeader}>Today's Jobs</Text>
      {jobsToday.map((job, index) => (
        <View key={index} style={styles.jobCard}>
          <Text style={styles.jobTime}>{job.time}</Text>
          <Text style={styles.jobAddress}>{job.address}</Text>
          <Text style={styles.jobStatus}>Status: {job.status}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#f9fafb",
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#1f2937",
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 12,
  },
  label: {
    fontSize: 16,
    color: "#374151",
  },
  clockButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  clockText: {
    color: "white",
    fontWeight: "bold",
  },
  subHeader: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 24,
    marginBottom: 8,
    color: "#111827",
  },
  loadingText: {
    textAlign: "center",
    color: "#6b7280",
  },
  map: {
    width: "100%",
    height: 200,
    borderRadius: 10,
  },
  jobCard: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 12,
    marginVertical: 6,
    elevation: 2,
  },
  jobTime: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2563eb",
  },
  jobAddress: {
    fontSize: 14,
    color: "#374151",
  },
  jobStatus: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
});
