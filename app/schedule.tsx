import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator, // No longer need Modal/Pressable
  Animated // Import Animated for new UI elements
} from "react-native";
// Import SafeAreaView from react-native-safe-area-context
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from '@expo/vector-icons'; // Import icons
import ThemeToggle from "./components/ThemeToggle";
import { useTheme } from "./context/ThemeContext";

const API_URL = "https://backend-tknm.onrender.com/api";

export default function ScheduleScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const { selectedDate, service } = params;

  // --- NEW: Step state for our multi-step journey ---
  const [step, setStep] = useState(1); // 1: Details, 2: Specialist, 3: Review, 4: Success
  const [workersWithImages, setWorkersWithImages] = useState<any[]>([]);
  const [filteredWorkers, setFilteredWorkers] = useState<any[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<any | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");

  // --- REMOVED: All Modal State ---

  const descriptionInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const initialize = async () => {
      const userString = await AsyncStorage.getItem("user");
      if (userString) {
        setCustomerId(JSON.parse(userString)._id);
      }
      
      try {
        const response = await fetch(`${API_URL}/workers`);
        if (!response.ok) throw new Error("Failed to fetch workers");
        const workers = await response.json();
        
        const workersWithImages = workers.map((worker: any) => {
            const profileImageUri = worker.profileImageBase64 || `https://i.pravatar.cc/60?u=${worker._id}`;
            return { ...worker, profileImageUri };
          });
        
        setWorkersWithImages(workersWithImages);

      } catch (error) {
        console.error("Fetch workers error:", error);
        Alert.alert("Error", "Could not load available specialists.");
      }
    };
    initialize();
  }, []);

  // Filter for workers with the right skill AND who are clocked in
  useEffect(() => {
    if (service) {
      const availableWorkers = workersWithImages.filter(worker => 
        worker.skills?.includes(service) &&
        worker.currentClock?.clockedIn === true
      );
      
      setFilteredWorkers(availableWorkers);
      setSelectedWorker(null); 
    } else {
      setFilteredWorkers([]);
    }
  }, [service, workersWithImages]);

  // --- NEW: Navigation logic for steps ---
  const handleNextStep = () => {
    // Validate Step 1
    if (step === 1) {
      if (!address.trim() || !description.trim()) {
        Alert.alert("Missing Details", "Please fill out the address and description.");
        return;
      }
    }
    
    // Validate Step 2
    if (step === 2) {
      if (!selectedWorker) {
        Alert.alert("Select Specialist", "Please choose a specialist to continue.");
        return;
      }
    }
    
    // Go to next step
    if (step < 3) { // Step 3 (Review) is the last before booking
      setStep(prev => prev + 1);
    }
  };
  
  const handlePrevStep = () => {
     if (step > 1) {
       setStep(prev => prev - 1);
     }
  };

  // --- MODIFIED: This is now called from Step 3 (Review) ---
  const executeBooking = async () => {
    if (!service || !selectedWorker || !customerId || !selectedDate || !address.trim() || !description.trim()) {
      Alert.alert("Error", "Missing booking information. Please go back.");
      return;
    }
    
    setLoading(true);
    try {
      const appointmentData = {
        customer: customerId,
        worker: selectedWorker!._id,
        service: service,
        date: selectedDate,
        address: address.trim(),
        description: description.trim(),
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
      
      // --- NEW: Go to success step ---
      setStep(4);
      
    } catch (error: any) {
      console.error("Booking error:", error);
      Alert.alert("Booking Failed", error.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- REMOVED: handleCloseModal and renderConfirmModal ---

  // --- NEW: Progress Bar Component ---
  const renderProgress = () => {
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressRow}>
          <View style={[styles.progressStep, step >= 1 ? styles.progressStepActive : {}]} />
          <View style={[styles.progressLine, step >= 2 ? styles.progressLineActive : {backgroundColor: colors.inputBorder}]} />
          <View style={[styles.progressStep, step >= 2 ? styles.progressStepActive : {}]} />
          <View style={[styles.progressLine, step >= 3 ? styles.progressLineActive : {backgroundColor: colors.inputBorder}]} />
          <View style={[styles.progressStep, step >= 3 ? styles.progressStepActive : {}]} />
        </View>
        <View style={styles.progressLabelContainer}>
           <Text style={[styles.progressLabel, step === 1 ? styles.progressLabelActive : {color: colors.subText}]}>Details</Text>
           <Text style={[styles.progressLabel, step === 2 ? styles.progressLabelActive : {color: colors.subText}]}>Specialist</Text>
           <Text style={[styles.progressLabel, step === 3 ? styles.progressLabelActive : {color: colors.subText}]}>Review</Text>
        </View>
      </View>
    );
  };
  
  // --- NEW: Render function for Step 1: Details ---
  const renderStep1_Details = () => (
    <ScrollView contentContainerStyle={styles.stepContainer} keyboardShouldPersistTaps="handled">
      <Text style={[styles.stepTitle, { color: colors.text }]}>1. Job Details</Text>
      
      <Text style={[styles.sectionHeading, { color: colors.text }]}>Job Address</Text>
      <TextInput
        style={[styles.input, styles.textArea, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
        placeholder="e.g., 123 Main St, Anytown, CA 90210"
        placeholderTextColor={colors.subText}
        value={address}
        onChangeText={setAddress}
        returnKeyType="next"
        onSubmitEditing={() => descriptionInputRef.current?.focus()}
        multiline={true}
        numberOfLines={3}
      />
      
      <Text style={[styles.sectionHeading, { color: colors.text }]}>Job Description</Text>
      <TextInput
          ref={descriptionInputRef}
          style={[styles.input, styles.textArea, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
          placeholder={`Briefly describe the ${ (service as string)?.toLowerCase()} work...`}
          placeholderTextColor={colors.subText}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          returnKeyType="done"
      />
      
      <TouchableOpacity
        style={[styles.navButton, { backgroundColor: colors.primaryButton }]}
        onPress={handleNextStep}
      >
        <Text style={[styles.navButtonText, { color: colors.primaryButtonText }]}>Next: Choose Specialist</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // --- NEW: Render function for Step 2: Specialist ---
  const renderStep2_Specialist = () => (
    <ScrollView contentContainerStyle={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>2. Choose a Specialist</Text>
      
      {filteredWorkers.length > 0 ? (
        <View style={styles.specialistList}>
          {filteredWorkers.map(worker => (
            <TouchableOpacity
              key={worker._id}
              style={[
                styles.specialistCard,
                {
                  backgroundColor: selectedWorker?._id === worker._id ? colors.primaryButton + '20' : colors.cardBackground,
                  borderColor: selectedWorker?._id === worker._id ? colors.primaryButton : colors.inputBorder,
                  shadowColor: colors.shadow,
                }
              ]}
              onPress={() => setSelectedWorker(worker)}
            >
              <Image
                source={{ uri: worker.profileImageUri }}
                style={styles.specialistAvatar}
              />
              <View style={styles.specialistInfo}>
                <Text style={[
                  styles.specialistName,
                  { color: selectedWorker?._id === worker._id ? colors.primaryButton : colors.text }
                ]}>
                  {worker.name}
                </Text>
                <Text style={[
                  styles.specialistSkill,
                  { color: selectedWorker?._id === worker._id ? colors.primaryButton : colors.subText }
                ]}>
                  {worker.skills?.[0] || 'General Specialist'}
                </Text>
              </View>
              {selectedWorker?._id === worker._id && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primaryButton} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        // --- NEW: Solves the "Dead End" UX problem ---
        <View style={[styles.emptyState, { backgroundColor: colors.cardBackground, shadowColor: colors.shadow }]}>
          <Ionicons name="people-outline" size={50} color={colors.subText} />
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No Specialists Available</Text>
          <Text style={[styles.emptyStateText, { color: colors.subText }]}>
            No specialists for '{service}' are currently "punched in" for this time.
          </Text>
          <TouchableOpacity 
            style={[styles.emptyStateButton, {backgroundColor: colors.primaryButton}]}
            onPress={() => router.replace("/calendar")} // Go back to calendar
          >
            <Text style={[styles.emptyStateButtonText, {color: colors.primaryButtonText}]}>Check Other Times</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.navButtonContainer}>
        <TouchableOpacity
          style={[styles.navButton, { backgroundColor: colors.inputBorder, flex: 1 }]}
          onPress={handlePrevStep}
        >
          <Text style={[styles.navButtonText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, { backgroundColor: colors.primaryButton, flex: 2 }]}
          onPress={handleNextStep}
          disabled={!selectedWorker}
        >
          <Text style={[styles.navButtonText, { color: colors.primaryButtonText }]}>Next: Review</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
  
  // --- NEW: Render function for Step 3: Review ---
  const renderStep3_Review = () => (
    <ScrollView contentContainerStyle={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>3. Review & Confirm</Text>
      
      <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground, shadowColor: colors.shadow }]}>
        {/* Service */}
        <View style={styles.summaryRow}>
          <Ionicons name="build-outline" size={24} color={colors.subText} />
          <View style={styles.summaryTextContainer}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Service</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{service}</Text>
          </View>
        </View>
        
        {/* Date & Time */}
        <View style={styles.summaryRow}>
          <Ionicons name="calendar-outline" size={24} color={colors.subText} />
          <View style={styles.summaryTextContainer}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Date & Time</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {new Date(selectedDate as string).toLocaleDateString([], {
                weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </Text>
          </View>
        </View>
        
        {/* Address */}
        <View style={styles.summaryRow}>
          <Ionicons name="location-outline" size={24} color={colors.subText} />
          <View style={styles.summaryTextContainer}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Address</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{address}</Text>
          </View>
        </View>
        
        {/* Description */}
        <View style={styles.summaryRow}>
          <Ionicons name="chatbox-ellipses-outline" size={24} color={colors.subText} />
          <View style={styles.summaryTextContainer}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Description</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{description}</Text>
          </View>
        </View>
        
        {/* Specialist */}
        <View style={[styles.summaryRow, { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 }]}>
          <Image source={{ uri: selectedWorker.profileImageUri }} style={styles.summaryAvatar} />
          <View style={styles.summaryTextContainer}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Your Specialist</Text>
            <Text style={[styles.summaryValue, { color: colors.text, fontWeight: 'bold' }]}>{selectedWorker.name}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.navButtonContainer}>
        <TouchableOpacity
          style={[styles.navButton, { backgroundColor: colors.inputBorder, flex: 1 }]}
          onPress={handlePrevStep}
          disabled={loading}
        >
          <Text style={[styles.navButtonText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, { backgroundColor: '#10b981', flex: 2 }]} // Green for confirm
          onPress={executeBooking}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryButtonText} />
          ) : (
            <Text style={[styles.navButtonText, { color: colors.primaryButtonText }]}>Confirm Booking</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
  
  // --- NEW: Render function for Step 4: Success ---
  const renderStep4_Success = () => (
    <View style={styles.successContainer}>
      <Animated.View style={{transform: [{scale: 1}]}}> {/* Add animation here later */}
        <Ionicons name="checkmark-circle" size={100} color="#10b981" />
      </Animated.View>
      <Text style={[styles.successTitle, { color: colors.text }]}>Booking Confirmed!</Text>
      <Text style={[styles.successMessage, { color: colors.subText }]}>
        You're all set! <Text style={{fontWeight: 'bold', color: colors.text}}>{selectedWorker.name}</Text> is scheduled to see you on
        {' '}
        {new Date(selectedDate as string).toLocaleDateString([], { month: 'short', day: 'numeric'})}
        {' at '}
        {new Date(selectedDate as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}.
      </Text>
      
      <TouchableOpacity
        style={[styles.navButton, { backgroundColor: colors.primaryButton, width: '100%' }]}
        onPress={() => router.replace("/")} // Go to home, which will show appointments
      >
        <Text style={[styles.navButtonText, { color: colors.primaryButtonText }]}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  // --- NEW: Main render logic switches between steps ---
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return renderStep1_Details();
      case 2:
        return renderStep2_Specialist();
      case 3:
        return renderStep3_Review();
      case 4:
        return renderStep4_Success();
      default:
        return renderStep1_Details();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => {
              if (step === 1) router.back();
              else handlePrevStep(); // Use back button to go back steps
            }} 
            style={styles.backButtonTouch}
          >
            <Text style={[styles.backButton, { color: colors.text }]}>{"<"}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Schedule Your Service</Text>
          <ThemeToggle />
        </View>

        {/* --- Top Info Card, always visible --- */}
        {step < 4 && (
          <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, shadowColor: colors.shadow }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              Service: <Text style={{ color: colors.primaryButton, fontWeight: 'bold' }}>{service}</Text>
            </Text>
            <View style={[styles.divider, {backgroundColor: colors.inputBorder}]} />
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              Date: <Text style={{ color: colors.subText, fontWeight: 'normal' }}>
                {new Date(selectedDate as string).toLocaleDateString([], {
                  weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </Text>
            </Text>
          </View>
        )}
        
        {/* --- Progress Bar, visible on steps 1-3 --- */}
        {step < 4 && renderProgress()}

        {/* --- Render the current step's content --- */}
        <View style={{flex: 1}}>
          {renderStepContent()}
        </View>
        
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- NEW AND REWORKED STYLES ---
const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  // --- Header ---
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 25 : 10,
    paddingBottom: 10,
  },
  backButtonTouch: {
    padding: 8, 
    marginLeft: -8,
  },
  backButton: { 
    fontSize: 28, 
    fontWeight: "300",
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: "600",
    flex: 1, 
    textAlign: 'center', 
    marginHorizontal: 10,
  },
  
  // --- Info Card (Top Summary) ---
  infoCard: {
    padding: 20,
    borderRadius: 15, 
    marginHorizontal: 20,
    elevation: 3, 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  
  // --- Progress Bar ---
  progressContainer: {
    paddingHorizontal: 40,
    paddingVertical: 20,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressStep: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#C0C0C0', // Default light grey
  },
  progressStepActive: {
    backgroundColor: '#10b981', // Active green
    transform: [{ scale: 1.2 }],
  },
  progressLine: {
    flex: 1,
    height: 3,
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: '#10b981', // Active green
  },
  progressLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressLabelActive: {
    color: '#10b981', // Active green
    fontWeight: 'bold',
  },
  
  // --- Step Container (Wraps each step's content) ---
  stepContainer: {
    paddingHorizontal: 20,
    paddingBottom: 50, // For scroll
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "700", 
    marginBottom: 10,
  },
  
  // --- Inputs ---
  input: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 15, 
  },
  textArea: {
      minHeight: 100, 
      textAlignVertical: 'top',
  },
  
  // --- Specialist Card (Step 2) ---
  specialistList: {
    marginTop: 5,
  },
  specialistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15, 
    borderWidth: 2, // Thicker border for selection
    marginVertical: 8, 
    elevation: 2, 
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  specialistAvatar: {
    width: 55, 
    height: 55,
    borderRadius: 27.5,
    marginRight: 15,
  },
  specialistInfo: {
    flex: 1,
  },
  specialistName: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  specialistSkill: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  
  // --- Empty State (Step 2) ---
  emptyState: {
    padding: 25,
    borderRadius: 15,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  emptyStateButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  emptyStateButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // --- Summary Card (Step 3) ---
  summaryCard: {
    padding: 20,
    borderRadius: 15,
    marginTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },
  summaryTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  summaryLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  summaryAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  
  // --- Success Screen (Step 4) ---
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    paddingBottom: 60,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 10,
    marginBottom: 30,
  },
  
  // --- Navigation Buttons (All Steps) ---
  navButtonContainer: {
    flexDirection: 'row',
    marginTop: 30,
    gap: 10,
  },
  navButton: {
    paddingVertical: 16, 
    borderRadius: 15, 
    alignItems: "center",
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  navButtonText: {
    fontSize: 17, 
    textAlign: "center",
    fontWeight: "bold",
  },
  
  // --- OLD/UNUSED STYLES (can be removed) ---
  // confirmButton, confirmText, modal styles
});

