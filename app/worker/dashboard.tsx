import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import * as Location from "expo-location";
// --- NEW: Import Notifications ---
import * as Notifications from 'expo-notifications';
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image, Modal, Platform
  , Pressable, ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
// --- NEW IMPORT: For Date/Time Picker Modal ---
import DateTimePicker from '@react-native-community/datetimepicker';
// ---
import ThemeToggle from "../components/ThemeToggle";
import { useTheme } from "../context/ThemeContext";

const API_URL = "http://172.20.10.14:6000/api";
const ALL_SKILLS = [
  "Electrician", "Plumber", "Drywall", "Carpenter", "Roofer", 
  "Fire/Alarm", "Home Automation", "HVAC", "Painter", "Heavy Equipment"
];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

// --- NEW: Notification Handler ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
// ---

export default function WorkerDashboard() {
  const { colors } = useTheme();
  const router = useRouter();

  // Worker Data State
  const [workerProfile, setWorkerProfile] = useState<any | null>(null);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  
  // Editable Profile State
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [maxDistance, setMaxDistance] = useState(25); 

  // App State
  const [appointments, setAppointments] = useState<any[]>([]);
  const [clockedIn, setClockedIn] = useState(false);
  const [location, setLocation] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [skillModalVisible, setSkillModalVisible] = useState(false);
  
  // --- NEW STATE FOR DATE PICKER & PRICE INPUT ---
  const [dateTimeModalVisible, setDateTimeModalVisible] = useState(false);
  const [currentJobToSchedule, setCurrentJobToSchedule] = useState<any | null>(null);
  const [selectedDateTime, setSelectedDateTime] = useState(new Date());
  const [priceInput, setPriceInput] = useState(''); // New state for price
  // ---

  // --- MODIFIED: Function to fetch appointments and implement complex sorting ---
  const fetchAppointments = async (currentWorkerId: string) => {
    try {
      const appointmentsResponse = await fetch(`${API_URL}/appointments`);
      const allAppointments = await appointmentsResponse.json();
      const workerAppointments = allAppointments.filter(
        (app: any) => app.worker?._id === currentWorkerId
      );

      const now = new Date();
      
      // Helper to categorize appointments for sorting relevance
      const getSortCategory = (date: string) => {
        const jobDate = new Date(date);
        
        // Normalize today's date to midnight for comparison
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const jobDayStart = new Date(jobDate.getFullYear(), jobDate.getMonth(), jobDate.getDate()).getTime();
        
        // Category 0: Today (Highest Priority)
        if (jobDayStart === todayStart) {
            return 0; 
        }
        
        // Category 1: Upcoming (Future dates)
        if (jobDayStart > todayStart) {
            return 1;
        }
        
        // Category 2: Past/Other (Lowest Priority)
        return 2;
      };

      // Custom Sorting: 
      // 1. Group by category (Today < Upcoming < Past)
      // 2. Sort within Today/Upcoming by date ascending (earliest first)
      // 3. Sort within Past by date descending (most recent past first)
      workerAppointments.sort((a, b) => {
        const catA = getSortCategory(a.date);
        const catB = getSortCategory(b.date);
        
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();

        // Rule 1: Grouping (Today < Upcoming < Past)
        if (catA !== catB) {
            return catA - catB; // Sort by category ascending (0 before 1 before 2)
        }

        // Rule 2: Sorting within Groups
        if (catA === 0 || catA === 1) {
            // Sort Today and Upcoming jobs by date ascending (earliest first)
            return dateA - dateB;
        }
        
        // Rule 3: Past/Other jobs (Category 2) sorted by date descending (most recent past job first)
        return dateB - dateA;
      });

      setAppointments(workerAppointments);
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
    }
  };

  // --- MODIFIED: Main useEffect hook to initialize data ---
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
          setName(currentWorker.name);
          setAge(currentWorker.age ? String(currentWorker.age) : "");
          setGender(currentWorker.gender || "");
          setSelectedSkill(currentWorker.skills?.[0] || null);
          setMaxDistance(currentWorker.maxDistance || 25);
          setClockedIn(currentWorker.currentClock?.clockedIn || false);
          
          // --- MODIFIED: Load Base64 from DB first, then fallback to URL ---
          setProfileImage(currentWorker.profileImageBase64 || currentWorker.profileImageUrl);

          // Initial appointment fetch (now using the dedicated function)
          await fetchAppointments(currentWorker._id);

          // Register for notifications
          registerForPushNotificationsAsync(currentWorker._id); 

        } else {
          Alert.alert("Error", "Could not find a worker profile for this user.");
        }
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      }

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location access is needed for GPS map.");
        return;
      }
      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation.coords);
    };

    initialize();
  }, [router]);

  // --- MODIFIED: Polling useEffect for real-time updates (now 5 seconds) ---
  useEffect(() => {
    if (!workerId) return;

    // Set up polling interval (e.g., every 5 seconds)
    const interval = setInterval(() => {
      fetchAppointments(workerId);
    }, 5000); // Changed from 15000ms to 5000ms

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [workerId]); // Re-run if workerId changes or is set

  // --- NEW: Function to register WORKER for push notifications ---
  async function registerForPushNotificationsAsync(currentWorkerId: string) {
    let token;
    // (Setup notification channel for Android - same as before)
    if (Platform.OS === 'android') {
       await Notifications.setNotificationChannelAsync('default', {
        name: 'default', importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250], lightColor: '#FF231F7C',
      });
    }

    // (Request permissions - same as before)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token!'); return;
    }
    
    // (Get token - same as before, REMEMBER TO REPLACE PROJECT ID)
    try {
      // --- IMPORTANT: Replace with your actual EAS project ID ---
      // You can find this in your eas.json file or on your Expo account dashboard.
      const projectId = 'feda72f0-f679-4d6c-8f9a-ff6184cd86eb'; // <-- REPLACE THIS!
      // ---
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log("Worker Expo Push Token:", token);
    } catch (e) { console.error("Failed to get push token:", e); return; }
  
    // --- Save WORKER token ---
    if (token) {
      try {
        // Use the worker-specific route
        await fetch(`${API_URL}/workers/save-push-token`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Send workerId instead of userId
          body: JSON.stringify({ workerId: currentWorkerId, token }), 
        });
        console.log("Worker push token saved to backend."); // Added log
      } catch (error) { console.error("Failed to save worker push token:", error); }
    }
  }
  // ---

  // --- MODIFIED: handlePickImage to only set state ---
  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      // Set the image in state. It will be saved on "Save Profile"
      setProfileImage(base64Image); 
      Alert.alert("Success", "Profile picture updated. Press 'Save Profile' to apply.");
    }
  };

  // --- MODIFIED: handleSaveProfile to send Base64 string ---
  const handleSaveProfile = async () => {
    if (!workerId) return;
    setIsSaving(true);
    try {
      const updatedData: any = {
        name, age: Number(age) || null, gender,
        skills: selectedSkill ? [selectedSkill] : [],
        maxDistance, 
        currentLocation: location,
        // --- NEW: Add the profileImage state (which holds the Base64) to the payload ---
        profileImageBase64: profileImage 
      };
      
      const response = await fetch(`${API_URL}/workers/${workerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
      if (!response.ok) throw new Error("Failed to save profile.");
      Alert.alert("Success", "Your profile has been updated.");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not save your profile.");
    } finally { setIsSaving(false); }
  };

  const handleClockToggle = async () => {
    if (!workerId) return;
    const endpoint = clockedIn ? "clock-out" : "clock-in";
    try {
      const response = await fetch(`${API_URL}/workers/${workerId}/${endpoint}`, { method: 'POST' });
      if (!response.ok) throw new Error(`Failed to ${endpoint}`);
      setClockedIn(!clockedIn);
      Alert.alert("Success", `You have successfully clocked ${clockedIn ? "out" : "in"}.`);
    } catch (error) { Alert.alert("Error", `Could not clock ${clockedIn ? "out" : "in"}.`); }
  };
  
  // --- NEW: Function to handle date/time selection from the picker ---
  const onDateTimeChange = (event: any, date?: Date) => {
    // Only used for Android/Web: iOS hides the picker inside the modal
    if (Platform.OS === 'android') {
        setDateTimeModalVisible(false);
    }

    if (date) {
        // Prevent selecting a date in the past
        if (date < new Date()) {
          setSelectedDateTime(new Date());
        } else {
          setSelectedDateTime(date);
        }
    }
  };

  const handleScheduleJob = (job: any) => {
    setCurrentJobToSchedule(job);
    // Set initial date to the job's current date or a new Date() if past
    const jobDate = new Date(job.date);
    const now = new Date();
    setSelectedDateTime(jobDate > now ? jobDate : now);
    // Set initial price if already proposed, otherwise empty string
    setPriceInput(job.workerPrice ? String(job.workerPrice) : '');
    setDateTimeModalVisible(true);
  };

  const handleConfirmSchedule = async () => {
    if (!currentJobToSchedule) return;
    
    const price = parseFloat(priceInput);

    if (isNaN(price) || price <= 0) {
      Alert.alert("Invalid Price", "Please enter a valid price greater than zero.");
      return;
    }
    
    // Perform the status update with the new date and price
    await performStatusUpdate(
        currentJobToSchedule._id, 
        'price_pending', // Status changes to price_pending
        selectedDateTime.toISOString(), // New date to send
        price // Price to send
    );
    setDateTimeModalVisible(false);
    setCurrentJobToSchedule(null);
    setPriceInput('');
  };
  // --- END NEW DATE PICKER/PRICE LOGIC ---

  // --- MODIFIED: Helper function to perform the API call and update state (Now accepts workerPrice) ---
  const performStatusUpdate = async (appointmentId: string, status: string, newDate?: string, workerPrice?: number) => {
    const payload: any = { status };
    if (newDate) {
      payload.date = newDate;
    }
    if (workerPrice !== undefined) {
      payload.workerPrice = workerPrice;
    }
    
    // Optimistic UI update
    const updatedAppointments = appointments.map(app => 
      app._id === appointmentId 
        ? { 
            ...app, 
            status, 
            date: newDate || app.date, 
            workerPrice: workerPrice !== undefined ? workerPrice : app.workerPrice 
          } 
        : app
    );
    setAppointments(updatedAppointments);
    
    try {
      const response = await fetch(`${API_URL}/appointments/${appointmentId}`, {
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) throw new Error(`Failed to update job status to ${status}.`);
      
      // Only show alert for "On My Way" and "Completed"
      if (status === 'en_route') {
        Alert.alert("Success", "Customer has been notified you are on your way!");
      } else if (status === 'completed') {
        Alert.alert("Success", `Job status updated to ${status}.`);
      }
      
      // Manually trigger a refresh after a successful update for immediate consistency
      if (workerId) {
        await fetchAppointments(workerId);
      }
      
    } catch (error: any) { 
      Alert.alert("Error", error.message || "Could not update job status."); 
      // A rollback or refetch should occur if the optimistic update failed
      if (workerId) {
         await fetchAppointments(workerId);
      }
    }
  };

  // --- MODIFIED: handleUpdateJobStatus handles price negotiation or cancellation ---
  const handleUpdateJobStatus = async (appointmentId: string, status: string, job?: any) => {
    // --- NEW: Handle "en_route" status ---
    // This is a direct action, no modal needed.
    if (status === 'en_route') {
      performStatusUpdate(appointmentId, status);
      return;
    }
    // ---

    if (status === 'confirmed' && job) {
      // Open the date/time/price picker when confirming/rescheduling a job
      handleScheduleJob(job);
      return;
    } else if (status === 'cancelled') {
      Alert.alert(
        "Confirm Cancellation",
        "Are you sure you want to cancel this job? The customer will be notified.",
        [
          { text: "No", style: "cancel" },
          { text: "Yes, Cancel", onPress: () => performStatusUpdate(appointmentId, status), style: "destructive" },
        ]
      );
      return;
    }

    // For 'completed', proceed directly
    performStatusUpdate(appointmentId, status);
  };
  // --- END MODIFIED: handleUpdateJobStatus ---


  // --- MODIFIED: handleLogout to remove AsyncStorage image ---
  const handleLogout = () => {
    Alert.alert("Confirm Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", onPress: async () => {
          // --- NEW: Remove worker token on logout ---
          if (workerId) {
            try { // Added try/catch for safety
              await fetch(`${API_URL}/workers/save-push-token`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workerId: workerId, token: null }), // Send null
              });
              // --- REMOVED: AsyncStorage.removeItem(`profileImage_${workerId}`); ---
              // No longer needed as we save to DB
            } catch (e) { console.error("Failed to remove worker token on logout:", e); }
          }
          await AsyncStorage.removeItem("user");
          router.replace("/login");
      }, style: "destructive" },
    ]);
  };
  
  // --- MODIFIED: getStatusColor to include 'en_route' ---
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending": return colors.subText;
      case "price_pending": return '#ffc107'; // Yellow for negotiation
      case "confirmed": return colors.primaryButton;
      case "en_route": return '#3b82f6'; // NEW: Blue for On My Way
      case "completed": return "#10b981";
      case "cancelled": return "#dc2626"; // Red for cancelled
      default: return colors.subText;
    }
  };

  const renderSkillModal = () => (
    <Modal
      animationType="slide" transparent={true} visible={skillModalVisible}
      onRequestClose={() => setSkillModalVisible(false)} >
      <Pressable style={styles.modalBackdrop} onPress={() => setSkillModalVisible(false)}>
        <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Select Your Service</Text>
          <ScrollView>
            {ALL_SKILLS.map((skill) => (
              <TouchableOpacity key={skill} style={[styles.modalOption, { borderBottomColor: colors.inputBorder }]}
                onPress={() => { setSelectedSkill(skill); setSkillModalVisible(false); }}>
                <Text style={[styles.modalOptionText, { color: colors.text }]}>{skill}</Text>
                {selectedSkill === skill && <Ionicons name="checkmark-circle" size={24} color={colors.primaryButton} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
  
  // --- MODIFIED: Date/Time/Price Picker Modal Renderer ---
  const renderDateTimeModal = () => {
    if (!currentJobToSchedule) return null;
    
    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={dateTimeModalVisible}
            onRequestClose={() => setDateTimeModalVisible(false)}
        >
            <Pressable style={styles.modalBackdrop} onPress={() => setDateTimeModalVisible(false)}>
                <Pressable style={[styles.dateTimeModalContent, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 10 }]}>Propose Price & Schedule</Text>
                    <Text style={[styles.modalSubtitle, { color: colors.subText, marginBottom: 20, paddingHorizontal: 10 }]}>
                        Set your price and confirm the best time for the <Text style={{fontWeight: 'bold', color: colors.text}}>{currentJobToSchedule.service}</Text> job.
                    </Text>
                    
                    {/* Price Input */}
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Proposed Price ($)</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder, marginBottom: 20 }]}
                        onChangeText={setPriceInput}
                        value={priceInput}
                        placeholder="Enter price..."
                        keyboardType="numeric"
                        placeholderTextColor={colors.subText}
                    />

                    {/* Date Time Picker */}
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Confirm Date and Time</Text>
                    <DateTimePicker
                        testID="dateTimePicker"
                        value={selectedDateTime}
                        mode="datetime"
                        is24Hour={true}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onDateTimeChange}
                        minimumDate={new Date()}
                        style={styles.datePicker}
                        textColor={colors.text}
                    />
                    
                    <View style={styles.modalActionButtons}>
                        <TouchableOpacity 
                            onPress={() => setDateTimeModalVisible(false)}
                            style={[styles.modalButton, { backgroundColor: colors.inputBorder }]}
                        >
                            <Text style={[styles.statusButtonText, { color: colors.text }]}>Cancel</Text>
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
        </Modal>
    );
  };
  // --- END MODIFIED DATE/TIME/PRICE PICKER ---

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {renderSkillModal()}
      {renderDateTimeModal()}
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
          style={[styles.skillSelector, { backgroundColor: colors.cardBackground, borderColor: colors.inputBorder }]}
          onPress={() => setSkillModalVisible(true)} >
          <Text style={[styles.skillSelectorText, { color: selectedSkill ? colors.text : colors.subText }]}>
            {selectedSkill || "Select your service"}
          </Text>
          <Ionicons name="chevron-down" size={24} color={colors.subText} />
        </TouchableOpacity>

        <View style={[styles.profileSection, { backgroundColor: colors.cardBackground }]}>
          <TouchableOpacity onPress={handlePickImage}>
            <Image 
              source={{ uri: profileImage || `https://i.pravatar.cc/100?u=${workerId}` }} 
              style={styles.avatar} />
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={20} color="white" />
            </View>
          </TouchableOpacity>
          <TextInput
            style={[styles.workerNameInput, { color: colors.text, borderBottomColor: colors.inputBorder }]}
            value={name} onChangeText={setName} placeholder="Your Name" placeholderTextColor={colors.subText} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.cardBackground, borderColor: colors.inputBorder }]}>
          <Text style={[styles.label, { color: colors.text }]}>Shift Status</Text>
          <TouchableOpacity onPress={handleClockToggle}
            style={[styles.clockButton, { backgroundColor: clockedIn ? "#ef4444" : "#10b981" }]} >
            <Text style={styles.clockText}>{clockedIn ? "Clock Out" : "Clock In"}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.subHeader, { color: colors.text }]}>My Details</Text>
        <View style={[styles.detailsCard, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.label, { color: colors.subText }]}>Age</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder }]}
            value={age} onChangeText={setAge} placeholder="e.g., 30" keyboardType="number-pad" placeholderTextColor={colors.subText} />
          
          <Text style={[styles.label, { color: colors.subText }]}>Gender</Text>
          <View style={styles.genderContainer}>
            {GENDERS.map((g) => (
              <TouchableOpacity key={g}
                style={[ styles.genderButton, { backgroundColor: gender === g ? colors.primaryButton : colors.background,
                    borderColor: gender === g ? colors.primaryButton : colors.inputBorder } ]}
                onPress={() => setGender(g)} >
                <Text style={{ color: gender === g ? colors.primaryButtonText : colors.text, fontSize: 12 }}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={[styles.subHeader, { color: colors.text }]}>Travel Distance</Text>
        <View style={[styles.detailsCard, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.distanceLabel, { color: colors.text }]}> Up to {maxDistance.toFixed(0)} km </Text>
          <Slider style={styles.slider} minimumValue={5} maximumValue={100} step={5} value={maxDistance}
            onSlidingComplete={setMaxDistance} minimumTrackTintColor={colors.primaryButton}
            maximumTrackTintColor={colors.inputBorder} thumbTintColor={colors.primaryButton} />
        </View>
        
        <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primaryButton, opacity: isSaving ? 0.6 : 1 }]}
            onPress={handleSaveProfile} disabled={isSaving} >
            <Text style={styles.saveButtonText}>{isSaving ? "Saving..." : "Save Profile"}</Text>
        </TouchableOpacity>

        <Text style={[styles.subHeader, { color: colors.text }]}>Current Location</Text>
        {location ? (
          <MapView style={styles.map} region={{ latitude: location.latitude, longitude: location.longitude,
              latitudeDelta: 0.01, longitudeDelta: 0.01, }}>
            <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }}
              title="You are here" pinColor={colors.primaryButton} />
          </MapView>
        ) : ( <Text style={[styles.loadingText, { color: colors.subText }]}> Loading map... </Text> )}

        <Text style={[styles.subHeader, { color: colors.text }]}>My Jobs</Text>
        {appointments.length > 0 ? appointments.map((job) => (
          <View key={job._id} style={[styles.jobCard, { backgroundColor: colors.cardBackground, borderColor: colors.inputBorder }]}>
            <View style={styles.jobRow}>
              <Text style={[styles.jobTime, { color: colors.primaryButton }]}>
                {new Date(job.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={[styles.jobStatus, { color: getStatusColor(job.status) }]}>{job.status.replace('_', ' ')}</Text>
            </View>
            <Text style={[styles.jobAddress, { color: colors.text, fontWeight: 'bold' }]}>{job.service}</Text>
            <Text style={[styles.jobAddress, { color: colors.text }]}>Client: {job.customer?.name || 'Loading...'}</Text>
            
            {/* --- NEW: Display Proposed Price --- */}
            <Text style={[styles.jobAddress, { color: job.workerPrice ? colors.primaryButton : colors.subText, fontWeight: '700' }]}>
                Price: {job.workerPrice ? `$${job.workerPrice.toFixed(2)}` : 'Awaiting Proposal'}
            </Text>
            {/* --- */}
            
            <Text style={[styles.jobAddress, { color: colors.text, marginTop: 4 }]}>Address: {job.address}</Text>
            <Text style={[styles.jobDescription, { color: colors.subText }]}>Description: {job.description}</Text>
            
            <View style={styles.statusActions}>
              {/* Only show action buttons if the job is not completed or cancelled */}
              {job.status.toLowerCase() !== 'completed' && job.status.toLowerCase() !== 'cancelled' ? (
                <>
                  {/* --- MODIFIED: Show 'Propose' or 'Reschedule' button --- */}
                  {(job.status.toLowerCase() === 'pending' || job.status.toLowerCase() === 'confirmed') && (
                    <TouchableOpacity 
                      onPress={() => handleUpdateJobStatus(job._id, 'confirmed', job)} 
                      style={[styles.statusButton, {backgroundColor: colors.primaryButton}]}
                      // Disable if already price_pending (worker shouldn't propose again, waits for customer)
                      disabled={job.status.toLowerCase() === 'price_pending'} 
                    >
                      <Text style={styles.statusButtonText}>
                        {job.status.toLowerCase() === 'pending' ? 'Propose Price/Time' : 'Reschedule'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* --- NEW: Show 'On My Way' button ONLY if confirmed --- */}
                  {job.status.toLowerCase() === 'confirmed' && (
                    <TouchableOpacity 
                        onPress={() => handleUpdateJobStatus(job._id, 'en_route')} 
                        style={[styles.statusButton, {backgroundColor: '#3b82f6'}]} // Blue color
                    >
                        <Text style={styles.statusButtonText}>On My Way</Text>
                    </TouchableOpacity>
                  )}
                  
                  {/* --- MODIFIED: Only show 'Complete' if job is 'en_route' --- */}
                  {job.status.toLowerCase() === 'en_route' && (
                    <TouchableOpacity 
                        onPress={() => handleUpdateJobStatus(job._id, 'completed')} 
                        style={[styles.statusButton, {backgroundColor: '#10b981'}]}
                    >
                        <Text style={styles.statusButtonText}>Complete</Text>
                    </TouchableOpacity>
                  )}

                  {/* --- Show 'Price Pending' if waiting for customer --- */}
                  {job.status.toLowerCase() === 'price_pending' && (
                    <View style={[styles.statusButton, {backgroundColor: '#ffc107'}]}>
                       <Text style={styles.statusButtonText}>Price Pending</Text>
                    </View>
                  )}
                  
                  {/* Cancel Button - Available unless completed/cancelled */}
                  <TouchableOpacity 
                    onPress={() => handleUpdateJobStatus(job._id, 'cancelled')} 
                    style={[styles.statusButton, {backgroundColor: '#dc2626'}]}
                  >
                    <Text style={styles.statusButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                // Show a label if the job is finished or cancelled
                <Text style={[styles.jobStatus, { color: getStatusColor(job.status), fontSize: 16, marginTop: 10, alignSelf: 'flex-start' }]}>
                    Job {job.status}
                </Text>
              )}
            </View>
          </View>
        )) : ( 
            <View style={[styles.jobCard, { backgroundColor: colors.cardBackground, borderColor: colors.inputBorder, alignItems: 'center' }]}>
                <Text style={{color: colors.subText, textAlign: 'center', fontSize: 16, padding: 20}}>You have no jobs scheduled.</Text> 
            </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  headerBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, marginTop: 10 },
  header: { fontSize: 24, fontWeight: "bold" },
  headerIcons: { flexDirection: "row", alignItems: "center", gap: 15 },
  skillSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 12, borderWidth: 1, marginBottom: 20, },
  skillSelectorText: { fontSize: 16, fontWeight: '600', },
  profileSection: { alignItems: 'center', padding: 20, borderRadius: 12, marginBottom: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#fff' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 15 },
  workerNameInput: { marginTop: 15, fontSize: 20, fontWeight: 'bold', textAlign: 'center', borderBottomWidth: 1, paddingBottom: 5, width: '80%', },
  section: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 8, padding: 15, borderRadius: 12, borderWidth: 1, shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  label: { fontSize: 16, fontWeight: "500" },
  inputLabel: { fontSize: 14, fontWeight: '500', alignSelf: 'flex-start', marginBottom: 5 }, // NEW style
  clockButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  clockText: { color: "white", fontWeight: "bold" },
  subHeader: { fontSize: 18, fontWeight: "600", marginTop: 24, marginBottom: 12 },
  detailsCard: { padding: 20, borderRadius: 12, marginBottom: 10, },
  input: { padding: 12, borderRadius: 8, fontSize: 16, borderWidth: 1, marginBottom: 15, width: '100%'}, // MODIFIED width
  genderContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, },
  genderButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, },
  distanceLabel: { fontSize: 16, fontWeight: '500', textAlign: 'center', marginBottom: 10, },
  slider: { width: '100%', height: 40, },
  saveButton: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20, marginHorizontal: 10 },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  map: { width: "100%", height: 250, borderRadius: 10, marginBottom: 20, },
  loadingText: { textAlign: "center", fontStyle: "italic", paddingVertical: 30 },
  jobCard: { borderRadius: 12, padding: 15, marginVertical: 6, borderWidth: 1, shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  jobRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  jobTime: { fontSize: 16, fontWeight: "700" },
  jobAddress: { fontSize: 14, marginVertical: 2 },
  jobDescription: { fontSize: 12, fontStyle: 'italic', marginVertical: 4 },
  workerNotes: { // --- NEW STYLE ---
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '600',
    marginTop: 8,
    padding: 8,
    borderWidth: 1,
    borderRadius: 6,
  },
  jobStatus: { fontSize: 14, fontWeight: "600", textTransform: 'capitalize' },
  statusActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 10, flexWrap: 'wrap' }, 
  statusButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  statusButtonText: { color: 'white', fontWeight: 'bold' },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', },
  modalContent: { width: '90%', maxHeight: '70%', borderRadius: 20, padding: 20, overflow: 'hidden' },
  dateTimeModalContent: { width: '90%', maxWidth: 400, borderRadius: 12, padding: 20, alignItems: 'center' },
  datePicker: { width: '100%', height: 200 }, 
  modalSubtitle: { fontSize: 14, textAlign: 'center' },
  selectedDateTimeText: { fontSize: 16, fontWeight: 'bold' },
  modalActionButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20, gap: 10 },
  modalButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, },
  modalOptionText: { fontSize: 16, },
});
