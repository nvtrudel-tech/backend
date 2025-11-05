import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
}
from "react-native";
// Import SafeAreaView from 'react-native-safe-area-context'
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "./context/ThemeContext";
import ThemeToggle from "./components/ThemeToggle";

const API_URL = "https://backend-tknm.onrender.com/api";

export default function Signup() {
  const router = useRouter();
  const { colors } = useTheme();
  
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [loading, setLoading] = useState(false);

  /**
   * Helper function to robustly handle API errors (JSON or HTML/Text)
   */
  const handleApiError = async (response, defaultMessage) => {
    try {
      // Try to get text error message, in case it's not JSON
      const errorText = await response.text();
      console.error("Server responded with an error:", errorText);
      
      // Try to parse as JSON in case the server *did* send a JSON error
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        // It wasn't JSON, throw the text (or default if text is empty)
        throw new Error(errorText || defaultMessage);
      }
      // It was JSON, use the message
      throw new Error(errorData.msg || defaultMessage);
    } catch (e) {
      // Handle cases where .text() fails or re-throw the parsed error
      throw new Error(e.message || defaultMessage);
    }
  };

  const handleSignup = async () => {
    if (!name || !phone || !email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);

    try {
      // Step 1: Always create a primary user account for authentication.
      const authResponse = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, password, role }),
      });

      if (!authResponse.ok) {
        // Use the helper to handle non-JSON error responses
        await handleApiError(authResponse, "Failed to create user account.");
      }

      // If we get here, authResponse.ok was true, so .json() is safe
      const authData = await authResponse.json();

      // Step 2: If the user is a specialist, also create a worker profile.
      if (role === 'specialist') {
        const workerResponse = await fetch(`${API_URL}/workers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Pass all relevant info to the worker profile
            body: JSON.stringify({ 
              name, 
              phone, 
              email,
              authId: authData.user._id // Link the worker profile to the auth user
            }),
        });

        if (!workerResponse.ok) {
          // This is a fallback error. Ideally, the backend would handle this transactionally.
          // Use the helper to handle non-JSON error responses
          await handleApiError(workerResponse, "User account was created, but failed to create the specialist profile.");
        }
      }

      Alert.alert("Success", "Account created successfully! Please log in.");
      router.push("/login");

    } catch (err) {
      // This will now catch the much clearer error messages
      console.error("Signup error:", err);
      Alert.alert("Signup Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={colors.gradient} style={styles.gradient}>
      {/* Use SafeAreaView to avoid notches and system UI */}
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.container}
        >
          {/* Header Bar for Toggle */}
          <View style={styles.headerBar}>
            <ThemeToggle />
          </View>

          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.inputBorder }]}>
              <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>

              <TextInput
                  placeholder="Full Name"
                  placeholderTextColor={colors.subText}
                  value={name}
                  onChangeText={setName}
                  style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
                  returnKeyType="next"
              />

              <TextInput
                  placeholder="Phone Number"
                  placeholderTextColor={colors.subText}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
                  returnKeyType="next"
              />

              <TextInput
                  placeholder="Email"
                  placeholderTextColor={colors.subText}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
                  returnKeyType="next"
              />

              <TextInput
                  placeholder="Password"
                  placeholderTextColor={colors.subText}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
                  returnKeyType="done"
              />

              <Text style={[styles.roleLabel, { color: colors.subText }]}>I am a:</Text>
              <View style={styles.roleContainer}>
                  <TouchableOpacity
                  style={[
                      styles.roleButton,
                      { 
                        backgroundColor: role === "customer" ? colors.primaryButton : colors.cardBackground, 
                        borderColor: role === "customer" ? colors.primaryButton : colors.inputBorder,
                      },
                  ]}
                  onPress={() => setRole("customer")}
                  >
                  <Text
                      style={[
                      styles.roleText,
                      { color: role === "customer" ? colors.primaryButtonText : colors.text },
                      ]}
                  >
                      Customer
                  </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                  style={[
                      styles.roleButton,
                      { 
                        backgroundColor: role === "specialist" ? colors.primaryButton : colors.cardBackground,
                        borderColor: role === "specialist" ? colors.primaryButton : colors.inputBorder,
                      },
                  ]}
                  onPress={() => setRole("specialist")}
                  >
                  <Text
                      style={[
                      styles.roleText,
                      { color: role === "specialist" ? colors.primaryButtonText : colors.text },
                      ]}
                  >
                      Specialist
                  </Text>
                  </TouchableOpacity>
              </View>

              <TouchableOpacity
                  style={[styles.buttonPrimary, { backgroundColor: colors.primaryButton, opacity: loading ? 0.7 : 1 }]}
                  onPress={handleSignup}
                  disabled={loading}
              >
                  <Text style={[styles.buttonPrimaryText, { color: colors.primaryButtonText }]}>
                  {loading ? "Creating Account..." : "Sign Up"}
                  </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push("/login")} disabled={loading} style={styles.linkButton}>
                  <Text style={[styles.linkText, { color: colors.text }]}>
                  Already have an account? <Text style={{fontWeight: 'bold'}}>Log In</Text>
                  </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerBar: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 10 : 0, // Adjust for platform
    right: 20,
    zIndex: 1,
  },
  card: {
    width: "100%",
    borderRadius: 20,
    padding: 25,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    borderWidth: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 25,
  },
  input: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
    marginLeft: 5,
  },
  roleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 10,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5, // Make border slightly thicker
  },
  roleText: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttonPrimary: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  buttonPrimaryText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  linkButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    marginTop: 18,
    fontSize: 14,
    textAlign: "center",
  },
});
