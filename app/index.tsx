import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

const screenWidth = Dimensions.get("window").width;
const screenHeight = Dimensions.get("window").height;

export default function ElectricianAppView() {
  const router = useRouter();
  const [isPressedEmergency, setIsPressedEmergency] = useState(false);
  const [isPressedSchedule, setIsPressedSchedule] = useState(false);
  const [isPressedTab, setIsPressedTab] = useState<string | null>(null);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showHammerModal, setShowHammerModal] = useState(false);
  const [darkMode, setDarkMode] = useState(false); // 🌙 dark mode state

  const categoryLabels = [
    "Electrician",
    "Plumber",
    "Drywall",
    "Carpenter",
    "Roofer",
    "Fire/Alarm",
    "Home Automation",
    "HVAC",
    "Painter",
    "Heavy Equipment",
  ];

  const categoryImages = [
    require("../assets/images/logo_elec.png"),
    require("../assets/images/Plumbing.png"),
    require("../assets/images/Drywall.png"),
    require("../assets/images/hammer.png"),
    require("../assets/images/roof3.png"),
    require("../assets/images/fire_alarm.png"),
    require("../assets/images/HomeAuto.png"),
    require("../assets/images/HVAC.png"),
    require("../assets/images/PaintBrush.png"),
    require("../assets/images/HeavyEquip.png"),
  ];

  const serviceTitleScale = useRef(new Animated.Value(1)).current;
  const categoryScales = useRef(categoryLabels.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("selectedCategory");
      if (saved !== null) setSelectedCategoryIndex(Number(saved));
    })();
  }, []);

  useEffect(() => {
    if (selectedCategoryIndex !== null)
      AsyncStorage.setItem("selectedCategory", selectedCategoryIndex.toString());
  }, [selectedCategoryIndex]);

  const animateTitle = () => {
    Animated.sequence([
      Animated.timing(serviceTitleScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(serviceTitleScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const handleCategoryPressIn = (index: number) => {
    Animated.spring(categoryScales[index], { toValue: 0.95, useNativeDriver: true }).start();
  };
  const handleCategoryPressOut = (index: number) => {
    Animated.spring(categoryScales[index], {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handleEmergencyCall = () => Linking.openURL("tel://5148920801");

  // 🌗 Theme setup
  const theme = darkMode
    ? {
        gradient: ["#0a0a0a", "#1a1a1a"],
        text: "#fff",
        subText: "#aaa",
        card: "#1e1e1e",
        button: "#2563eb",
        border: "#444",
      }
    : {
        gradient: ["#3b82f6", "#6366f1"],
        text: "#fff",
        subText: "#e0e0e0",
        card: "#fff",
        button: "#3b82f6",
        border: "#ccc",
      };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient colors={theme.gradient} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowHammerModal(true)}>
              <Ionicons name="hammer" size={28} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.text }]}>Connexions</Text>
            <TouchableOpacity
              onPress={() => setDarkMode(!darkMode)}
              style={[styles.toggleButton, { borderColor: theme.border }]}
            >
              <Ionicons
                name={darkMode ? "moon" : "sunny"}
                size={22}
                color={darkMode ? "#facc15" : "#fff"}
              />
            </TouchableOpacity>
          </View>

          {/* Service Title */}
          <View style={{ alignItems: "center", marginTop: 4 }}>
            <Animated.Text
              style={[
                styles.serviceTitle,
                { transform: [{ scale: serviceTitleScale }], color: theme.text },
              ]}
            >
              {selectedCategoryIndex !== null
                ? categoryLabels[selectedCategoryIndex]
                : "Electrical work"}
            </Animated.Text>

            <Text style={[styles.subText, { color: theme.subText }]}>
              Need trade work done? Select it below and schedule an appointment or press the red
              button for emergency help.
            </Text>

            <Image
              source={
                selectedCategoryIndex !== null
                  ? categoryImages[selectedCategoryIndex]
                  : require("../assets/images/logo_elec.png")
              }
              style={styles.logo}
            />
          </View>

          {/* Schedule & Emergency Buttons */}
          <TouchableOpacity
            onPress={() => router.push("/calendar")}
            onPressIn={() => setIsPressedSchedule(true)}
            onPressOut={() => setIsPressedSchedule(false)}
            style={[
              styles.button,
              {
                opacity: isPressedSchedule ? 0.8 : 1,
                transform: [{ scale: isPressedSchedule ? 0.95 : 1 }],
                backgroundColor: theme.card,
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: theme.button }]}>Schedule Appointment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleEmergencyCall}
            onPressIn={() => setIsPressedEmergency(true)}
            onPressOut={() => setIsPressedEmergency(false)}
            style={[
              styles.emergencyButton,
              {
                opacity: isPressedEmergency ? 0.8 : 1,
                transform: [{ scale: isPressedEmergency ? 0.95 : 1 }],
              },
            ]}
          >
            <Text style={styles.emergencyText}>Emergency Help</Text>
            <Image source={require("../assets/images/phone_12.jpg")} style={styles.phoneIcon} />
          </TouchableOpacity>

          {/* Categories */}
          <View style={styles.categoryContainer}>
            {categoryLabels.map((label, index) => (
              <Animated.View key={index} style={{ transform: [{ scale: categoryScales[index] }] }}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedCategoryIndex(index);
                    animateTitle();
                  }}
                  onPressIn={() => handleCategoryPressIn(index)}
                  onPressOut={() => handleCategoryPressOut(index)}
                  style={[
                    styles.categoryButton,
                    {
                      backgroundColor:
                        selectedCategoryIndex === index ? theme.button : theme.card,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      {
                        color:
                          selectedCategoryIndex === index ? "#fff" : darkMode ? "#fff" : "#3b82f6",
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          {/* Google Map */}
          {location && (
            <View style={{ marginTop: 20, height: 300, borderRadius: 12, overflow: "hidden" }}>
              <MapView
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
              >
                <Marker coordinate={location} title="You are here" />
              </MapView>
            </View>
          )}
        </ScrollView>

        {/* Bottom Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            onPress={() => router.push("/")}
            onPressIn={() => setIsPressedTab("home")}
            onPressOut={() => setIsPressedTab(null)}
            style={[styles.iconButton, isPressedTab === "home" && styles.iconPressed]}
          >
            <Ionicons name="home" size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/search")}
            onPressIn={() => setIsPressedTab("search")}
            onPressOut={() => setIsPressedTab(null)}
            style={[styles.iconButton, isPressedTab === "search" && styles.iconPressed]}
          >
            <Ionicons name="search" size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/login")}
            onPressIn={() => setIsPressedTab("person")}
            onPressOut={() => setIsPressedTab(null)}
            style={[styles.iconButton, isPressedTab === "person" && styles.iconPressed]}
          >
            <Ionicons name="person" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 5,
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "bold" },
  serviceTitle: { fontSize: 20, fontWeight: "600", marginVertical: 2 },
  subText: {
    fontSize: 12,
    opacity: 0.8,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  logo: { width: 160, height: 100, resizeMode: "contain", marginTop: 10 },
  button: {
    alignSelf: "center",
    marginTop: 20,
    padding: 12,
    borderRadius: 20,
    width: screenWidth * 0.7,
    alignItems: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "bold" },
  emergencyButton: {
    alignSelf: "center",
    marginTop: 10,
    backgroundColor: "red",
    padding: 12,
    borderRadius: 20,
    width: screenWidth * 0.7,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  emergencyText: { fontSize: 16, fontWeight: "bold", color: "white", marginRight: 8 },
  phoneIcon: { width: 24, height: 24 },
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-evenly",
    marginTop: 20,
  },
  categoryButton: {
    padding: 10,
    borderRadius: 12,
    margin: 6,
    width: screenWidth * 0.4,
    alignItems: "center",
    borderWidth: 1,
  },
  categoryText: { fontSize: 14, fontWeight: "500" },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    backgroundColor: "#3b82f6",
  },
  iconButton: { padding: 10, borderRadius: 20 },
  iconPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  toggleButton: {
    padding: 8,
    borderWidth: 1,
    borderRadius: 20,
  },
});
