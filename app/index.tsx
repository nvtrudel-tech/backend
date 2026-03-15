import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import DrywallIcon from "../assets/images/Drywall.png";
import FireAlarmIcon from "../assets/images/fire_alarm.png";
import CarpenterIcon from "../assets/images/hammer.png";
import HeavyEquipIcon from "../assets/images/HeavyEquip.png";
import HomeAutoIcon from "../assets/images/HomeAuto.png";
import HvacIcon from "../assets/images/HVAC.png";
import ElectricianIcon from "../assets/images/logo_elec.png";
import PainterIcon from "../assets/images/PaintBrush.png";
import PlugIcon from "../assets/images/PlugHQ.png";
import PlumberIcon from "../assets/images/Plumbing.png";
import RooferIcon from "../assets/images/roof3.png";
import ThemeToggle from "./components/ThemeToggle";
import { useTheme } from "./context/ThemeContext";

const screenWidth = Dimensions.get("window").width;
const CATEGORY_VIEW_WIDTH = screenWidth;
const API_URL = "https://backend-tknm.onrender.com/api";

const skillIconMap: { [key: string]: any } = {
  Electrician: ElectricianIcon,
  Plumber: PlumberIcon,
  Drywall: DrywallIcon,
  Carpenter: CarpenterIcon,
  Roofer: RooferIcon,
  "Fire/Alarm": FireAlarmIcon,
  "Home Automation": HomeAutoIcon,
  HVAC: HvacIcon,
  Painter: PainterIcon,
  "Heavy Equipment": HeavyEquipIcon,
  default: PlugIcon,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface Worker {
  _id: string;
  name: string;
  skills?: string[];
  currentLocation: {
    type: "Point";
    coordinates: [number, number];
  };
  currentClock: {
    clockedIn: boolean;
  };
}

export default function ElectricianAppView() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const mapRef = useRef<MapView>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const [checkingUser, setCheckingUser] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfilePic, setUserProfilePic] = useState<string | null>(null);
  const [isPressedEmergency, setIsPressedEmergency] = useState(false);
  const [isPressedSchedule, setIsPressedSchedule] = useState(false);

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string>("Getting your location...");
  const [locationError, setLocationError] = useState<string | null>(null);

  const [myAppointments, setMyAppointments] = useState<any[]>([]);
  const [isLoadingAppts, setIsLoadingAppts] = useState(true);
  const [isCancelModalVisible, setIsCancelModalVisible] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<any | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  const [isNegotiationModalVisible, setIsNegotiationModalVisible] = useState(false);
  const [jobToNegotiate, setJobToNegotiate] = useState<any | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(true);

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

  const [selectedService, setSelectedService] = useState<string | null>("Electrician");

  const handleCategoryScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / CATEGORY_VIEW_WIDTH);

    if (newIndex >= 0 && newIndex < categoryLabels.length) {
      const newService = categoryLabels[newIndex];
      if (selectedService !== newService) {
        setSelectedService(newService);
      }
    }
  };

  useEffect(() => {
    (async () => {
      const userString = await AsyncStorage.getItem("user");
      const user = userString ? JSON.parse(userString) : null;

      if (
        user?.role === "worker" ||
        user?.role === "specialist" ||
        user?.userType === "worker" ||
        user?.userType === "specialist" ||
        user?.isWorker === true ||
        user?.isSpecialist === true
      ) {
        router.replace("/worker/dashboard");
        return;
      }

      setIsLoggedIn(!!user);
      setUserId(user?._id || null);
      setUserProfilePic(user?.profileImageBase64 || null);

      if (user?._id) {
        registerForPushNotificationsAsync(user._id);
      } else {
        setIsLoadingAppts(false);
      }

      const savedService = await AsyncStorage.getItem("selectedService");
      const initialService = savedService || "Electrician";
      setSelectedService(initialService);

      const savedIndex = categoryLabels.findIndex((label) => label === initialService);
      if (savedIndex !== -1) {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            x: savedIndex * CATEGORY_VIEW_WIDTH,
            animated: false,
          });
        }, 100);
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Permission to access location was denied");
        setIsLoadingWorkers(false);
        setCheckingUser(false);
        return;
      }

      try {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });

        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });

        await reverseGeocode(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude
        );
      } catch (error) {
        console.error("Error getting location:", error);
        setLocationError("Could not get your location. Please ensure GPS is on.");
        setIsLoadingWorkers(false);
      } finally {
        setCheckingUser(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!userId) {
      setIsLoadingAppts(false);
      return;
    }

    fetchAppointments(userId);

    const interval = setInterval(() => {
      fetchAppointments(userId);
    }, 5000);

    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    if (!location) {
      setIsLoadingWorkers(false);
      return;
    }

    fetchNearbyWorkers(location.latitude, location.longitude);

    const interval = setInterval(() => {
      fetchNearbyWorkers(location.latitude, location.longitude);
    }, 10000);

    return () => clearInterval(interval);
  }, [location]);

  useEffect(() => {
    if (selectedService) {
      AsyncStorage.setItem("selectedService", selectedService);
    }
  }, [selectedService]);

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const addr = results[0];
        const addressString = `${addr.city || addr.name || ""}, ${addr.region || ""}`;
        setCurrentAddress(addressString);
      }
    } catch (error) {
      console.error("Reverse geocode error:", error);
      setCurrentAddress("Could not find address");
    }
  };

  const fetchNearbyWorkers = async (latitude: number, longitude: number) => {
    setIsLoadingWorkers(true);
    try {
      const response = await fetch(
        `${API_URL}/workers/nearby?latitude=${latitude}&longitude=${longitude}&radius=10000`
      );
      if (!response.ok) throw new Error("Failed to fetch workers");

      const nearbyWorkers: Worker[] = await response.json();

      if (JSON.stringify(nearbyWorkers) !== JSON.stringify(workers)) {
        setWorkers(nearbyWorkers);
      }
    } catch (error: any) {
      console.error("Fetch nearby workers error:", error);
    } finally {
      setIsLoadingWorkers(false);
    }
  };

  const fetchAppointments = async (currentUserId: string) => {
    try {
      const response = await fetch(`${API_URL}/appointments`);
      if (!response.ok) throw new Error("Failed to fetch appointments");

      const allAppointments = await response.json();

      const relevantStatuses = ["pending", "confirmed", "price_pending", "en_route"];

      const userAppointments = allAppointments.filter(
        (app: any) =>
          app.customer?._id === currentUserId &&
          relevantStatuses.includes(app.status)
      );

      userAppointments.sort(
        (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      if (JSON.stringify(userAppointments) !== JSON.stringify(myAppointments)) {
        setMyAppointments(userAppointments);
      }
    } catch (error: any) {
      console.error("Poll appointments error:", error);
    } finally {
      setIsLoadingAppts(false);
    }
  };

  async function registerForPushNotificationsAsync(currentUserId: string) {
    let token: string | undefined;

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
      console.log("Permission not granted to get push token!");
      return;
    }

    try {
      const projectId = "feda72f0-f679-4d6c-8f9a-ff6184cd86eb";
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log("Customer Expo Push Token:", token);
    } catch (e) {
      console.error("Failed to get push token:", e);
      return;
    }

    if (token) {
      try {
        await fetch(`${API_URL}/auth/save-push-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUserId, token }),
        });
        console.log("Customer push token saved to backend.");
      } catch (error) {
        console.error("Failed to save customer push token:", error);
      }
    }
  }

  const handleSchedulePress = () => {
    if (!isLoggedIn) {
      Alert.alert("Please Log In", "You must be logged in to schedule an appointment.", [
        { text: "Cancel", style: "cancel" },
        { text: "Log In", onPress: () => router.push("/login") },
      ]);
      return;
    }

    if (!selectedService) {
      Alert.alert(
        t("home.noServiceTitle", { defaultValue: "No Service Selected" }),
        t("home.noServiceMessage", {
          defaultValue: "Please select a service from the list to continue.",
        }),
        [{ text: "OK" }]
      );
      return;
    }

    router.push({ pathname: "/calendar", params: { service: selectedService } });
  };

  const handleEmergencyCall = () => Linking.openURL("tel://5148920801");

  const handleLogout = () => {
    Alert.alert("Confirm Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        onPress: async () => {
          if (userId) {
            try {
              await fetch(`${API_URL}/auth/save-push-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, token: null }),
              });
            } catch (e) {
              console.error("Failed to remove customer token on logout:", e);
            }
          }

          await AsyncStorage.removeItem("user");
          setIsLoggedIn(false);
          setUserId(null);
          setMyAppointments([]);
          setUserProfilePic(null);
          router.replace("/login");
        },
        style: "destructive",
      },
    ]);
  };

  const handleTabPress = () => {
    if (isLoggedIn) {
      handleLogout();
    } else {
      router.push("/login");
    }
  };

  const showCancelModal = (appointment: any) => {
    setAppointmentToCancel(appointment);
    setCancellationReason("");
    setIsCancelModalVisible(true);
  };

  const handleDeleteAppointment = async () => {
    if (!appointmentToCancel) return;
    setIsCancelling(true);

    try {
      const response = await fetch(`${API_URL}/appointments/${appointmentToCancel._id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to cancel appointment.");
      }

      setMyAppointments((prev) =>
        prev.filter((app) => app._id !== appointmentToCancel._id)
      );

      Alert.alert("Success", "Your appointment has been cancelled.");
    } catch (error: any) {
      console.error("Cancel appointment error:", error);
      Alert.alert("Error", error.message || "Could not cancel appointment.");
    } finally {
      setIsCancelling(false);
      setIsCancelModalVisible(false);
      setAppointmentToCancel(null);
    }
  };

  const handleCancelOrReschedule = async (action: "reschedule" | "cancel") => {
    if (!appointmentToCancel || !userId) return;

    setIsCancelling(true);
    const newStatus = action === "reschedule" ? "pending" : "cancelled";
    const appointmentId = appointmentToCancel._id;

    const payload: any = { status: newStatus };
    if (action === "cancel" && cancellationReason.trim()) {
      payload.cancellationReason = cancellationReason.trim();
    }

    try {
      const response = await fetch(`${API_URL}/appointments/${appointmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Failed to ${action} appointment.`);

      Alert.alert(
        "Success",
        action === "reschedule"
          ? "Reschedule requested. The specialist will be notified."
          : "Appointment cancelled. The specialist has been notified."
      );

      fetchAppointments(userId);
    } catch (error: any) {
      console.error("Cancel/Reschedule error:", error);
      Alert.alert("Error", error.message || `Could not ${action} appointment.`);
    } finally {
      setIsCancelling(false);
      setIsCancelModalVisible(false);
      setAppointmentToCancel(null);
      setCancellationReason("");
    }
  };

  const showNegotiationModal = (job: any) => {
    setJobToNegotiate(job);
    setIsNegotiationModalVisible(true);
  };

  const handleNegotiationAction = async (
    status: "confirmed" | "pending" | "cancelled"
  ) => {
    if (!jobToNegotiate || !userId) return;

    setIsUpdatingStatus(true);
    const appointmentId = jobToNegotiate._id;
    const payload: any = { status };
    payload.date = jobToNegotiate.date;
    payload.priceBreakdown = jobToNegotiate.priceBreakdown;

    try {
      const response = await fetch(`${API_URL}/appointments/${appointmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Failed to perform action: ${status}`);

      Alert.alert(
        "Success",
        status === "confirmed"
          ? "Price accepted! Your appointment is confirmed."
          : status === "pending"
            ? "Price rejected. The specialist will be notified to send a new proposal."
            : "Appointment cancelled."
      );

      fetchAppointments(userId);
    } catch (error: any) {
      console.error("Negotiation action error:", error);
      Alert.alert("Error", error.message || `Could not update status to ${status}.`);
    } finally {
      setIsUpdatingStatus(false);
      setIsNegotiationModalVisible(false);
      setJobToNegotiate(null);
    }
  };

  const openAppointmentChat = async (app: any) => {
    const workerId = app?.worker?._id || app?.worker;
    const workerName = app?.worker?.name || "Specialist";

    if (!app?._id || !workerId) {
      Alert.alert("Chat unavailable", "A worker must be assigned before chat can open.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/chat/conversation/${app._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json().catch(() => ({}));
      console.log("chat conversation response:", response.status, data);

      if (!response.ok) {
        throw new Error(data.message || `Chat route failed with status ${response.status}`);
      }

      router.push({
        pathname: "/chat/[appointmentId]",
        params: {
          appointmentId: String(app._id),
          otherUserId: String(workerId),
          otherUserName: workerName,
          appointmentStatus: app.status || "",
        },
      });
    } catch (error: any) {
      console.error("Open chat error:", error);
      Alert.alert("Chat error", error.message || "Could not open chat.");
    }
  };

  const renderCancelModal = () => {
    if (!appointmentToCancel) return null;

    const isNegotiation =
      appointmentToCancel.status === "confirmed" ||
      appointmentToCancel.status === "price_pending";

    return (
      <Modal
        animationType="fade"
        transparent
        visible={isCancelModalVisible}
        onRequestClose={() => setIsCancelModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsCancelModalVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {isNegotiation
                ? t("cancel.rescheduleTitle", { defaultValue: "Reschedule or Cancel" })
                : t("cancelModal.title", { defaultValue: "Cancel Appointment" })}
            </Text>

            <Text style={[styles.modalMessage, { color: colors.subText }]}>
              {isNegotiation
                ? t("cancel.rescheduleMessage", {
                    defaultValue: "Would you like to reschedule or cancel this appointment?",
                  })
                : t("cancelModal.message", {
                    defaultValue: "Click cancel to delete this appointment.",
                  })}
            </Text>

            {isNegotiation ? (
              <View>
                <TextInput
                  style={[
                    styles.modalTextInput,
                    {
                      borderColor: colors.inputBorder,
                      color: colors.text,
                      backgroundColor: colors.inputBackground || colors.background,
                    },
                  ]}
                  placeholder={t(
                    "cancelModal.reasonPlaceholder",
                    "Reason for cancellation (optional)"
                  )}
                  placeholderTextColor={colors.subText}
                  value={cancellationReason}
                  onChangeText={setCancellationReason}
                  multiline
                />

                <View style={styles.modalButtonContainer}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.primaryButton }]}
                    onPress={() => handleCancelOrReschedule("reschedule")}
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalButtonText}>
                        {t("cancelModal.reschedule", { defaultValue: "Reschedule" })}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: "#ef4444" }]}
                    onPress={() => handleCancelOrReschedule("cancel")}
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalButtonText}>
                        {t("cancelModal.cancelJob", { defaultValue: "Cancel Job" })}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      { backgroundColor: colors.inputBorder, width: "100%", marginTop: 10 },
                    ]}
                    onPress={() => setIsCancelModalVisible(false)}
                    disabled={isCancelling}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.text }]}>
                      {t("cancelModal.keep", { defaultValue: "Keep" })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.inputBorder }]}
                  onPress={() => setIsCancelModalVisible(false)}
                  disabled={isCancelling}
                >
                  <Text style={[styles.modalButtonText, { color: colors.text }]}>
                    {t("cancelModal.keep", { defaultValue: "Keep" })}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: "#ef4444" }]}
                  onPress={handleDeleteAppointment}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[styles.modalButtonText, { color: "#fff" }]}>
                      {t("cancelModal.cancel", { defaultValue: "Cancel" })}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const renderNegotiationModal = () => {
    if (!jobToNegotiate) return null;

    const proposedPrice = jobToNegotiate.totalPrice
      ? `$${jobToNegotiate.totalPrice.toFixed(2)}`
      : "N/A";

    const proposedDate = new Date(jobToNegotiate.date).toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    const proposedTime = new Date(jobToNegotiate.date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <Modal
        animationType="fade"
        transparent
        visible={isNegotiationModalVisible}
        onRequestClose={() => setIsNegotiationModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsNegotiationModalVisible(false)}
        >
          <Pressable style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <ScrollView>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("negotiation.reviewTitle")}
              </Text>

              <Text style={[styles.modalMessage, { color: colors.text, fontWeight: "bold" }]}>
                {jobToNegotiate.service} Job
              </Text>

              <View style={styles.proposalDetail}>
                <Text style={[styles.proposalLabel, { color: colors.subText }]}>
                  {t("negotiation.dateTime")}
                </Text>
                <Text
                  style={[
                    styles.proposalValue,
                    { color: colors.text, flexShrink: 1, textAlign: "right" },
                  ]}
                >
                  {proposedDate} at {proposedTime}
                </Text>
              </View>

              {jobToNegotiate.priceBreakdown && jobToNegotiate.priceBreakdown.length > 0 && (
                <View
                  style={[
                    styles.priceBreakdownBox,
                    {
                      borderColor: colors.inputBorder,
                      marginTop: 15,
                      padding: 10,
                      borderWidth: 1,
                      borderRadius: 8,
                    },
                  ]}
                >
                  <Text style={[styles.priceBreakdownTitle, { color: colors.text }]}>
                    {t("home.priceBreakdown", "Price Breakdown")}:
                  </Text>

                  {jobToNegotiate.priceBreakdown.map((item: any, index: number) => (
                    <View key={index} style={styles.priceBreakdownRow}>
                      <Text style={[styles.priceBreakdownItemText, { color: colors.subText }]}>
                        {item.item}
                      </Text>
                      <Text style={[styles.priceBreakdownItemText, { color: colors.subText }]}>
                        ${item.price.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View
                style={[
                  styles.proposalDetail,
                  {
                    marginTop: 10,
                    borderTopWidth: 2,
                    borderTopColor: colors.inputBorder,
                    paddingTop: 10,
                  },
                ]}
              >
                <Text style={[styles.proposalLabel, { color: colors.subText, fontSize: 18 }]}>
                  {t("negotiation.totalPrice", "Total Price")}
                </Text>
                <Text
                  style={[styles.proposalValue, { color: colors.primaryButton, fontSize: 18 }]}
                >
                  {proposedPrice}
                </Text>
              </View>

              <Text
                style={[
                  styles.modalMessage,
                  { color: colors.subText, fontSize: 14, marginTop: 15 },
                ]}
              >
                {t("negotiation.prompt")}
              </Text>

              <View style={styles.modalButtonContainer}>
                <TouchableOpacity
                  style={[styles.modalButtonSmall, { backgroundColor: "#10b981", flex: 2 }]}
                  onPress={() => handleNegotiationAction("confirmed")}
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonText}>{t("negotiation.accept")}</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButtonSmall, { backgroundColor: colors.inputBorder }]}
                  onPress={() => handleNegotiationAction("pending")}
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[styles.modalButtonText, { color: colors.text }]}>
                      {t("negotiation.reject")}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButtonSmall, { backgroundColor: "#ef4444" }]}
                  onPress={() => handleNegotiationAction("cancelled")}
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonText}>{t("negotiation.cancel")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const renderMyAppointments = () => {
    if (!isLoggedIn) return null;

    if (isLoadingAppts) {
      return (
        <ActivityIndicator
          size="large"
          color={colors.primaryButton}
          style={{ marginTop: 20 }}
        />
      );
    }

    const getStatusColor = (status: string) => {
      switch (status?.toLowerCase()) {
        case "pending":
          return colors.subText;
        case "price_pending":
          return "#ffc107";
        case "confirmed":
          return "#10b981";
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

    const getStatusText = (app: any) => {
      const status = app.status;
      if (status === "price_pending") {
        const price = app.totalPrice ? app.totalPrice.toFixed(2) : "...";
        return t("status.price_pending", { price: `$${price}` });
      }
      if (status === "en_route") {
        return t("status.en_route", { defaultValue: "Specialist is on the way" });
      }
      return t(`status.${status}`, { defaultValue: app.status });
    };

    const canChat = (app: any) => {
      const workerId = app?.worker?._id || app?.worker;
      return (
        !!app?._id &&
        !!workerId &&
        ["pending", "confirmed", "price_pending", "en_route"].includes(app.status)
      );
    };

    return (
      <View style={styles.listContainer}>
        <Text style={[styles.listHeader, { color: colors.text }]}>
          {t("home.myAppointments")}
        </Text>

        {myAppointments.length === 0 ? (
          <Text style={[styles.emptyListText, { color: colors.subText }]}>
            {t("home.noAppointments")}
          </Text>
        ) : (
          myAppointments.map((app) => (
            <View
              key={app._id}
              style={[
                styles.appointmentCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.inputBorder,
                },
              ]}
            >
              <View style={styles.appointmentDetails}>
                <Text style={[styles.appointmentService, { color: colors.primaryButton }]}>
                  {app.service}
                </Text>

                <Text style={[styles.appointmentDate, { color: colors.text }]}>
                  {new Date(app.date).toLocaleDateString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                  {" at "}
                  {new Date(app.date).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>

                <Text style={[styles.appointmentWorker, { color: colors.subText }]}>
                  {t("home.specialist")}: {app.worker?.name || "Assigning..."}
                </Text>

                <Text
                  style={[
                    styles.appointmentTotal,
                    { color: app.totalPrice ? colors.primaryButton : colors.subText },
                  ]}
                >
                  {t("home.price", "Price")}:{" "}
                  {app.totalPrice
                    ? `$${app.totalPrice.toFixed(2)}`
                    : t("status.pending", "Pending")}
                </Text>

                {app.priceBreakdown && app.priceBreakdown.length > 0 && (
                  <View style={[styles.priceBreakdownBox, { borderTopColor: colors.inputBorder }]}>
                    <Text style={[styles.priceBreakdownTitle, { color: colors.text }]}>
                      {t("home.priceBreakdown", "Price Breakdown")}:
                    </Text>

                    {app.priceBreakdown.map((item: any, index: number) => (
                      <View key={index} style={styles.priceBreakdownRow}>
                        <Text style={[styles.priceBreakdownItemText, { color: colors.subText }]}>
                          {item.item}
                        </Text>
                        <Text style={[styles.priceBreakdownItemText, { color: colors.subText }]}>
                          ${item.price.toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={[styles.appointmentStatus, { color: getStatusColor(app.status) }]}>
                  {t("home.status")}: {getStatusText(app)}
                </Text>

                {canChat(app) && (
                  <TouchableOpacity
                    style={[styles.chatButton, { backgroundColor: colors.primaryButton }]}
                    onPress={() => openAppointmentChat(app)}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
                    <Text style={styles.chatButtonText}>Chat</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.cardActionColumn}>
                {app.status === "price_pending" ? (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: "#ffc107" }]}
                    onPress={() => showNegotiationModal(app)}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.text }]}>
                      {t("home.reviewPrice")}
                    </Text>
                  </TouchableOpacity>
                ) : (app.status === "pending" || app.status === "confirmed") && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => showCancelModal(app)}
                  >
                    <Text style={styles.cancelButtonText}>
                      {t("home.cancel", { defaultValue: "Cancel" })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    );
  };

  const renderWorkerMarkers = () => {
    if (!workers || workers.length === 0) return null;

    return workers
      .filter(
        (worker) =>
          worker.currentLocation?.coordinates &&
          worker.currentLocation.coordinates.length === 2 &&
          (worker.currentLocation.coordinates[0] !== 0 ||
            worker.currentLocation.coordinates[1] !== 0)
      )
      .map((worker) => {
        const [longitude, latitude] = worker.currentLocation.coordinates;
        const primarySkill = worker.skills?.[0] || "default";
        const markerIcon = skillIconMap[primarySkill] || skillIconMap.default;

        return (
          <Marker
            key={worker._id}
            coordinate={{ latitude, longitude }}
            title={worker.name}
            description={primarySkill || "Specialist"}
          >
            <Image source={markerIcon} style={styles.workerMarkerImage} />
          </Marker>
        );
      });
  };

  if (checkingUser) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.primaryButton} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {renderCancelModal()}
      {renderNegotiationModal()}

      <LinearGradient colors={colors.gradient} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 80 }} nestedScrollEnabled>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.push("/profile")} style={styles.headerIcon}>
              <Ionicons name="hammer" size={26} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>{t("home.title")}</Text>
            <ThemeToggle />
          </View>

          <View style={[styles.locationBanner, { backgroundColor: colors.cardBackground }]}>
            <Ionicons name="location-sharp" size={18} color={colors.primaryButton} />
            <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={1}>
              {currentAddress}
            </Text>
          </View>

          <View style={styles.categoryGalleryWrapper}>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleCategoryScroll}
              scrollEventThrottle={16}
              contentContainerStyle={styles.categoryGalleryContainer}
              snapToInterval={CATEGORY_VIEW_WIDTH}
              decelerationRate="fast"
            >
              {categoryLabels.map((label, index) => (
                <View key={index} style={[styles.categoryItem, { width: CATEGORY_VIEW_WIDTH }]}>
                  <Image source={categoryImages[index]} style={styles.galleryImage} />
                  <Text style={[styles.serviceTitle, { color: colors.text }]}>
                    {t(`categories:${label}`, { defaultValue: label })}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity
            onPress={handleSchedulePress}
            onPressIn={() => setIsPressedSchedule(true)}
            onPressOut={() => setIsPressedSchedule(false)}
            disabled={!selectedService}
            style={[
              styles.button,
              {
                opacity: isPressedSchedule || !selectedService ? 0.8 : 1,
                transform: [{ scale: isPressedSchedule ? 0.95 : 1 }],
                backgroundColor: colors.cardBackground,
              },
              !selectedService && styles.buttonDisabled,
            ]}
          >
            <Text
              style={[
                styles.buttonText,
                { color: colors.primaryButton },
                !selectedService && { color: colors.subText },
              ]}
            >
              {t("home.scheduleButton")}
            </Text>
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
            <Text style={styles.emergencyText}>{t("home.emergencyButton")}</Text>
            <Image source={require("../assets/images/phone_12.jpg")} style={styles.phoneIcon} />
          </TouchableOpacity>

          <View style={styles.mapContainer}>
            {location ? (
              <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                showsMyLocationButton
              >
                <Marker coordinate={location} title="You are here">
                  <View style={[styles.userMarkerOuter, { backgroundColor: colors.primaryButton }]}>
                    <Image
                      source={{
                        uri: userProfilePic || "https://placehold.co/60x60/FFF/FFF?text=.",
                      }}
                      style={styles.userMarkerImage}
                    />
                  </View>
                </Marker>

                {renderWorkerMarkers()}
              </MapView>
            ) : (
              <View style={styles.mapLoading}>
                {locationError ? (
                  <Text style={{ color: colors.subText, textAlign: "center" }}>
                    {locationError}
                  </Text>
                ) : (
                  <>
                    <ActivityIndicator size="large" color={colors.primaryButton} />
                    <Text style={{ marginTop: 10, color: colors.subText }}>
                      Finding nearby specialists...
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>

          {renderMyAppointments()}
        </ScrollView>

        <View style={[styles.tabBarContainer, { borderTopColor: colors.inputBorder }]}>
          <View style={[styles.tabBar, { backgroundColor: colors.cardBackground }]}>
            <TouchableOpacity onPress={() => router.push("/")} style={styles.iconButton}>
              <Ionicons name="home-outline" size={26} color={colors.subText} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleTabPress} style={styles.iconButton}>
              <Ionicons
                name={isLoggedIn ? "log-out-outline" : "log-in-outline"}
                size={26}
                color={colors.subText}
              />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 10,
    alignItems: "center",
  },
  headerIcon: {
    padding: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },

  locationBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginHorizontal: 15,
    marginTop: 5,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  locationText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
    flex: 1,
  },

  categoryGalleryWrapper: {
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 5,
    height: 170,
    width: screenWidth,
  },
  categoryGalleryContainer: {
    paddingHorizontal: 0,
    alignItems: "flex-start",
  },
  categoryItem: {
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
    elevation: 0,
  },
  galleryImage: {
    width: 160,
    height: 100,
    resizeMode: "contain",
  },
  serviceTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },

  button: {
    alignSelf: "center",
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    width: screenWidth * 0.75,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },

  emergencyButton: {
    alignSelf: "center",
    marginTop: 15,
    backgroundColor: "#ef4444",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    width: screenWidth * 0.75,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  emergencyText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
    marginRight: 8,
  },
  phoneIcon: {
    width: 20,
    height: 20,
  },

  mapContainer: {
    marginTop: 25,
    height: 250,
    borderRadius: 15,
    overflow: "hidden",
    marginHorizontal: 15,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f0f0f0",
  },
  mapLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  workerMarkerImage: {
    width: 40,
    height: 40,
    resizeMode: "contain",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  userMarkerOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  userMarkerImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: "#fff",
  },

  tabBarContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 25 : 12,
  },
  iconButton: {
    padding: 10,
    borderRadius: 20,
    alignItems: "center",
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalContent: {
    width: "90%",
    maxWidth: 400,
    borderRadius: 15,
    padding: 25,
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  modalMessage: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 25,
  },
  modalTextInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 10,
    flexWrap: "wrap",
  },
  modalButton: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 100,
    alignItems: "center",
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    flexGrow: 1,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  modalButtonSmall: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    marginHorizontal: 4,
    alignItems: "center",
    elevation: 1,
  },
  proposalDetail: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    marginHorizontal: 10,
    alignItems: "center",
  },
  proposalLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  proposalValue: {
    fontSize: 15,
    fontWeight: "bold",
  },

  listContainer: {
    marginTop: 30,
    paddingHorizontal: 15,
  },
  listHeader: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  emptyListText: {
    textAlign: "center",
    fontStyle: "italic",
    fontSize: 16,
    paddingVertical: 30,
  },
  appointmentCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  appointmentDetails: {
    flex: 1,
    marginRight: 10,
  },
  cardActionColumn: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  appointmentService: {
    fontSize: 16,
    fontWeight: "bold",
  },
  appointmentDate: {
    fontSize: 14,
    marginVertical: 3,
  },
  appointmentWorker: {
    fontSize: 13,
    fontStyle: "italic",
  },
  appointmentTotal: {
    fontSize: 14,
    fontWeight: "bold",
    marginVertical: 3,
  },
  appointmentStatus: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 8,
    textTransform: "capitalize",
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    fontWeight: "bold",
    fontSize: 14,
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#fee2e2",
  },
  cancelButtonText: {
    color: "#ef4444",
    fontWeight: "bold",
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

  priceBreakdownBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  priceBreakdownTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
  },
  priceBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  priceBreakdownItemText: {
    fontSize: 13,
  },
});