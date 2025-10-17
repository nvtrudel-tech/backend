// app/schedule.tsx
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Image,
  Linking,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const LOCAL_IP = "localhost"; // Change to your IP if testing on physical device

const ScheduleView = () => {
  const router = useRouter();

  const [workers, setWorkers] = useState<any[]>([
    {
      _id: "671a62b6f83b47a6fd1b5678",
      name: "John Doe",
      description: "Electrician",
      address: "123 Main St",
      availableTimes: [
        "8:00 AM",
        "9:00 AM",
        "10:00 AM",
        "11:00 AM",
        "1:00 PM",
        "2:00 PM",
        "3:00 PM",
      ],
      image: require("../assets/images/worker1.png"),
    },
    {
      _id: "671a62b6f83b47a6fd1b9012",
      name: "Jane Smith",
      description: "Plumber",
      address: "456 Elm St",
      availableTimes: ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM"],
      image: require("../assets/images/worker2.png"),
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(true);

  const allTimes = Array.from(new Set(workers.flatMap((w) => w.availableTimes)));
  const filteredWorkers = workers.filter(
    (w) => selectedTime && w.availableTimes.includes(selectedTime)
  );

  const themeStyles = {
    backgroundColor: isDarkMode ? "#000" : "#fff",
    textColor: isDarkMode ? "#fff" : "#000",
    secondaryText: isDarkMode ? "#aaa" : "#555",
    cardBackground: isDarkMode ? "#1a1a1a" : "#f9f9f9",
    buttonColor: isDarkMode ? "#1e90ff" : "blue",
  };

  const handleConfirm = () => setShowForm(true);

  const handleSave = async () => {
    if (!name || !address || !phone) {
      Alert.alert("Missing info", "Please fill in all fields before saving.");
      return;
    }

    try {
      const API_URL = `http://${LOCAL_IP}:6000/api/appointments`;

      const appointmentData = {
        customer: "671a62b6f83b47a6fd1b1234", // Replace with real logged-in user ID later
        worker: selectedWorker?._id,
        service: selectedWorker?.description || "General Service",
        date: new Date(selectedDate).toISOString(),
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appointmentData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.msg || "Failed to create appointment");
      }

      setShowForm(false);
      Alert.alert(
        "Appointment Confirmed",
        `Your appointment with ${selectedWorker.name} on ${selectedDate.toDateString()} at ${selectedTime} has been booked.`,
        [
          { text: "Call Now", onPress: () => Linking.openURL(`tel:${phone}`) },
          { text: "OK", style: "cancel" },
        ]
      );
    } catch (err) {
      console.error("Error saving appointment:", err);
      Alert.alert("Error", "Could not save appointment to database.");
    }
  };

  return (
    <View
      style={{ flex: 1, padding: 16, backgroundColor: themeStyles.backgroundColor }}
    >
      {/* Top bar */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <Button
          title="Back"
          onPress={() => router.back()}
          color={themeStyles.buttonColor}
        />
        <Button
          title={isDarkMode ? "Light Mode" : "Dark Mode"}
          onPress={() => setIsDarkMode(!isDarkMode)}
          color={themeStyles.buttonColor}
        />
      </View>

      {loading && (
        <ActivityIndicator
          size="small"
          color={themeStyles.buttonColor}
          style={{ marginBottom: 10 }}
        />
      )}

      <Text style={{ fontSize: 16, color: themeStyles.textColor }}>
        Selected Date: {selectedDate.toDateString()}
      </Text>

      {/* Time selection */}
      <Text
        style={{
          fontSize: 16,
          marginTop: 16,
          color: themeStyles.textColor,
        }}
      >
        Select a Time Slot
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 10 }}>
        {allTimes.map((time) => (
          <TouchableOpacity
            key={time}
            onPress={() => {
              setSelectedTime(time);
              setSelectedWorker(null);
            }}
            style={{
              backgroundColor:
                selectedTime === time
                  ? themeStyles.buttonColor
                  : themeStyles.cardBackground,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 6,
              margin: 4,
            }}
          >
            <Text
              style={{
                color:
                  selectedTime === time ? "#fff" : themeStyles.textColor,
                fontSize: 12,
              }}
            >
              {time}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Worker selection */}
      {selectedTime && (
        <View>
          <Text
            style={{
              fontSize: 16,
              marginTop: 16,
              color: themeStyles.textColor,
            }}
          >
            Available Specialists
          </Text>
          <ScrollView style={{ maxHeight: 200 }}>
            {filteredWorkers.map((worker) => (
              <TouchableOpacity
                key={worker._id}
                onPress={() => setSelectedWorker(worker)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: themeStyles.cardBackground,
                  padding: 10,
                  marginVertical: 5,
                  borderRadius: 10,
                  borderColor:
                    selectedWorker?._id === worker._id
                      ? themeStyles.buttonColor
                      : "#ccc",
                  borderWidth: selectedWorker?._id === worker._id ? 2 : 1,
                }}
              >
                <Image
                  source={worker.image}
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    marginRight: 10,
                  }}
                />
                <View>
                  <Text
                    style={{
                      fontWeight: "bold",
                      color: themeStyles.textColor,
                    }}
                  >
                    {worker.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: themeStyles.textColor,
                    }}
                  >
                    {worker.description}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: themeStyles.secondaryText,
                    }}
                  >
                    {worker.address}
                  </Text>
                </View>
                {selectedWorker?._id === worker._id && (
                  <Text
                    style={{
                      color: themeStyles.buttonColor,
                      marginLeft: "auto",
                    }}
                  >
                    ✔
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Confirm button */}
      <TouchableOpacity
        onPress={handleConfirm}
        disabled={!selectedTime || !selectedWorker}
        style={{
          backgroundColor:
            selectedTime && selectedWorker
              ? themeStyles.buttonColor
              : "gray",
          padding: 15,
          borderRadius: 10,
          marginTop: 20,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "bold" }}>
          Confirm Appointment
        </Text>
      </TouchableOpacity>

      {/* Modal form */}
      <Modal visible={showForm} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              margin: 20,
              backgroundColor: themeStyles.backgroundColor,
              borderRadius: 10,
              padding: 20,
            }}
          >
            <Text
              style={{
                fontWeight: "bold",
                color: themeStyles.textColor,
                marginBottom: 10,
              }}
            >
              Enter Your Details
            </Text>
            <TextInput
              placeholder="Full Name"
              placeholderTextColor={themeStyles.secondaryText}
              value={name}
              onChangeText={setName}
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 10,
                marginVertical: 8,
                color: themeStyles.textColor,
              }}
            />
            <TextInput
              placeholder="Address"
              placeholderTextColor={themeStyles.secondaryText}
              value={address}
              onChangeText={setAddress}
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 10,
                marginVertical: 8,
                color: themeStyles.textColor,
              }}
            />
            <TextInput
              placeholder="Phone Number"
              placeholderTextColor={themeStyles.secondaryText}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 10,
                marginVertical: 8,
                color: themeStyles.textColor,
              }}
            />
            <Button
              title="Save"
              onPress={handleSave}
              color={themeStyles.buttonColor}
            />
            <Button
              title="Cancel"
              onPress={() => setShowForm(false)}
              color="gray"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ScheduleView;
