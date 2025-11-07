import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Notifications from 'expo-notifications';
import { useRouter } from "expo-router";

// --- CUSTOM MARKER ICONS ---
// Paths are relative to the 'app' folder, so '..' goes to the root
import PlugIcon from "../assets/images/PlugHQ.png";       // For "Connexions"
import ElectricianIcon from "../assets/images/logo_elec.png"; // For other electricians
import PlumberIcon from "../assets/images/Plumbing.png";  // For plumbers
import DrywallIcon from "../assets/images/Drywall.png";
import CarpenterIcon from "../assets/images/hammer.png";
import RooferIcon from "../assets/images/roof3.png";
import FireAlarmIcon from "../assets/images/fire_alarm.png";
import HomeAutoIcon from "../assets/images/HomeAuto.png";
import HvacIcon from "../assets/images/HVAC.png";
import PainterIcon from "../assets/images/PaintBrush.png";
import HeavyEquipIcon from "../assets/images/HeavyEquip.png";
// ---

import React, { useEffect, useState, useRef } from "react"; 
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert, Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import MapView, { Marker } from "react-native-maps"; 
import { SafeAreaView } from "react-native-safe-area-context";

// --- FIXED PATHS ---
// Paths are relative to 'app/index.tsx', so './' looks inside 'app'
import ThemeToggle from "./components/ThemeToggle";
import { useTheme } from "./context/ThemeContext";
// ---

const screenWidth = Dimensions.get("window").width;

// --- API URL SWITCH ---
const USE_LOCAL_BACKEND = true; 

const API_URL = "https://backend-tknm.onrender.com/api";
// --------------------

// --- Skill to Icon Map ---
// This map links a worker's skill to the imported logo
const skillIconMap: { [key: string]: any } = {
  "Electrician": ElectricianIcon,
  "Plumber": PlumberIcon,
  "Drywall": DrywallIcon,
  "Carpenter": CarpenterIcon,
  "Roofer": RooferIcon,
  "Fire/Alarm": FireAlarmIcon,
  "Home Automation": HomeAutoIcon,
  "HVAC": HvacIcon,
  "Painter": PainterIcon,
  "Heavy Equipment": HeavyEquipIcon,
  // Use PlugIcon as the default for any other skill
  "default": PlugIcon, 
};
// ---

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// --- Worker Interface ---
interface Worker {
  _id: string;
  name: string;
  skills?: string[];
  currentLocation: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  currentClock: {
    clockedIn: boolean;
  };
}
// ---

export default function ElectricianAppView() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfilePic, setUserProfilePic] = useState<string | null>(null); 
  const [isPressedEmergency, setIsPressedEmergency] = useState(false);
  const [isPressedSchedule, setIsPressedSchedule] = useState(false);
  
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string>("Getting your location..."); 
  const [locationError, setLocationError] = useState<string | null>(null); 
  const mapRef = useRef<MapView>(null); 

  const [myAppointments, setMyAppointments] = useState<any[]>([]);
  const [isLoadingAppts, setIsLoadingAppts] = useState(true);
  const [isCancelModalVisible, setIsCancelModalVisible] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<any | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  
  const [isNegotiationModalVisible, setIsNegotiationModalVisible] = useState(false);
  const [jobToNegotiate, setJobToNegotiate] = useState<any | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [workers, setWorkers] = useState<Worker[]>([]); 
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(true);

  const categoryLabels = [
    "Electrician", "Plumber", "Drywall", "Carpenter", "Roofer",
    "Fire/Alarm", "Home Automation", "HVAC", "Painter", "Heavy Equipment",
  ];
  // --- FIXED PATHS ---
  const categoryImages = [
    require("../assets/images/logo_elec.png"), require("../assets/images/Plumbing.png"),
    require("../assets/images/Drywall.png"), require("../assets/images/hammer.png"),
    require("../assets/images/roof3.png"), require("../assets/images/fire_alarm.png"),
    require("../assets/images/HomeAuto.png"), require("../assets/images/HVAC.png"),
    require("../assets/images/PaintBrush.png"), require("../assets/images/HeavyEquip.png"),
  ];
  // ---
  const [open, setOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>("Electrician");
  const [items, setItems] = useState(
    categoryLabels.map((label, index) => ({
      label: t(`categories:${label}`, { defaultValue: label }),
      value: label,
      icon: () => <Image source={categoryImages[index]} style={styles.dropdownIcon} />
    }))
  );
  // ---

  // (useEffect for initialization is unchanged)
  useEffect(() => {
    (async () => {
      // 1. Check login status
      const userString = await AsyncStorage.getItem("user");
      const user = userString ? JSON.parse(userString) : null;
      setIsLoggedIn(!!user);
      setUserId(user?._id || null);
      setUserProfilePic(user?.profileImageBase64 || null); 

      if (user) {
        registerForPushNotificationsAsync(user._id);
      } else {
        setIsLoadingAppts(false);
      }

      // 2. Get location permissions
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Permission to access location was denied");
        setIsLoadingWorkers(false);
        return;
      }
      
      // 3. Get HIGH-ACCURACY Location
      try {
        let currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation, 
        });
        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        
        // 4. Reverse Geocode the location
        await reverseGeocode(currentLocation.coords.latitude, currentLocation.coords.longitude);

      } catch (error) {
        console.error("Error getting location:", error);
        setLocationError("Could not get your location. Please ensure GPS is on.");
        setIsLoadingWorkers(false);
      }
    })();
  }, []);
  
  // (useEffect for fetching appointments is unchanged)
  useEffect(() => {
    if (!userId) {
      setIsLoadingAppts(false);
      return;
    };
    
    fetchAppointments(userId);
    const interval = setInterval(() => {
      fetchAppointments(userId);
    }, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  // (useEffect for fetching WORKERS is unchanged)
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

  // (reverseGeocode function is unchanged)
  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const addr = results[0];
        const addressString = `${addr.city || addr.name}, ${addr.region || ''}`;
        setCurrentAddress(addressString);
      }
    } catch (error) {
      console.error("Reverse geocode error:", error);
      setCurrentAddress("Could not find address");
    }
  };
  
  // (validateAddress function is unchanged)
  const validateAddress = async (addressString: string) => {
    if (!addressString || addressString.length < 5) {
      Alert.alert("Invalid Address", "Please enter a more specific address.");
      return null;
    }
    try {
      const geocodedLocations = await Location.geocodeAsync(addressString);
      if (geocodedLocations.length === 0) {
        Alert.alert("Address Not Found", "We couldn't find that address. Please check the spelling.");
        return null;
      }
      const { latitude, longitude } = geocodedLocations[0];
      console.log('Validated address:', geocodedLocations[0]);
      return { latitude, longitude };
    } catch (error) {
      console.error("Geocode error:", error);
      Alert.alert("Error", "Could not verify address.");
      return null;
    }
  };

  // (fetchNearbyWorkers function is unchanged)
  const fetchNearbyWorkers = async (latitude: number, longitude: number) => {
    setIsLoadingWorkers(true);
    try {
      const response = await fetch(
        `${API_URL}/workers/nearby?latitude=${latitude}&longitude=${longitude}&radius=10000` // 10km radius
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

  // (fetchAppointments function is unchanged)
  const fetchAppointments = async (currentUserId: string) => {
    try {
      const response = await fetch(`${API_URL}/appointments`);
      if (!response.ok) throw new Error("Failed to fetch appointments");
      const allAppointments = await response.json();
      const relevantStatuses = ['pending', 'confirmed', 'price_pending', 'en_route'];
      const userAppointments = allAppointments.filter(
        (app: any) => app.customer?._id === currentUserId && relevantStatuses.includes(app.status)
      );
      userAppointments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (JSON.stringify(userAppointments) !== JSON.stringify(myAppointments)) {
         setMyAppointments(userAppointments);
      }
    } catch (error: any) {
      console.error("Poll appointments error:", error);
    } finally {
      setIsLoadingAppts(false);
    }
  };

  // (registerForPushNotificationsAsync function is unchanged)
  async function registerForPushNotificationsAsync(currentUserId: string) {
    let token;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Permission not granted to get push token!');
      return;
    }
    try {
      const projectId = 'feda72f0-f679-4d6c-8f9a-ff6184cd86eb';
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log("Customer Expo Push Token:", token);
    } catch (e) {
      console.error("Failed to get push token:", e);
      return;
    }
    if (token) {
      try {
        await fetch(`${API_URL}/auth/save-push-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId, token }),
        });
         console.log("Customer push token saved to backend.");
      } catch (error) {
        console.error("Failed to save customer push token:", error);
      }
    }
  }

  // (All handler functions are unchanged)
  const handleSchedulePress = () => {
    if (!isLoggedIn) {
      Alert.alert("Please Log In", "You must be logged in to schedule an appointment.", [
        { text: "Cancel", style: "cancel" },
        { text: "Log In", onPress: () => router.push("/login") }
      ]);
      return;
    }
    if (!selectedService) {
        Alert.alert(
            t('home.noServiceTitle', {defaultValue: "No Service Selected"}), 
            t('home.noServiceMessage', {defaultValue: "Please select a service from the dropdown list to continue."}),
            [{ text: "OK" }]
        );
        return;
    }
    const serviceToSchedule = selectedService;
    router.push({ pathname: '/calendar', params: { service: serviceToSchedule } });
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
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId, token: null }),
              });
            } catch (e) {
              console.error("Failed to remove customer token on logout:", e);
            }
          }
          await AsyncStorage.removeItem("user");
          setIsLoggedIn(false);
          setUserId(null);
          setMyAppointments([]);
          setUserProfilePic(null); // Clear profile pic on logout
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
    setIsCancelModalVisible(true);
  };
  const handleDeleteAppointment = async () => {
    if (!appointmentToCancel) return;
    setIsCancelling(true);
    try {
      const response = await fetch(`${API_URL}/appointments/${appointmentToCancel._id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error("Failed to cancel appointment.");
      }
      setMyAppointments(prev => prev.filter(app => app._id !== appointmentToCancel._id));
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
  const handleCancelOrReschedule = async (action: 'reschedule' | 'cancel') => {
    if (!appointmentToCancel || !userId) return;
    setIsCancelling(true);
    const newStatus = action === 'reschedule' ? 'pending' : 'cancelled';
    const appointmentId = appointmentToCancel._id;
    try {
      const response = await fetch(`${API_URL}/appointments/${appointmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error(`Failed to ${action} appointment.`);
      Alert.alert("Success", 
        action === 'reschedule' 
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
    }
  };
  const showNegotiationModal = (job: any) => {
    setJobToNegotiate(job);
    setIsNegotiationModalVisible(true);
  };
  const handleNegotiationAction = async (status: 'confirmed' | 'pending' | 'cancelled') => {
    if (!jobToNegotiate || !userId) return;
    setIsUpdatingStatus(true);
    const appointmentId = jobToNegotiate._id;
    const payload: any = { status };
    payload.date = jobToNegotiate.date; 
    payload.workerPrice = jobToNegotiate.workerPrice;
    try {
      const response = await fetch(`${API_URL}/appointments/${appointmentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Failed to perform action: ${status}`);
      Alert.alert("Success", 
        status === 'confirmed' ? "Price accepted! Your appointment is confirmed." :
        status === 'pending' ? "Price rejected. The specialist will be notified to send a new proposal." :
        "Appointment cancelled."
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
  // ---

  // (All render functions are unchanged)
  const renderCancelModal = () => {
    if (!appointmentToCancel) return null;
    const isNegotiation = appointmentToCancel.status === 'confirmed' || appointmentToCancel.status === 'price_pending';
    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={isCancelModalVisible}
        onRequestClose={() => setIsCancelModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsCancelModalVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {isNegotiation ? t('cancel.rescheduleTitle') : t('cancel Appointment')}
            </Text>
            <Text style={[styles.modalMessage, { color: colors.subText }]}>
              {isNegotiation ? t('cancel.rescheduleMessage') : t('click cancel to delete')}
            </Text>
            
            {isNegotiation ? (
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primaryButton }]}
                  onPress={() => handleCancelOrReschedule('reschedule')}
                  disabled={isCancelling}
                >
                  {isCancelling ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>{t('cancelModal.reschedule')}</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#ef4444' }]}
                  onPress={() => handleCancelOrReschedule('cancel')}
                  disabled={isCancelling}
                >
                  {isCancelling ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>{t('cancelModal.cancelJob')}</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.inputBorder, width: '100%', marginTop: 10 }]}
                  onPress={() => setIsCancelModalVisible(false)}
                  disabled={isCancelling}
                >
                  <Text style={[styles.modalButtonText, { color: colors.text }]}>{t('Keep')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.inputBorder }]}
                  onPress={() => setIsCancelModalVisible(false)}
                  disabled={isCancelling}
                >
                  <Text style={[styles.modalButtonText, { color: colors.text }]}>{t('Keep')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#ef4444' }]}
                  onPress={handleDeleteAppointment}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>{t('Cancel')}</Text>
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
    const proposedPrice = jobToNegotiate.workerPrice ? `$${jobToNegotiate.workerPrice.toFixed(2)}` : 'N/A';
    const proposedDate = new Date(jobToNegotiate.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const proposedTime = new Date(jobToNegotiate.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={isNegotiationModalVisible}
        onRequestClose={() => setIsNegotiationModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsNegotiationModalVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('negotiation.reviewTitle')}</Text>
            <Text style={[styles.modalMessage, { color: colors.text, fontWeight: 'bold' }]}>
              {jobToNegotiate.service} Job
            </Text>
            <View style={styles.proposalDetail}>
              <Text style={[styles.proposalLabel, { color: colors.subText }]}>{t('negotiation.price')}</Text>
              <Text style={[styles.proposalValue, { color: colors.primaryButton }]}>{proposedPrice}</Text>
            </View>
            <View style={styles.proposalDetail}>
              <Text style={[styles.proposalLabel, { color: colors.subText }]}>{t('negotiation.dateTime')}</Text>
              <Text style={[styles.proposalValue, { color: colors.text }]}>{proposedDate} at {proposedTime}</Text>
            </View>

            <Text style={[styles.modalMessage, { color: colors.subText, fontSize: 14, marginTop: 15 }]}>
              {t('negotiation.prompt')}
            </Text>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButtonSmall, { backgroundColor: '#10b981', flex: 2 }]}
                onPress={() => handleNegotiationAction('confirmed')}
                disabled={isUpdatingStatus}
              >
                {isUpdatingStatus ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>{t('negotiation.accept')}</Text>}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButtonSmall, { backgroundColor: colors.inputBorder }]}
                onPress={() => handleNegotiationAction('pending')}
                disabled={isUpdatingStatus}
              >
                {isUpdatingStatus ? <ActivityIndicator color="#fff" /> : <Text style={[styles.modalButtonText, { color: colors.text }]}>{t('negotiation.reject')}</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButtonSmall, { backgroundColor: '#ef4444' }]}
                onPress={() => handleNegotiationAction('cancelled')}
                disabled={isUpdatingStatus}
              >
                {isUpdatingStatus ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>{t('negotiation.cancel')}</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const renderMyAppointments = () => {
    if (!isLoggedIn) return null;
    if (isLoadingAppts) {
      return <ActivityIndicator size="large" color={colors.primaryButton} style={{ marginTop: 20 }} />;
    }
    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
          case "pending": return colors.subText;
          case "price_pending": return '#ffc107';
          case "confirmed": return '#10b981';
          case "en_route": return '#3b82f6';
          case "completed": return "#10b981";
          case "cancelled": return "#dc2626";
          default: return colors.subText;
        }
    };
    const getStatusText = (app: any) => {
      const status = app.status;
      if (status === 'price_pending') {
        const price = app.workerPrice ? app.workerPrice.toFixed(2) : '...';
        return t('status.price_pending', { price: `$${price}` });
      }
      if (status === 'en_route') {
        return t('status.en_route', { defaultValue: 'Specialist is on the way' });
      }
      return t(`status.${status}`, { defaultValue: app.status });
    };
    return (
      <View style={styles.listContainer}>
        <Text style={[styles.listHeader, { color: colors.text }]}>{t('home.myAppointments')}</Text>
        {myAppointments.length === 0 ? (
          <Text style={[styles.emptyListText, { color: colors.subText }]}>{t('home.noAppointments')}</Text>
        ) : (
          myAppointments.map(app => (
            <View key={app._id} style={[styles.appointmentCard, { backgroundColor: colors.cardBackground, borderColor: colors.inputBorder }]}>
              <View style={styles.appointmentDetails}>
                <Text style={[styles.appointmentService, { color: colors.primaryButton }]}>{app.service}</Text>
                <Text style={[styles.appointmentDate, { color: colors.text }]}>
                  {new Date(app.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' at '}
                  {new Date(app.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={[styles.appointmentWorker, { color: colors.subText }]}>
                  {t('home.specialist')}: {app.worker?.name || 'Assigning...'}
                </Text>
                 <Text style={[styles.appointmentStatus, { color: getStatusColor(app.status) }]}>
                  {t('home.status')}: {getStatusText(app)}
                </Text>
              </View>
              {app.status === 'price_pending' ? (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#ffc107' }]}
                  onPress={() => showNegotiationModal(app)}
                >
                  <Text style={[styles.actionButtonText, { color: colors.text }]}>{t('home.reviewPrice')}</Text>
                </TouchableOpacity>
              ) : (app.status === 'pending' || app.status === 'confirmed') && (
                 <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => showCancelModal(app)}
                 >
                   <Text style={styles.cancelButtonText}>{t('Cancel')}</Text>
                 </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </View>
    );
  };
  
  // (renderWorkerMarkers function is unchanged)
  const renderWorkerMarkers = () => {
    if (!workers || workers.length === 0) return null;

    return workers
      .filter(worker => 
        worker.currentLocation?.coordinates &&
        worker.currentLocation.coordinates.length === 2 &&
        (worker.currentLocation.coordinates[0] !== 0 || worker.currentLocation.coordinates[1] !== 0)
      )
      .map(worker => {
        const [longitude, latitude] = worker.currentLocation.coordinates;
        const primarySkill = worker.skills?.[0] || 'default'; 
        const markerIcon = skillIconMap[primarySkill] || skillIconMap["default"]; 

        return (
          <Marker
            key={worker._id}
            coordinate={{ latitude, longitude }}
            title={worker.name}
            description={primarySkill || 'Specialist'} 
          >
            <Image source={markerIcon} style={styles.workerMarkerImage} />
          </Marker>
        );
      });
  };
  // ---

  // --- Main Render ---
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {renderCancelModal()}
      {renderNegotiationModal()}
      <LinearGradient colors={colors.gradient} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 80 }} nestedScrollEnabled={true}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.push('/profile')} style={styles.headerIcon}>
              <Ionicons name="hammer" size={26} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>{t('home.title')}</Text>
            <ThemeToggle />
          </View>
          
          {/* --- Location Banner --- */}
          <View style={[styles.locationBanner, { backgroundColor: colors.cardBackground }]}>
            <Ionicons name="location-sharp" size={18} color={colors.primaryButton} />
            <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={1}>
              {currentAddress}
            </Text>
          </View>
          {/* --- */}

          {/* --- MODIFIED: DropDownPicker --- */}
          <View style={[styles.dropdownContainer, { zIndex: 1000 }]}>
            <DropDownPicker
              open={open}
              value={selectedService}
              items={items}
              setOpen={setOpen}
              setValue={setSelectedService}
              setItems={setItems}
              placeholder={t('home.serviceTitleDefault')}
              style={[styles.dropdown, { backgroundColor: colors.cardBackground, borderColor: colors.inputBorder }]}
              
              // Style for the placeholder text itself
              placeholderStyle={[styles.dropdownPlaceholder, { color: colors.subText }]}
              
              // Style for the text in the list
              labelStyle={[styles.dropdownText, { color: colors.text }]}
              
              // Style for the text of the *selected* item (when box is closed)
              textStyle={[styles.dropdownText, { color: colors.text }]}

              // Style for the *container* of the *selected* item
              selectedItemContainerStyle={styles.dropdownCenteredItem} 
              
              // Style for the *container* of each *list item*
              listItemContainerStyle={styles.dropdownCenteredItem}
              
              dropDownContainerStyle={[styles.dropdownListContainer, { backgroundColor: colors.cardBackground, borderColor: colors.inputBorder }]}
              searchable={false}
              listMode="SCROLLVIEW"
            />
          </View>
          {/* --- END MODIFICATION --- */}


          <TouchableOpacity
            onPress={handleSchedulePress}
            onPressIn={() => setIsPressedSchedule(true)}
            onPressOut={() => setIsPressedSchedule(false)}
            disabled={!selectedService}
            style={[ 
                styles.button, 
                { opacity: (isPressedSchedule || !selectedService) ? 0.8 : 1, transform: [{ scale: isPressedSchedule ? 0.95 : 1 }], backgroundColor: colors.cardBackground },
                !selectedService && styles.buttonDisabled
            ]}
          >
            <Text style={[
                styles.buttonText, 
                { color: colors.primaryButton },
                !selectedService && { color: colors.subText }
            ]}>
                {t('home.scheduleButton')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleEmergencyCall}
            onPressIn={() => setIsPressedEmergency(true)}
            onPressOut={() => setIsPressedEmergency(false)}
            style={[ styles.emergencyButton, { opacity: isPressedEmergency ? 0.8 : 1, transform: [{ scale: isPressedEmergency ? 0.95 : 1 }] }]}
          >
            <Text style={styles.emergencyText}>{t('home.emergencyButton')}</Text>
            {/* --- FIXED PATH --- */}
            <Image source={require("../assets/images/phone_12.jpg")} style={styles.phoneIcon} />
            {/* --- */}
          </TouchableOpacity>

          {/* --- MODIFIED: Map Container --- */}
          <View style={styles.mapContainer}>
            {location ? (
              <MapView
                ref={mapRef} // Set the ref
                style={{ flex: 1 }}
                initialRegion={{ 
                  latitude: location.latitude, 
                  longitude: location.longitude, 
                  latitudeDelta: 0.05, // Start with a 5km zoom
                  longitudeDelta: 0.05 
                }}
                showsMyLocationButton={true} // Show button to re-center
              >
                {/* --- MODIFIED: Custom User Marker --- */}
                <Marker coordinate={location} title="You are here">
                  <View style={[styles.userMarkerOuter, { backgroundColor: colors.primaryButton }]}>
                    <Image 
                      source={{ uri: userProfilePic || 'https://placehold.co/60x60/FFF/FFF?text=.' }} // Default if no pic
                      style={styles.userMarkerImage}
                    />
                  </View>
                </Marker>
                
                {/* Render *nearby* worker markers */}
                {renderWorkerMarkers()}
              </MapView>
            ) : (
              <View style={styles.mapLoading}>
                {locationError ? (
                  <Text style={{color: colors.subText, textAlign: 'center'}}>{locationError}</Text>
                ) : (
                  <>
                    <ActivityIndicator size="large" color={colors.primaryButton} />
                    <Text style={{marginTop: 10, color: colors.subText}}>Finding nearby specialists...</Text>
                  </>
                )}
              </View>
            )}
          </View>
          {/* --- */}

          {renderMyAppointments()}
        </ScrollView>

        {/* Tab Bar Area */}
        <View style={[styles.tabBarContainer, { borderTopColor: colors.inputBorder }]}>
            <View style={[styles.tabBar, { backgroundColor: colors.cardBackground }]}>
            <TouchableOpacity
                onPress={() => router.push("/")}
                style={styles.iconButton}
            >
                <Ionicons name="home-outline" size={26} color={colors.subText} />
            </TouchableOpacity>
            <TouchableOpacity
                onPress={handleTabPress}
                style={styles.iconButton}
            >
                <Ionicons name={isLoggedIn ? "log-out-outline" : "log-in-outline"} size={26} color={colors.subText} />
            </TouchableOpacity>
            </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

// --- MODIFIED: Styles ---
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 10,
    alignItems: "center"
  },
  headerIcon: {
    padding: 5,
  },
  title: { fontSize: 24, fontWeight: "bold", flex: 1, textAlign: 'center' },
  
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginHorizontal: 15,
    marginTop: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1, 
  },
  
  dropdownContainer: {
    paddingHorizontal: 15,
    paddingTop: 20, 
  },
  dropdown: {
     borderWidth: 1,
     borderRadius: 15,
     paddingVertical: 10,
     height: 60, 
  },
  dropdownPlaceholder: {
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center', // Center the placeholder text
  },
  dropdownText: {
      fontSize: 16,
      fontWeight: '600',
      // Removed flex and margin, container will center it
  },
  dropdownListContainer: {
      borderWidth: 1,
      borderRadius: 15,
  },
  dropdownIcon: {
      width: 24,
      height: 24,
      resizeMode: 'contain',
      marginRight: 10, // Add space between icon and text
  },
  dropdownCenteredItem: {
    flexDirection: 'row', // Lay out icon and text in a row
    justifyContent: 'center', // Center the group horizontally
    alignItems: 'center', // Center the group vertically
    paddingHorizontal: 15,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  buttonDisabled: {
      opacity: 0.5,
  },
  buttonText: { fontSize: 16, fontWeight: "bold" },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  emergencyText: { fontSize: 16, fontWeight: "bold", color: "white", marginRight: 8 },
  phoneIcon: { width: 20, height: 20 },
  
  mapContainer: {
    marginTop: 25,
    height: 250,
    borderRadius: 15,
    overflow: "hidden",
    marginHorizontal: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f0f0f0' 
  },
  mapLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  
  // --- CUSTOM MARKER STYLES ---
  workerMarkerImage: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    borderRadius: 20, 
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  userMarkerOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerImage: {
    width: 38,
    height: 38,
    borderRadius: 19, 
    borderWidth: 2,
    borderColor: '#fff', 
  },
  // --- END OF CUSTOM MARKER STYLES ---
  
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 25 : 12,
  },
  iconButton: {
    padding: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  iconPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },

  // (All modal, list, and card styles are unchanged)
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 15,
    padding: 25,
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 10,
    flexWrap: 'wrap',
  },
  modalButton: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 100,
    alignItems: 'center',
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    flexGrow: 1,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  modalButtonSmall: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    marginHorizontal: 4,
    alignItems: 'center',
    elevation: 1,
  },
  proposalDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginHorizontal: 10,
  },
  proposalLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  proposalValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  listContainer: {
    marginTop: 30,
    paddingHorizontal: 15,
  },
  listHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  emptyListText: {
    textAlign: 'center',
    fontStyle: 'italic',
    fontSize: 16,
    paddingVertical: 30,
  },
  appointmentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
   appointmentDetails: {
    flex: 1,
    marginRight: 10,
  },
  appointmentService: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  appointmentDate: {
    fontSize: 14,
    marginVertical: 3,
  },
  appointmentWorker: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  appointmentStatus: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  cancelButtonText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 14,
  }    
});