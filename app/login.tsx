import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
// Assuming these are local components, ensure the path is correct
import ThemeToggle from "./components/ThemeToggle";
import { useTheme } from "./context/ThemeContext";

// It's a good practice to place the API URL in a configurable spot
// Make sure this IP is accessible from your mobile device
const API_URL = "https://backend-tknm.onrender.com/api/auth";

export default function Login() {
  const router = useRouter();
  const { colors } = useTheme();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // Basic validation
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Information", "Please enter both email and password.");
      return;
    }
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Use the server's message if available, otherwise a generic one
        Alert.alert("Login Failed", data.msg || "Invalid credentials. Please try again.");
        setLoading(false);
        return;
      }

      // Ensure user data and role exist before proceeding
      const { user } = data;
      if (!user || !user.role) {
          Alert.alert("Login Error", "User data is incomplete. Cannot log in.");
          setLoading(false);
          return;
      }

      // Store user data for session management
      await AsyncStorage.setItem("user", JSON.stringify(user));
      
      // --- DEBUGGING ALERT ---
      // This alert will show you the EXACT role your app is receiving from the server.
      // If it doesn't say "worker" or "specialist", the redirection logic below will fail.
      //Alert.alert("Welcome", `Your trade is: "${user.role}"`);
      Alert.alert(`Welcome, ${user.name}!`, `Your trade is: "${user.role}"`);
      console.log("User role from API:", user.role);

      // Sanitize the role for comparison (lowercase and trim whitespace)
      const userRole = (user.role || '').trim().toLowerCase();

      // Navigate based on the sanitized user role
      if (userRole === "worker" || userRole === "specialist") {
        // If the user is a worker or specialist, redirect to the worker dashboard
        router.replace("/worker/dashboard");
      } else {
        // For 'customer' and all other roles, redirect to the main app screen
        router.replace("/");
      }

    } catch (error) {
      console.error("An error occurred during login:", error);
      Alert.alert("Connection Error", "Unable to connect to the server. Please check your network connection.");
    } finally {
      // Ensure loading is set to false whether the login succeeds or fails
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={colors.gradient} style={styles.gradient}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Bar for Theme Toggle */}
          <View style={styles.headerBar}>
            <ThemeToggle />
          </View>
          
          <Image
            source={require("../assets/images/logo_elec.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <View style={[styles.formContainer, { backgroundColor: colors.cardBackground }]}>
            <TextInput
              placeholder="Email"
              placeholderTextColor={colors.subText}
              value={email}
              onChangeText={setEmail}
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder }]}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              placeholder="Password"
              placeholderTextColor={colors.subText}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder }]}
            />

            <TouchableOpacity 
              style={[styles.buttonPrimary, { backgroundColor: colors.primaryButton }]} 
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={[styles.buttonPrimaryText, { color: colors.primaryButtonText }]}>
                {loading ? "Logging In..." : "Login"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.push("/signup")} 
              disabled={loading}
              style={styles.linkButton}
            >
              <Text style={[styles.linkText, { color: colors.text }]}>
                Don't have an account? <Text style={{fontWeight: 'bold'}}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  headerBar: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 40,
  },
  formContainer: {
    width: "100%",
    padding: 25,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  input: {
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
  },
  buttonPrimary: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  buttonPrimaryText: {
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    marginTop: 24,
    alignItems: 'center'
  },
  linkText: {
    fontSize: 14,
    textAlign: "center",
  },
});

