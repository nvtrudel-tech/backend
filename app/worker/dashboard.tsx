import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import MapView from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import ThemeToggle from "../components/ThemeToggle";
import { useTheme } from "../context/ThemeContext";

const API_URL = "https://backend-tknm.onrender.com/api";

const ALL_SKILLS = [
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

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface PriceItem {
  item: string;
  price: string;
}

export default function WorkerDashboard() {
  const { colors } = useTheme();
  const router = useRouter();

  const [workerProfile, setWorkerProfile] = useState<any | null>(null);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [maxDistance, setMaxDistance] = useState(25);

  const [appointments, setAppointments] = useState<any[]>([]);
  const [clockedIn, setClockedIn] = useState(false);

  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [skillModalVisible, setSkillModalVisible] = useState(false);

  const [dateTimeModalVisible, setDateTimeModalVisible] = useState(false);
  const [currentJobToSchedule, setCurrentJobToSchedule] = useState<any | null>(null);
  const [selectedDateTime, setSelectedDateTime] = useState(new Date());
  const [priceBreakdown, setPriceBreakdown] = useState<PriceItem[]>([
    { item: "", price: "" },
  ]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const fetchAppointments = async (currentWorkerId: string) => {
    try {
      const appointmentsResponse = await fetch(`${API_URL}/appointments`);
      const allAppointments = await appointmentsResponse.json();

      const workerAppointments = allAppointments.filter(
        (app: any) =>
          app.worker?._id === currentWorkerId || app.worker === currentWorkerId
      );

      const now = new Date();

      const getSortCategory = (date: string) => {
        const jobDate = new Date(date);
        const todayStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        ).getTime();
        const jobDayStart = new Date(
          jobDate.getFullYear(),
          jobDate.getMonth(),
          jobDate.getDate()
        ).getTime();

        if (jobDayStart === todayStart) return 0;
        if (jobDayStart > todayStart) return 1;
        return 2;
      };

      workerAppointments.sort((a: any, b: any) => {
        const catA = getSortCategory(a.date);
        const catB = getSortCategory(b.date);
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();

        if (catA !== catB) return catA - catB;
        if (catA === 0 || catA === 1) return dateA - dateB;
        return dateB - dateA;
      });

      setAppointments(workerAppointments);
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const userString = await AsyncStorage.getItem("user");
      if (!userString) {
        router.replace("/login");
        return;
      }

      const user = JSON.parse(userString);

      try {
        const workersResponse = await fetch(`${API_URL}/workers`);
        const allWorkers = await workersResponse.json();
        const currentWorker = allWorkers.find((w: any) => w.email === user.email);

        if (currentWorker) {
          setWorkerProfile(currentWorker);
          setWorkerId(currentWorker._id);
          setName(currentWorker.name || "");
          setAge(currentWorker.age ? String(currentWorker.age) : "");
          setGender(currentWorker.gender || "");
          setSelectedSkill(currentWorker.skills?.[0] || null);
          setMaxDistance(currentWorker.maxDistance || 25);
          setProfileImage(
            currentWorker.profileImageBase64 || currentWorker.profileImageUrl
          );

          const isClockedIn = currentWorker.currentClock?.clockedIn || false;
          setClockedIn(isClockedIn);

          await fetchAppointments(currentWorker._id);
          registerForPushNotificationsAsync(currentWorker._id);
          await getInitialLocation(currentWorker._id);

          if (isClockedIn) {
            await startLocationTracking(currentWorker._id);
          }
        } else {
          Alert.alert("Error", "Could not find a worker profile for this user.");
        }
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      }
    };

    initialize();

    return () => {
      stopLocationTracking();
    };
  }, [router]);

  useEffect(() => {
    if (!workerId) return;

    const interval = setInterval(() => {
      fetchAppointments(workerId);
    }, 5000);

    return () => clearInterval(interval);
  }, [workerId]);

  const getInitialLocation = async (currentWorkerId: string) => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      setLocationError("Permission to access location was denied.");
      return;
    }

    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation(currentLocation.coords);
      await sendLocationToBackend(currentWorkerId, currentLocation.coords);
    } catch (error) {
      console.error("Error getting initial location:", error);
      setLocationError("Could not get location. Is GPS on?");
    }
  };

  const startLocationTracking = async (currentWorkerId: string) => {
    if (locationSubscription.current) return;

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      setLocationError("Location permission is required to clock in.");
      return;
    }

    try {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        (newLocation) => {
          setLocation(newLocation.coords);
          sendLocationToBackend(currentWorkerId, newLocation.coords);
        }
      );
    } catch (error) {
      console.error("Failed to start location tracking:", error);
      setLocationError("Could not start location tracking.");
    }
  };

  const stopLocationTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  };

  const sendLocationToBackend = async (
    currentWorkerId: string,
    coords: Location.LocationObjectCoords
  ) => {
    if (!currentWorkerId) return;

    try {
      await fetch(`${API_URL}/workers/${currentWorkerId}/update-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      });
    } catch (error) {
      console.error("Failed to send location to backend:", error);
    }
  };

  async function registerForPushNotificationsAsync(currentWorkerId: string) {
    let token;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Failed to get push token!");
      return;
    }

    try {
      const projectId = "feda72f0-f679-4d6c-8f9a-ff6184cd86eb";
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log("Worker Expo Push Token:", token);
    } catch (e) {
      console.error("Failed to get push token:", e);
      return;
    }

    if (token) {
      try {
        await fetch(`${API_URL}/workers/save-push-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workerId: currentWorkerId, token }),
        });
        console.log("Worker push token saved to backend.");
      } catch (error) {
        console.error("Failed to save worker push token:", error);
      }
    }
  }

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setProfileImage(base64Image);
      Alert.alert("Success", "Profile picture updated. Press 'Save Profile' to apply.");
    }
  };

  const handleSaveProfile = async () => {
    if (!workerId) return;

    setIsSaving(true);

    try {
      const updatedData: any = {
        name,
        age: Number(age) || null,
        gender,
        skills: selectedSkill ? [selectedSkill] : [],
        maxDistance,
        currentLocation: location
          ? {
              latitude: location.latitude,
              longitude: location.longitude,
            }
          : undefined,
        profileImageBase64: profileImage,
      };

      const response = await fetch(`${API_URL}/workers/${workerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) throw new Error("Failed to save profile.");

      Alert.alert("Success", "Your profile has been updated.");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not save your profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClockToggle = async () => {
    if (!workerId) return;

    const endpoint = clockedIn ? "clock-out" : "clock-in";

    if (clockedIn) {
      stopLocationTracking();
    } else {
      await startLocationTracking(workerId);
    }

    try {
      const response = await fetch(`${API_URL}/workers/${workerId}/${endpoint}`, {
        method: "POST",
      });

      if (!response.ok) throw new Error(`Failed to ${endpoint}`);

      setClockedIn(!clockedIn);
      Alert.alert("Success", `You have successfully clocked ${clockedIn ? "out" : "in"}.`);
    } catch (error) {
      Alert.alert("Error", `Could not clock ${clockedIn ? "out" : "in"}.`);
      if (!clockedIn) {
        stopLocationTracking();
      }
    }
  };

  const onDateChange = (event: any, newDate?: Date) => {
    setShowDatePicker(false);

    if (event.type === "set" && newDate) {
      const combinedDate = new Date(selectedDateTime);
      combinedDate.setFullYear(newDate.getFullYear());
      combinedDate.setMonth(newDate.getMonth());
      combinedDate.setDate(newDate.getDate());
      setSelectedDateTime(combinedDate);

      setTimeout(() => {
        setShowTimePicker(true);
      }, 100);
    }
  };

  const onTimeChange = (event: any, newTime?: Date) => {
    setShowTimePicker(false);

    if (event.type === "set" && newTime) {
      const combinedTime = new Date(selectedDateTime);
      combinedTime.setHours(newTime.getHours());
      combinedTime.setMinutes(newTime.getMinutes());
      setSelectedDateTime(combinedTime);
    }
  };

  const handleScheduleJob = (job: any) => {
    setCurrentJobToSchedule(job);

    const jobDate = new Date(job.date);
    const now = new Date();
    setSelectedDateTime(jobDate > now ? jobDate : now);

    const existingBreakdown = job.priceBreakdown;
    if (existingBreakdown && existingBreakdown.length > 0) {
      setPriceBreakdown(
        existingBreakdown.map((item: any) => ({
          item: item.item,
          price: String(item.price),
        }))
      );
    } else {
      if (job.workerPrice) {
        setPriceBreakdown([{ item: "Service Cost", price: String(job.workerPrice) }]);
      } else {
        setPriceBreakdown([{ item: "", price: "" }]);
      }
    }

    setDateTimeModalVisible(true);
  };

  const handleConfirmSchedule = async () => {
    if (!currentJobToSchedule) return;

    const cleanPriceBreakdown = priceBreakdown
      .map((item) => ({
        item: item.item.trim(),
        price: parseFloat(item.price),
      }))
      .filter((item) => item.item && !isNaN(item.price) && item.price > 0);

    if (cleanPriceBreakdown.length === 0) {
      Alert.alert("Invalid Price", "Please add at least one valid item and price.");
      return;
    }

    if (cleanPriceBreakdown.length !== priceBreakdown.length) {
      Alert.alert(
        "Invalid Item",
        "Please ensure all items have a description and a valid price greater than zero."
      );
      return;
    }

    await performStatusUpdate(
      currentJobToSchedule._id,
      "price_pending",
      selectedDateTime.toISOString(),
      cleanPriceBreakdown
    );

    setDateTimeModalVisible(false);
    setCurrentJobToSchedule(null);
    setPriceBreakdown([{ item: "", price: "" }]);
  };

  const performStatusUpdate = async (
    appointmentId: string,
    status: string,
    newDate?: string,
    breakdown?: { item: string; price: number }[]
  ) => {
    const payload: any = { status };
    if (newDate) payload.date = newDate;
    if (breakdown) payload.priceBreakdown = breakdown;

    const updatedAppointments = appointments.map((app) =>
      app._id === appointmentId
        ? { ...app, status, date: newDate || app.date }
        : app
    );
    setAppointments(updatedAppointments);

    try {
      const response = await fetch(`${API_URL}/appointments/${appointmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Failed to update job status to ${status}.`);

      if (status === "en_route") {
        Alert.alert("Success", "Customer has been notified you are on your way!");
      } else if (status === "completed") {
        Alert.alert("Success", `Job status updated to ${status}.`);
      }

      if (workerId) await fetchAppointments(workerId);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not update job status.");
      if (workerId) await fetchAppointments(workerId);
    }
  };

  const handleUpdateJobStatus = async (appointmentId: string, status: string, job?: any) => {
    if (status === "en_route") {
      performStatusUpdate(appointmentId, status);
      return;
    }

    if (status === "confirmed" && job) {
      handleScheduleJob(job);
      return;
    }

    if (status === "cancelled") {
      Alert.alert(
        "Confirm Cancellation",
        "Are you sure you want to cancel this job? The customer will be notified.",
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes, Cancel",
            onPress: () => performStatusUpdate(appointmentId, status),
            style: "destructive",
          },
        ]
      );
      return;
    }

    performStatusUpdate(appointmentId, status);
  };

  const openJobChat = async (job: any) => {
    const customerId = job?.customer?._id || job?.customer;
    const customerName = job?.customer?.name || "Customer";

    if (!job?._id || !customerId) {
      Alert.alert("Chat unavailable", "A customer must be assigned before chat can open.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/chat/conversation/${job._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json().catch(() => ({}));
      console.log("worker chat conversation response:", response.status, data);

      if (!response.ok) {
        throw new Error(data.message || `Chat route failed with status ${response.status}`);
      }

      router.push({
        pathname: "/chat/[appointmentId]",
        params: {
          appointmentId: String(job._id),
          otherUserId: String(customerId),
          otherUserName: customerName,
          appointmentStatus: job.status || "",
        },
      });
    } catch (error: any) {
      console.error("Open worker chat error:", error);
      Alert.alert("Chat error", error.message || "Could not open chat.");
    }
  };

  const canChat = (job: any) => {
    const customerId = job?.customer?._id || job?.customer;
    return (
      !!job?._id &&
      !!customerId &&
      ["pending", "confirmed", "price_pending", "en_route"].includes(
        String(job?.status || "").toLowerCase()
      )
    );
  };

  const handleLogout = () => {
    Alert.alert("Confirm Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        onPress: async () => {
          if (workerId) {
            stopLocationTracking();
            try {
              await fetch(`${API_URL}/workers/save-push-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workerId, token: null }),
              });
            } catch (e) {
              console.error("Failed to remove worker token on logout:", e);
            }
          }

          await AsyncStorage.removeItem("user");
          router.replace("/login");
        },
        style: "destructive",
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return colors.subText;
      case "price_pending":
        return "#ffc107";
      case "confirmed":
        return colors.primaryButton;
      case "en_route":
        return "#3b82f6";
      case "completed":
        return "#10b981";
      case "cancelled":
        return "#dc2626";
      default:
        return colors.subText;
    }
  };

  const renderSkillModal = () => (
    <Modal
      animationType="slide"
      transparent
      visible={skillModalVisible}
      onRequestClose={() => setSkillModalVisible(false)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setSkillModalVisible(false)}>
        <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Select Your Service</Text>
          <ScrollView>
            {ALL_SKILLS.map((skill) => (
              <TouchableOpacity
                key={skill}
                style={[styles.modalOption, { borderBottomColor: colors.inputBorder }]}
                onPress={() => {
                  setSelectedSkill(skill);
                  setSkillModalVisible(false);
                }}
              >
                <Text style={[styles.modalOptionText, { color: colors.text }]}>{skill}</Text>
                {selectedSkill === skill && (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={colors.primaryButton}
                  />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );

  const handleBreakdownChange = (
    index: number,
    field: "item" | "price",
    value: string
  ) => {
    const newBreakdown = [...priceBreakdown];

    if (field === "price") {
      if (/^\d*\.?\d*$/.test(value)) {
        newBreakdown[index][field] = value;
        setPriceBreakdown(newBreakdown);
      }
    } else {
      newBreakdown[index][field] = value;
      setPriceBreakdown(newBreakdown);
    }
  };

  const addBreakdownItem = () => {
    setPriceBreakdown([...priceBreakdown, { item: "", price: "" }]);
  };

  const removeBreakdownItem = (index: number) => {
    if (priceBreakdown.length <= 1) {
      setPriceBreakdown([{ item: "", price: "" }]);
      return;
    }

    const newBreakdown = priceBreakdown.filter((_, i) => i !== index);
    setPriceBreakdown(newBreakdown);
  };

  const calculatedTotal = useMemo(() => {
    return priceBreakdown.reduce((acc, item) => {
      return acc + (parseFloat(item.price) || 0);
    }, 0);
  }, [priceBreakdown]);

  const renderDateTimeModal = () => {
    if (!currentJobToSchedule) return null;

    return (
      <Modal
        animationType="fade"
        transparent
        visible={dateTimeModalVisible}
        onRequestClose={() => setDateTimeModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setDateTimeModalVisible(false)}>
            <Pressable
              style={[
                styles.dateTimeModalContent,
                { backgroundColor: colors.cardBackground },
              ]}
            >
              <ScrollView contentContainerStyle={{ width: "100%" }}>
                <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 10 }]}>
                  Propose Price & Schedule
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: colors.subText, marginBottom: 20, paddingHorizontal: 10 },
                  ]}
                >
                  Set your price quotation and confirm the time for the{" "}
                  <Text style={{ fontWeight: "bold", color: colors.text }}>
                    {currentJobToSchedule.service}
                  </Text>{" "}
                  job.
                </Text>

                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  Price Quotation
                </Text>

                {priceBreakdown.map((item, index) => (
                  <View key={index} style={styles.breakdownItem}>
                    <TextInput
                      style={[
                        styles.breakdownInput,
                        styles.breakdownItemName,
                        {
                          backgroundColor: colors.background,
                          color: colors.text,
                          borderColor: colors.inputBorder,
                        },
                      ]}
                      placeholder="Item (e.g., Labor, Materials)"
                      placeholderTextColor={colors.subText}
                      value={item.item}
                      onChangeText={(text) => handleBreakdownChange(index, "item", text)}
                    />
                    <TextInput
                      style={[
                        styles.breakdownInput,
                        styles.breakdownItemPrice,
                        {
                          backgroundColor: colors.background,
                          color: colors.text,
                          borderColor: colors.inputBorder,
                        },
                      ]}
                      placeholder="Price ($)"
                      placeholderTextColor={colors.subText}
                      value={item.price}
                      onChangeText={(text) => handleBreakdownChange(index, "price", text)}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      onPress={() => removeBreakdownItem(index)}
                      style={styles.removeButton}
                    >
                      <Ionicons name="remove-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity
                  onPress={addBreakdownItem}
                  style={[styles.addButton, { borderColor: colors.primaryButton }]}
                >
                  <Ionicons name="add" size={20} color={colors.primaryButton} />
                  <Text style={[styles.addButtonText, { color: colors.primaryButton }]}>
                    Add Item
                  </Text>
                </TouchableOpacity>

                <View style={styles.totalContainer}>
                  <Text style={[styles.totalText, { color: colors.text }]}>Total:</Text>
                  <Text style={[styles.totalAmount, { color: colors.text }]}>
                    ${calculatedTotal.toFixed(2)}
                  </Text>
                </View>

                <Text style={[styles.inputLabel, { color: colors.text, marginTop: 20 }]}>
                  Confirm Date and Time
                </Text>

                <TouchableOpacity
                  style={[
                    styles.datePickerButton,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.primaryButton} />
                  <Text style={[styles.datePickerButtonText, { color: colors.text }]}>
                    {selectedDateTime.toLocaleDateString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.datePickerButton,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={20} color={colors.primaryButton} />
                  <Text style={[styles.datePickerButtonText, { color: colors.text }]}>
                    {selectedDateTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </TouchableOpacity>

                {Platform.OS === "ios" && (
                  <>
                    <DateTimePicker
                      testID="datePicker"
                      value={selectedDateTime}
                      mode="date"
                      display="spinner"
                      onChange={onDateChange}
                      minimumDate={new Date()}
                      style={styles.datePicker}
                      textColor={colors.text}
                    />
                    <DateTimePicker
                      testID="timePicker"
                      value={selectedDateTime}
                      mode="time"
                      is24Hour
                      display="spinner"
                      onChange={onTimeChange}
                      style={styles.datePicker}
                      textColor={colors.text}
                    />
                  </>
                )}
              </ScrollView>

              <View style={styles.modalActionButtons}>
                <TouchableOpacity
                  onPress={() => setDateTimeModalVisible(false)}
                  style={[styles.modalButton, { backgroundColor: colors.inputBorder }]}
                >
                  <Text style={[styles.statusButtonText, { color: colors.text }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirmSchedule}
                  style={[styles.modalButton, { backgroundColor: colors.primaryButton }]}
                >
                  <Text style={styles.statusButtonText}>Propose & Schedule</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {renderSkillModal()}
      {renderDateTimeModal()}

      {Platform.OS === "android" && showDatePicker && (
        <DateTimePicker
          testID="datePicker"
          value={selectedDateTime}
          mode="date"
          display="default"
          onChange={onDateChange}
          minimumDate={new Date()}
        />
      )}

      {Platform.OS === "android" && showTimePicker && (
        <DateTimePicker
          testID="timePicker"
          value={selectedDateTime}
          mode="time"
          is24Hour
          display="default"
          onChange={onTimeChange}
        />
      )}

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerBar}>
          <Text style={[styles.header, { color: colors.text }]}>My Dashboard</Text>
          <View style={styles.headerIcons}>
            <ThemeToggle />
            <TouchableOpacity onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.subHeader, { color: colors.text }]}>My Service</Text>
        <TouchableOpacity
          style={[
            styles.skillSelector,
            { backgroundColor: colors.cardBackground, borderColor: colors.inputBorder },
          ]}
          onPress={() => setSkillModalVisible(true)}
        >
          <Text
            style={[
              styles.skillSelectorText,
              { color: selectedSkill ? colors.text : colors.subText },
            ]}
          >
            {selectedSkill || "Select your service"}
          </Text>
          <Ionicons name="chevron-down" size={24} color={colors.subText} />
        </TouchableOpacity>

        <View style={[styles.profileSection, { backgroundColor: colors.cardBackground }]}>
          <TouchableOpacity onPress={handlePickImage}>
            <Image
              source={{ uri: profileImage || `https://i.pravatar.cc/100?u=${workerId}` }}
              style={styles.avatar}
            />
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={20} color="white" />
            </View>
          </TouchableOpacity>
          <TextInput
            style={[
              styles.workerNameInput,
              { color: colors.text, borderBottomColor: colors.inputBorder },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="Your Name"
            placeholderTextColor={colors.subText}
          />
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.inputBorder,
            },
          ]}
        >
          <Text style={[styles.label, { color: colors.text }]}>Shift Status</Text>
          <TouchableOpacity
            onPress={handleClockToggle}
            style={[
              styles.clockButton,
              { backgroundColor: clockedIn ? "#ef4444" : "#10b981" },
            ]}
          >
            <Text style={styles.clockText}>{clockedIn ? "Clock Out" : "Clock In"}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.subHeader, { color: colors.text }]}>My Details</Text>
        <View style={[styles.detailsCard, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.label, { color: colors.subText }]}>Age</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.inputBorder,
              },
            ]}
            value={age}
            onChangeText={setAge}
            placeholder="e.g., 30"
            keyboardType="number-pad"
            placeholderTextColor={colors.subText}
          />

          <Text style={[styles.label, { color: colors.subText }]}>Gender</Text>
          <View style={styles.genderContainer}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[
                  styles.genderButton,
                  {
                    backgroundColor:
                      gender === g ? colors.primaryButton : colors.background,
                    borderColor:
                      gender === g ? colors.primaryButton : colors.inputBorder,
                  },
                ]}
                onPress={() => setGender(g)}
              >
                <Text
                  style={{
                    color: gender === g ? colors.primaryButtonText : colors.text,
                    fontSize: 12,
                  }}
                >
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={[styles.subHeader, { color: colors.text }]}>Travel Distance</Text>
        <View style={[styles.detailsCard, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.distanceLabel, { color: colors.text }]}>
            Up to {maxDistance.toFixed(0)} km
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={5}
            maximumValue={100}
            step={5}
            value={maxDistance}
            onSlidingComplete={setMaxDistance}
            minimumTrackTintColor={colors.primaryButton}
            maximumTrackTintColor={colors.inputBorder}
            thumbTintColor={colors.primaryButton}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: colors.primaryButton,
              opacity: isSaving ? 0.6 : 1,
            },
          ]}
          onPress={handleSaveProfile}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>{isSaving ? "Saving..." : "Save Profile"}</Text>
        </TouchableOpacity>

        <Text style={[styles.subHeader, { color: colors.text }]}>Current Location</Text>
        <View style={styles.mapContainer}>
          {location ? (
            <MapView
              style={styles.map}
              region={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              showsUserLocation
              showsMyLocationButton
            />
          ) : (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="large" color={colors.primaryButton} />
              <Text
                style={[
                  styles.loadingText,
                  { color: colors.subText, marginTop: 10 },
                ]}
              >
                {locationError || "Waiting for location..."}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.subHeader, { color: colors.text }]}>My Jobs</Text>

        {appointments.length > 0 ? (
          appointments.map((job) => (
            <View
              key={job._id}
              style={[
                styles.jobCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.inputBorder,
                },
              ]}
            >
              <View style={styles.jobRow}>
                <Text style={[styles.jobTime, { color: colors.primaryButton }]}>
                  {new Date(job.date).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <Text style={[styles.jobStatus, { color: getStatusColor(job.status) }]}>
                  {String(job.status).replace("_", " ")}
                </Text>
              </View>

              <Text style={[styles.jobAddress, { color: colors.text, fontWeight: "bold" }]}>
                {job.service}
              </Text>

              <Text style={[styles.jobAddress, { color: colors.text }]}>
                Client: {job.customer?.name || "Loading..."}
              </Text>

              <Text
                style={[
                  styles.jobAddress,
                  {
                    color: job.totalPrice ? colors.primaryButton : colors.subText,
                    fontWeight: "700",
                  },
                ]}
              >
                Price: {job.totalPrice ? `$${job.totalPrice.toFixed(2)}` : "Awaiting Proposal"}
              </Text>

              {job.priceBreakdown && job.priceBreakdown.length > 0 && (
                <View style={[styles.breakdownBox, { borderColor: colors.inputBorder }]}>
                  <Text style={[styles.breakdownTitle, { color: colors.text }]}>
                    Price Breakdown:
                  </Text>
                  {job.priceBreakdown.map((item: any, index: number) => (
                    <View key={index} style={styles.breakdownRow}>
                      <Text style={[styles.breakdownItemText, { color: colors.subText }]}>
                        {item.item}
                      </Text>
                      <Text style={[styles.breakdownItemText, { color: colors.subText }]}>
                        ${item.price.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={[styles.jobAddress, { color: colors.text, marginTop: 4 }]}>
                Address: {job.address}
              </Text>
              <Text style={[styles.jobDescription, { color: colors.subText }]}>
                Description: {job.description}
              </Text>

              {canChat(job) && (
                <TouchableOpacity
                  style={[styles.chatButton, { backgroundColor: colors.primaryButton }]}
                  onPress={() => openJobChat(job)}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
                  <Text style={styles.chatButtonText}>Chat with Customer</Text>
                </TouchableOpacity>
              )}

              <View style={styles.statusActions}>
                {job.status.toLowerCase() !== "completed" &&
                job.status.toLowerCase() !== "cancelled" ? (
                  <>
                    {(job.status.toLowerCase() === "pending" ||
                      job.status.toLowerCase() === "confirmed") && (
                      <TouchableOpacity
                        onPress={() => handleUpdateJobStatus(job._id, "confirmed", job)}
                        style={[
                          styles.statusButton,
                          { backgroundColor: colors.primaryButton },
                        ]}
                        disabled={job.status.toLowerCase() === "price_pending"}
                      >
                        <Text style={styles.statusButtonText}>
                          {job.status.toLowerCase() === "pending"
                            ? "Propose Price/Time"
                            : "Reschedule"}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {job.status.toLowerCase() === "confirmed" && (
                      <TouchableOpacity
                        onPress={() => handleUpdateJobStatus(job._id, "en_route")}
                        style={[styles.statusButton, { backgroundColor: "#3b82f6" }]}
                      >
                        <Text style={styles.statusButtonText}>On My Way</Text>
                      </TouchableOpacity>
                    )}

                    {job.status.toLowerCase() === "en_route" && (
                      <TouchableOpacity
                        onPress={() => handleUpdateJobStatus(job._id, "completed")}
                        style={[styles.statusButton, { backgroundColor: "#10b981" }]}
                      >
                        <Text style={styles.statusButtonText}>Complete</Text>
                      </TouchableOpacity>
                    )}

                    {job.status.toLowerCase() === "price_pending" && (
                      <View style={[styles.statusButton, { backgroundColor: "#ffc107" }]}>
                        <Text style={styles.statusButtonText}>Price Pending</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => handleUpdateJobStatus(job._id, "cancelled")}
                      style={[styles.statusButton, { backgroundColor: "#dc2626" }]}
                    >
                      <Text style={styles.statusButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text
                    style={[
                      styles.jobStatus,
                      {
                        color: getStatusColor(job.status),
                        fontSize: 16,
                        marginTop: 10,
                        alignSelf: "flex-start",
                      },
                    ]}
                  >
                    Job {job.status}
                  </Text>
                )}
              </View>
            </View>
          ))
        ) : (
          <View
            style={[
              styles.jobCard,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.inputBorder,
                alignItems: "center",
              },
            ]}
          >
            <Text
              style={{
                color: colors.subText,
                textAlign: "center",
                fontSize: 16,
                padding: 20,
              }}
            >
              You have no jobs scheduled.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 10,
  },
  header: { fontSize: 24, fontWeight: "bold" },
  headerIcons: { flexDirection: "row", alignItems: "center", gap: 15 },
  skillSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  skillSelectorText: { fontSize: 16, fontWeight: "600" },
  profileSection: {
    alignItems: "center",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: "#fff" },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
    borderRadius: 15,
  },
  workerNameInput: {
    marginTop: 15,
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    borderBottomWidth: 1,
    paddingBottom: 5,
    width: "80%",
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 8,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  label: { fontSize: 16, fontWeight: "500" },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    alignSelf: "flex-start",
    marginBottom: 5,
  },
  clockButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  clockText: { color: "white", fontWeight: "bold" },
  subHeader: { fontSize: 18, fontWeight: "600", marginTop: 24, marginBottom: 12 },
  detailsCard: { padding: 20, borderRadius: 12, marginBottom: 10 },
  input: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 15,
    width: "100%",
  },
  genderContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genderButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  distanceLabel: { fontSize: 16, fontWeight: "500", textAlign: "center", marginBottom: 10 },
  slider: { width: "100%", height: 40 },
  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
    marginHorizontal: 10,
  },
  saveButtonText: { color: "white", fontSize: 16, fontWeight: "bold" },
  mapContainer: {
    width: "100%",
    height: 250,
    borderRadius: 10,
    marginBottom: 20,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { textAlign: "center", fontStyle: "italic", paddingVertical: 30 },
  jobCard: {
    borderRadius: 12,
    padding: 15,
    marginVertical: 6,
    borderWidth: 1,
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  jobRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  jobTime: { fontSize: 16, fontWeight: "700" },
  jobAddress: { fontSize: 14, marginVertical: 2 },
  jobDescription: { fontSize: 12, fontStyle: "italic", marginVertical: 4 },
  jobStatus: { fontSize: 14, fontWeight: "600", textTransform: "capitalize" },
  statusActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    gap: 10,
    flexWrap: "wrap",
  },
  statusButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: "center" },
  statusButtonText: { color: "white", fontWeight: "bold" },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    width: "90%",
    maxHeight: "70%",
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
  },
  dateTimeModalContent: {
    width: "90%",
    maxWidth: 400,
    maxHeight: "85%",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  datePicker: { width: "100%" },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  datePickerButtonText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
  },
  modalSubtitle: { fontSize: 14, textAlign: "center" },
  modalActionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  modalOptionText: { fontSize: 16 },

  breakdownItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  breakdownInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
  },
  breakdownItemName: {
    flex: 3,
    marginRight: 8,
  },
  breakdownItemPrice: {
    flex: 1.5,
    marginRight: 8,
  },
  removeButton: {
    padding: 4,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: 5,
  },
  addButtonText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: "600",
  },
  totalContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderColor: "#e0e0e0",
  },
  totalText: {
    fontSize: 18,
    fontWeight: "500",
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: "bold",
  },
  breakdownBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  breakdownItemText: {
    fontSize: 14,
  },
  chatButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chatButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});