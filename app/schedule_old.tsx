// app/schedule.tsx
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Button,
  Image,
  Linking,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

const workers = [
  {
    id: "1",
    name: "John Doe",
    image: require("../assets/worker1.png"),
    availableTimes: ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM"],
  },
  {
    id: "2",
    name: "Jane Smith",
    image: require("../assets/worker2.png"),
    availableTimes: ["10:00 AM", "1:00 PM", "3:00 PM"],
  },
  {
    id: "3",
    name: "Mike Johnson",
    image: require("../assets/worker3.png"),
    availableTimes: [
      "9:00 AM",
      "9:30 AM",
      "10:00 AM",
      "11:00 AM",
      "12:00 PM",
      "2:00 PM",
      "4:00 PM",
    ],
  },
  {
    id: "4",
    name: "Sarah Lee",
    image: require("../assets/worker4.png"),
    availableTimes: ["10:00 AM", "11:00 AM", "1:30 PM", "3:30 PM"],
  },
];

const ScheduleView = () => {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const allTimes = Array.from(
    new Set(workers.flatMap((w) => w.availableTimes))
  ).sort((a, b) => {
    const parseTime = (t: string) =>
      new Date(
        `1970-01-01T${t.replace(/(\d+):(\d+) (AM|PM)/, (_, h, m, ampm) => {
          h = parseInt(h);
          if (ampm === "PM" && h !== 12) h += 12;
          if (ampm === "AM" && h === 12) h = 0;
          return `${h.toString().padStart(2, "0")}:${m}`;
        })}:00Z`
      );
    return parseTime(a).getTime() - parseTime(b).getTime();
  });

  const filteredWorkers = workers.filter(
    (w) => selectedTime && w.availableTimes.includes(selectedTime)
  );

  const handleConfirm = () => {
    setShowForm(true);
  };

  const handleSave = () => {
    setShowForm(false);
    Alert.alert(
      "Appointment Confirmed",
      `Your appointment is set for ${selectedDate.toDateString()} at ${selectedTime} with ${
        selectedWorker.name
      }.\n\nName: ${name}\nAddress: ${address}\nPhone: ${phone}`,
      [
        { text: "Call Now", onPress: () => Linking.openURL(`tel:${phone}`) },
        { text: "OK", style: "cancel" },
      ]
    );
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: "#fff" }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>{"<"} </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule Appointment</Text>
        <View style={{ width: 24 }} /> {/* Spacer for symmetry */}
      </View>
      <Text style={{ fontSize: 16, color: "gray" }}>
        Selected Date: {selectedDate.toDateString()}
      </Text>

      <Text style={{ fontSize: 16, marginTop: 16 }}>Select a Time Slot</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginVertical: 10 }}
      >
        {allTimes.map((time) => (
          <TouchableOpacity
            key={time}
            onPress={() => {
              setSelectedTime(time);
              setSelectedWorker(null);
            }}
            style={{
              backgroundColor: selectedTime === time ? "blue" : "#f0f0f0",
              padding: 10,
              borderRadius: 8,
              marginRight: 8,
            }}
          >
            <Text style={{ color: selectedTime === time ? "white" : "black" }}>
              {time}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {selectedTime && (
        <View>
          <Text style={{ fontSize: 16, marginTop: 16 }}>
            Available Specialists
          </Text>
          <ScrollView style={{ maxHeight: 200 }}>
            {filteredWorkers.map((worker) => (
              <TouchableOpacity
                key={worker.id}
                onPress={() => setSelectedWorker(worker)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#f9f9f9",
                  padding: 10,
                  marginVertical: 5,
                  borderRadius: 10,
                  borderColor:
                    selectedWorker?.id === worker.id ? "blue" : "#ccc",
                  borderWidth: selectedWorker?.id === worker.id ? 2 : 1,
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
                <Text style={{ flex: 1 }}>{worker.name}</Text>
                {selectedWorker?.id === worker.id && (
                  <Text style={{ color: "blue" }}>✔</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <TouchableOpacity
        onPress={handleConfirm}
        disabled={!selectedTime || !selectedWorker}
        style={{
          backgroundColor: selectedTime && selectedWorker ? "blue" : "gray",
          padding: 15,
          borderRadius: 10,
          marginTop: 20,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "bold" }}>
          Confirm Appointment
        </Text>
      </TouchableOpacity>

      {showForm && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontWeight: "bold" }}>Enter Your Details</Text>
          <TextInput
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
          <TextInput
            placeholder="Address"
            value={address}
            onChangeText={setAddress}
            style={styles.input}
          />
          <TextInput
            placeholder="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={styles.input}
          />
          <Button title="Continue" onPress={handleSave} />
        </View>
      )}
    </View>
  );
};

const styles = {
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: { fontSize: 24, color: "blue" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
  },
};

export default ScheduleView;
