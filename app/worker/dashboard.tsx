import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import Slider from "@react-native-community/slider";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView, StyleSheet, Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import MapView from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import ThemeToggle from "../components/ThemeToggle";
import { useTheme } from "../context/ThemeContext";

const API_URL = "https://backend-tknm.onrender.com/api";


async function getAuthHeaders(includeJson = true) {
  const token = await AsyncStorage.getItem("token");

  if (!token?.trim()) {
    throw new Error("AUTH_TOKEN_MISSING");
  }

  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${token}`,
  };
}



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
  const { colors, theme } = useTheme();
  const router = useRouter();
  const isDarkMode = theme === "dark";

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
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});

  const [timeclockStatus, setTimeclockStatus] = useState<"clocked_out" | "clocked_in" | "on_break">("clocked_out");
  const [activeTimeclockAppointmentId, setActiveTimeclockAppointmentId] = useState<string | null>(null);
  const [activeTimeclockStartTime, setActiveTimeclockStartTime] = useState<string | null>(null);
  const [dailyHours, setDailyHours] = useState<number>(0);

  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [skillModalVisible, setSkillModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

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
      const appointmentsResponse = await fetch(`${API_URL}/appointments`, {
        headers: await getAuthHeaders(false),
      });
  
      if (!appointmentsResponse.ok) {
        throw new Error("Failed to fetch appointments");
      }
  
      const allAppointments = await appointmentsResponse.json();
  
      const workerAppointments = allAppointments.filter(
        (app: any) =>
          app.worker?._id === currentWorkerId ||
          app.worker === currentWorkerId
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
  
        // Today's and future jobs: earliest first.
        if (catA === 0 || catA === 1) return dateA - dateB;
  
        // Past jobs: most recent first.
        return dateB - dateA;
      });
  
      setAppointments(workerAppointments);
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
    }
  };
  

 
  const fetchUnreadCounts = async (currentWorkerId: string) => {
    try {
      const response = await fetch(
        `${API_URL}/chat/unread/${currentWorkerId}`,
        {
          headers: await getAuthHeaders(false),
        }
      );

      if (!response.ok) return;

      const data = await response.json();
      setUnreadCounts(data || {});

      const chatTotal = Object.values(data || {}).reduce(
        (sum: number, n: any) => sum + (Number(n) || 0),
        0
      );

      let notifTotal = 0;

      try {
        const notifRes = await fetch(
          `${API_URL}/notifications/unread/${currentWorkerId}`,
          {
            headers: await getAuthHeaders(false),
          }
        );

        if (notifRes.ok) {
          const notifData = await notifRes.json();
          notifTotal = notifData.count || 0;
        }
      } catch (e) {
        console.error("Notification badge fetch error:", e);
      }

      Notifications.setBadgeCountAsync(
        chatTotal + notifTotal
      ).catch(() => {});

      if (notifTotal > 0) {
        fetch(
          `${API_URL}/notifications/clear/${currentWorkerId}`,
          {
            method: "POST",
            headers: await getAuthHeaders(false),
          }
        ).catch(() => {});
      }
    } catch (error) {
      console.error("Unread count fetch error:", error);
    }
  };

  const fetchTimeclockStatus = async (currentWorkerId: string) => {
    try {
      const response = await fetch(
        `${API_URL}/timeclock/status/${currentWorkerId}`,
        {
          headers: await getAuthHeaders(false),
        }
      );

      if (!response.ok) return;

      const data = await response.json();
      setTimeclockStatus(data.status);
      setActiveTimeclockAppointmentId(
        data.entry?.appointmentId || null
      );
      setActiveTimeclockStartTime(
        data.entry?.startTime || null
      );
    } catch (error) {
      console.error("Timeclock status fetch error:", error);
    }
  };

  const STALE_SESSION_HOURS = 8;

  const openSessionHours = (() => {
    if (!activeTimeclockStartTime) return 0;
    const ms = Date.now() - new Date(activeTimeclockStartTime).getTime();
    return ms / (1000 * 60 * 60);
  })();

 
const handleForceClockOut = async () => {
  if (!workerId) return;

  try {
    const response = await fetch(`${API_URL}/timeclock/clock-out`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ workerId }),
    });

    if (!response.ok) throw new Error("Failed to clock out");

    await fetchTimeclockStatus(workerId);

    Alert.alert("Clocked Out", "Your open session has been closed.");
  } catch (error) {
    Alert.alert("Error", "Could not clock out.");
  }
};


  
const fetchDailyHours = async (currentWorkerId: string) => {
  try {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const tzOffset = now.getTimezoneOffset();

    const response = await fetch(
      `${API_URL}/timeclock/daily/${currentWorkerId}?date=${today}&tzOffset=${tzOffset}`,
      {
        headers: await getAuthHeaders(false),
      }
    );

    if (!response.ok) return;

    const data = await response.json();

    const hours = Number(data?.totalHours ?? data?.dailyHours ?? data?.hours ?? 0);
    setDailyHours(Number.isFinite(hours) ? hours : 0);
  } catch (error) {
    console.error("Daily hours fetch error:", error);
  }
};


const handleJobClockIn = async (appointmentId: string) => {
  if (!workerId) return;

  try {
    const response = await fetch(`${API_URL}/timeclock/clock-in`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ workerId, appointmentId }),
    });

    if (!response.ok) throw new Error("Failed to clock in");

    const data = await response.json();

    if (data.flaggedPreviousEntry) {
      Alert.alert(
        "Heads up",
        "You had an open clock-in from a previous job that wasn't closed. It's been flagged for review."
      );
    }

    await fetchTimeclockStatus(workerId);
    await fetchDailyHours(workerId);
  } catch (error) {
    Alert.alert("Error", "Could not clock in to this job.");
  }
};



const handleBreakStart = async () => {
  if (!workerId) return;

  try {
    const response = await fetch(`${API_URL}/timeclock/break-start`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ workerId }),
    });

    if (!response.ok) throw new Error("Failed to start break");

    await fetchTimeclockStatus(workerId);
    await fetchDailyHours(workerId);
  } catch (error) {
    Alert.alert("Error", "Could not start break.");
  }
};


 
const handleBreakEnd = async () => {
  if (!workerId) return;

  try {
    const response = await fetch(`${API_URL}/timeclock/break-end`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ workerId }),
    });

    if (!response.ok) throw new Error("Failed to end break");

    await fetchTimeclockStatus(workerId);
    await fetchDailyHours(workerId);
  } catch (error) {
    Alert.alert("Error", "Could not end break.");
  }
};

  
const handleJobClockOut = async () => {
  if (!workerId) return;

  try {
    const response = await fetch(`${API_URL}/timeclock/clock-out`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ workerId }),
    });

    if (!response.ok) throw new Error("Failed to clock out");

    await fetchTimeclockStatus(workerId);
    await fetchDailyHours(workerId);
  } catch (error) {
    Alert.alert("Error", "Could not clock out.");
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
        
const workerResponse = await fetch(`${API_URL}/workers/me`, {
  headers: await getAuthHeaders(false),
});

if (!workerResponse.ok) {
  const errorData = await workerResponse.json().catch(() => ({}));
  throw new Error(
    errorData.msg || "Failed to retrieve your worker profile."
  );
}

const currentWorker = await workerResponse.json();

      
        setWorkerProfile(currentWorker);
        setWorkerId(currentWorker._id);
        setName(currentWorker.name || "");
        setAge(currentWorker.age ? String(currentWorker.age) : "");
        setGender(currentWorker.gender || "");
        setSelectedSkill(currentWorker.skills?.[0] || null);
        setMaxDistance(currentWorker.maxDistance || 25);
        setProfileImage(
          currentWorker.profileImageBase64 || currentWorker.profileImageUrl || null
        );

        const isClockedIn = currentWorker.currentClock?.clockedIn || false;
        setClockedIn(isClockedIn);

        await fetchAppointments(currentWorker._id);
        await fetchUnreadCounts(currentWorker._id);
        await registerForPushNotificationsAsync(currentWorker._id);
        await getInitialLocation(currentWorker._id);
        await fetchTimeclockStatus(currentWorker._id);
        await fetchDailyHours(currentWorker._id);

        if (isClockedIn) {
          await startLocationTracking(currentWorker._id);
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

    fetchAppointments(workerId);
    fetchUnreadCounts(workerId);
    fetchTimeclockStatus(workerId);
    fetchDailyHours(workerId);

    const interval = setInterval(() => {
      fetchAppointments(workerId);
      fetchUnreadCounts(workerId);
      fetchTimeclockStatus(workerId);
      fetchDailyHours(workerId);
    }, 20000);

    return () => clearInterval(interval);
  }, [workerId]);

  useFocusEffect(
    React.useCallback(() => {
      if (!workerId) return;
      fetchAppointments(workerId);
      fetchUnreadCounts(workerId);
    }, [workerId])
  );

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
        headers: await getAuthHeaders(),
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
    if (!currentWorkerId) return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        console.log("Failed to get worker push notification permission.");
        return;
      }

      const projectId = "feda72f0-f679-4d6c-8f9a-ff6184cd86eb";
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      const response = await fetch(`${API_URL}/workers/save-push-token`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ workerId: currentWorkerId, token }),
      });
      if (!response.ok) throw new Error("Failed to save worker push token");
      console.log("Worker push token saved to backend.");
    } catch (error) {
      console.error("Worker push notification registration failed:", error);
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

    if (!result.canceled && result.assets?.[0]?.base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setProfileImage(base64Image);
      Alert.alert("Success", "Profile picture updated. Press 'Save Settings' to apply.");
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
        headers: await getAuthHeaders(),
        body: JSON.stringify(updatedData),
      });
  
      if (!response.ok) throw new Error("Failed to save profile.");
  
      Alert.alert("Success", "Your settings have been updated.");
      setSettingsModalVisible(false);
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
        headers: await getAuthHeaders(false),
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
    } else if (job.workerPrice) {
      setPriceBreakdown([{ item: "Service Cost", price: String(job.workerPrice) }]);
    } else {
      setPriceBreakdown([{ item: "", price: "" }]);
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
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Failed to update job status to ${status}.`);

      if (status === "en_route") {
        Alert.alert("Success", "Customer has been notified you are on your way!");
      } else if (status === "completed") {
        Alert.alert("Success", `Job status updated to ${status}.`);
      }

      if (workerId) {
        await fetchAppointments(workerId);
        await fetchUnreadCounts(workerId);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not update job status.");
      if (workerId) {
        await fetchAppointments(workerId);
        await fetchUnreadCounts(workerId);
      }
    }
  };

  const handleUpdateJobStatus = async (
    appointmentId: string,
    status: string,
    job?: any
  ) => {
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

    if (status === "completed") {
      if (timeclockStatus !== "clocked_out" && activeTimeclockAppointmentId === appointmentId) {
        await handleJobClockOut();
      }
      performStatusUpdate(appointmentId, status);
      return;
    }

    performStatusUpdate(appointmentId, status);
  };

  const openJobChat = async (job: any) => {
    const customerId = job?.customer?._id || job?.customer;
    const customerName = job?.customer?.name || "Customer";

    if (!job?._id || !customerId || !workerId) {
      Alert.alert("Chat unavailable", "A customer must be assigned before chat can open.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/chat/conversation/${job._id}`, {
        method: "POST",
        headers: await getAuthHeaders(),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Chat route failed with status ${response.status}`);
      }

      setUnreadCounts((prev) => ({
        ...prev,
        [job._id]: 0,
      }));

      router.push({
        pathname: "/chat/[appointmentId]",
        params: {
          appointmentId: String(job._id),
          otherUserId: String(customerId),
          otherUserName: customerName,
          appointmentStatus: job.status || "",
          selfUserId: String(workerId),
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
                headers: await getAuthHeaders(),
                body: JSON.stringify({ workerId, token: null }),
              });
            } catch (e) {
              console.error("Failed to remove worker token on logout:", e);
            }
          }
  
          await AsyncStorage.multiRemove(["user", "token"]);
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

  const renderSettingsModal = () => (
    <Modal
      animationType="slide"
      transparent
      visible={settingsModalVisible}
      onRequestClose={() => setSettingsModalVisible(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalBackdrop}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSettingsModalVisible(false)}
        >
          <Pressable
            style={[
              styles.settingsSheet,
              { backgroundColor: colors.cardBackground },
            ]}
          >
            <View style={styles.settingsHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={[
                    styles.hammerBadgeLarge,
                    { backgroundColor: colors.primaryButton },
                  ]}
                >
                  <Ionicons name="hammer-outline" size={20} color="#fff" />
                </View>
                <View>
                  <Text style={[styles.settingsTitle, { color: colors.text }]}>
                    Settings
                  </Text>
                  <Text style={[styles.settingsSubtitle, { color: colors.subText }]}>
                    Profile, service, distance and shift controls
                  </Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                <Ionicons name="close" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
            >
              <View style={styles.settingsProfileTop}>
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
                    {
                      color: colors.text,
                      borderBottomColor: colors.inputBorder,
                    },
                  ]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your Name"
                  placeholderTextColor={colors.subText}
                />
              </View>

              <Text style={[styles.settingsSectionTitle, { color: colors.text }]}>
                Service
              </Text>
              <TouchableOpacity
                style={[
                  styles.skillSelector,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.inputBorder,
                  },
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

              <Text style={[styles.settingsSectionTitle, { color: colors.text }]}>
                Shift
              </Text>
              <View
                style={[
                  styles.section,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.inputBorder,
                    marginTop: 0,
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
                  <Text style={styles.clockText}>
                    {clockedIn ? "Clock Out" : "Clock In"}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.settingsSectionTitle, { color: colors.text }]}>
                Personal Details
              </Text>
              <View
                style={[
                  styles.detailsCard,
                  {
                    backgroundColor: colors.background,
                    marginBottom: 18,
                  },
                ]}
              >
                <Text style={[styles.label, { color: colors.subText }]}>Age</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.cardBackground,
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
                            gender === g ? colors.primaryButton : colors.cardBackground,
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

              <Text style={[styles.settingsSectionTitle, { color: colors.text }]}>
                Travel Distance
              </Text>
              <View
                style={[
                  styles.detailsCard,
                  { backgroundColor: colors.background, marginBottom: 18 },
                ]}
              >
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
                    marginHorizontal: 0,
                    marginTop: 8,
                  },
                ]}
                onPress={handleSaveProfile}
                disabled={isSaving}
              >
                <Text style={styles.saveButtonText}>
                  {isSaving ? "Saving..." : "Save Settings"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
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
    return priceBreakdown.reduce((acc, item) => acc + (parseFloat(item.price) || 0), 0);
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
              <ScrollView contentContainerStyle={{ width: "100%", paddingBottom: 40 }}>
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
                  <View
                    style={[
                      styles.iosPickerCard,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.inputBorder,
                      },
                    ]}
                  >
                    <DateTimePicker
                      testID="datePicker"
                      value={selectedDateTime}
                      mode="date"
                      display="spinner"
                      onChange={onDateChange}
                      minimumDate={new Date()}
                      themeVariant={isDarkMode ? "dark" : "light"}
                      textColor={colors.text}
                      style={styles.datePicker}
                    />
                    <DateTimePicker
                      testID="timePicker"
                      value={selectedDateTime}
                      mode="time"
                      is24Hour
                      display="spinner"
                      onChange={onTimeChange}
                      themeVariant={isDarkMode ? "dark" : "light"}
                      textColor={colors.text}
                      style={styles.datePicker}
                    />
                  </View>
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

  const renderHeaderCard = () => (
    <View
      style={[
        styles.heroCard,
        { backgroundColor: colors.cardBackground, borderColor: colors.inputBorder },
      ]}
    >
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={[styles.hammerButton, { backgroundColor: colors.primaryButton }]}
          onPress={() => setSettingsModalVisible(true)}
        >
          <Ionicons name="hammer-outline" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.header, { color: colors.text }]}>My Dashboard</Text>
          <Text style={[styles.heroSubText, { color: colors.subText }]}>
            Manage jobs, chat and appointments
          </Text>
        </View>

        <View style={styles.headerIcons}>
        {workerProfile?.isEmployer && (
  <TouchableOpacity
    onPress={() => router.push("/worker/employer-jobs")}
    style={{ padding: 4 }}
    accessibilityLabel="Employer job management and timesheets"
  >
    <Ionicons name="time-outline" size={26} color={colors.text} />
  </TouchableOpacity>
)}
          <ThemeToggle />
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.quickInfoRow}>
        <View
          style={[
            styles.quickInfoCard,
            { backgroundColor: colors.background, borderColor: colors.inputBorder },
          ]}
        >
          <Text style={[styles.quickInfoLabel, { color: colors.subText }]}>Service</Text>
          <Text style={[styles.quickInfoValue, { color: colors.text }]}>
            {selectedSkill || "Not set"}
          </Text>
        </View>

        <View
          style={[
            styles.quickInfoCard,
            { backgroundColor: colors.background, borderColor: colors.inputBorder },
          ]}
        >
          <Text style={[styles.quickInfoLabel, { color: colors.subText }]}>Shift</Text>
          <Text
            style={[
              styles.quickInfoValue,
              { color: clockedIn ? "#10b981" : "#ef4444" },
            ]}
          >
            {clockedIn ? "Clocked In" : "Clocked Out"}
          </Text>
        </View>

        <View
          style={[
            styles.quickInfoCard,
            { backgroundColor: colors.background, borderColor: colors.inputBorder },
          ]}
        >
          <Text style={[styles.quickInfoLabel, { color: colors.subText }]}>Today's Hours</Text>
          <Text style={[styles.quickInfoValue, { color: colors.text }]}>
            {dailyHours.toFixed(2)}h
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {renderSkillModal()}
      {renderSettingsModal()}
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
        {renderHeaderCard()}

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

        {timeclockStatus !== "clocked_out" && openSessionHours > STALE_SESSION_HOURS && (
          <View style={styles.staleSessionBanner}>
            <Ionicons name="warning-outline" size={20} color="#92400e" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.staleSessionText}>
                You've been {timeclockStatus === "on_break" ? "on break" : "clocked in"} for{" "}
                {openSessionHours.toFixed(1)}h. Did you forget to clock out?
              </Text>
            </View>
            <TouchableOpacity
              style={styles.staleSessionButton}
              onPress={handleForceClockOut}
            >
              <Text style={styles.staleSessionButtonText}>Clock Out Now</Text>
            </TouchableOpacity>
          </View>
        )}

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

                  {(unreadCounts[job._id] || 0) > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {unreadCounts[job._id] > 99 ? "99+" : unreadCounts[job._id]}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {(job.status.toLowerCase() === "confirmed" ||
                job.status.toLowerCase() === "en_route") && (
                <View style={styles.timeclockRow}>
                  {activeTimeclockAppointmentId === job._id ? (
                    <>
                      {timeclockStatus === "clocked_in" && (
                        <>
                          <TouchableOpacity
                            style={[styles.timeclockButton, { backgroundColor: "#f59e0b" }]}
                            onPress={handleBreakStart}
                          >
                            <Text style={styles.timeclockButtonText}>Start Break</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.timeclockButton, { backgroundColor: "#ef4444" }]}
                            onPress={handleJobClockOut}
                          >
                            <Text style={styles.timeclockButtonText}>Clock Out</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {timeclockStatus === "on_break" && (
                        <TouchableOpacity
                          style={[styles.timeclockButton, { backgroundColor: "#10b981" }]}
                          onPress={handleBreakEnd}
                        >
                          <Text style={styles.timeclockButtonText}>End Break</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    timeclockStatus === "clocked_out" && (
                      <TouchableOpacity
                        style={[styles.timeclockButton, { backgroundColor: "#10b981" }]}
                        onPress={() => handleJobClockIn(job._id)}
                      >
                        <Text style={styles.timeclockButtonText}>Clock In to Job</Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
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
  addButton: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginVertical: 4 },
  addButtonText: {},
  avatar: { width: 76, height: 76, borderRadius: 38 },
  breakdownBox: { borderWidth: 1, borderRadius: 10, padding: 10, marginVertical: 8 },
  breakdownInput: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 42, flex: 1 },
  breakdownItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  breakdownItemName: {},
  breakdownItemPrice: {},
  breakdownItemText: {},
  breakdownRow: {},
  breakdownTitle: {},
  cameraIcon: { position: "absolute", right: 0, bottom: 0, backgroundColor: "#2563eb", borderRadius: 14, padding: 5 },
  chatButton: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginVertical: 4 },
  chatButtonText: {},
  clockButton: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginVertical: 4 },
  clockText: {},
  container: { padding: 16, paddingBottom: 32 },
  datePicker: {},
  datePickerButton: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginVertical: 4 },
  datePickerButtonText: {},
  dateTimeModalContent: { width: "100%", maxHeight: "90%", borderRadius: 18, padding: 18, alignSelf: "center", overflow: "hidden" },
  detailsCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  distanceLabel: {},
  genderButton: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginVertical: 4 },
  genderContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  hammerBadgeLarge: {},
  hammerButton: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginVertical: 4 },
  header: {},
  headerBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  headerIcons: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  heroCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  heroSubText: {},
  input: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 42, flex: 1 },
  inputLabel: {},
  iosPickerCard: { borderWidth: 1, borderRadius: 10, padding: 10, marginVertical: 8 },
  jobAddress: {},
  jobCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  jobDescription: {},
  jobRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  jobStatus: {},
  jobTime: {},
  label: {},
  loadingText: {},
  map: { width: "100%", height: "100%" },
  mapContainer: { height: 220, borderRadius: 14, overflow: "hidden", marginBottom: 18 },
  mapLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
  modalActionButtons: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 16 },
  modalButton: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginVertical: 4 },
  modalContent: { width: "100%", maxHeight: "90%", borderRadius: 18, padding: 18, alignSelf: "center", overflow: "hidden" },
  modalOption: {},
  modalOptionText: {},
  modalSubtitle: {},
  modalTitle: {},
  quickInfoCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  quickInfoLabel: {},
  quickInfoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  quickInfoValue: {},
  removeButton: {},
  saveButton: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginVertical: 4 },
  saveButtonText: {},
  section: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  settingsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  settingsProfileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  settingsSectionTitle: {},
  settingsSheet: { width: "100%", maxHeight: "90%", borderRadius: 18, padding: 18, alignSelf: "center", overflow: "hidden" },
  settingsSubtitle: {},
  settingsTitle: {},
  skillSelector: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginVertical: 4 },
  skillSelectorText: {},
  slider: { width: "100%", height: 40 },
  staleSessionBanner: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, backgroundColor: "#fef3c7", marginBottom: 14 },
  staleSessionButton: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginVertical: 4 },
  staleSessionButtonText: {},
  staleSessionText: {},
  statusActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  statusButton: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginVertical: 4 },
  statusButtonText: {},
  subHeader: {},
  timeclockButton: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginVertical: 4 },
  timeclockButtonText: {},
  timeclockRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  totalAmount: {},
  totalContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  totalText: {},
  unreadBadge: { marginLeft: 8, backgroundColor: "#dc2626", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  unreadBadgeText: {},
  workerNameInput: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 42, flex: 1 },
});
