// app/login.tsx
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://localhost:6000/api/auth";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Login Failed", data.msg || "Invalid credentials");
        return;
      }

      const { user } = data;
      await AsyncStorage.setItem("user", JSON.stringify(user));
      Alert.alert("Welcome!", `Hello ${user.name}`);

      if (user.role === "worker") {
        router.replace("/worker/dashboard");
      } else {
        router.replace("/index");
      }
    } catch (err) {
      console.error("Login error:", err);
      Alert.alert("Error", "Unable to connect to the server");
    }
  };

  const handleBypass = () => {
    Alert.alert("Bypassing Login", "Redirecting to Worker Dashboard");
    router.replace("/worker/dashboard");
  };

  return (
    <LinearGradient colors={["#3b82f6", "#6366f1"]} style={styles.gradient}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={require("../assets/images/logo_elec.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <View style={styles.formContainer}>
            <TextInput
              placeholder="Email"
              placeholderTextColor="#aaa"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              autoCapitalize="none"
            />

            <TextInput
              placeholder="Password"
              placeholderTextColor="#aaa"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
            />

            <TouchableOpacity style={styles.buttonPrimary} onPress={handleLogin}>
              <Text style={styles.buttonPrimaryText}>Login</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.buttonSecondary} onPress={handleBypass}>
              <Text style={styles.buttonSecondaryText}>
                Bypass → Worker Dashboard
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/signup")}>
              <Text style={styles.linkText}>Don't have an account? Sign up</Text>
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
  logo: {
    width: 140,
    height: 140,
    marginBottom: 40,
  },
  formContainer: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    padding: 25,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  input: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  buttonPrimary: {
    backgroundColor: "#fff",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  buttonPrimaryText: {
    color: "#3b82f6",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonSecondary: {
    backgroundColor: "#10b981",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  buttonSecondaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  linkText: {
    color: "#fff",
    marginTop: 24,
    fontSize: 14,
    textAlign: "center",
    opacity: 0.9,
  },
});
