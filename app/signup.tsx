// app/signup.tsx
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const API_URL = "http://localhost:6000/api/auth";

export default function Signup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!name || !phone || !email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, password, role }),
      });

      const text = await response.text();
      console.log("Signup raw response:", text);

      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        console.error("Failed to parse JSON:", e);
      }

      if (!response.ok) {
        Alert.alert("Signup Failed", data?.msg || "Something went wrong");
        return;
      }

      Alert.alert("Success", "Account created! Please log in.");
      router.push("/login");
    } catch (err) {
      console.error("Signup error:", err);
      Alert.alert("Error", "Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#3b82f6", "#6366f1"]} style={styles.gradient}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Create Account</Text>

          <TextInput
            placeholder="Full Name"
            placeholderTextColor="#aaa"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />

          <TextInput
            placeholder="Phone Number"
            placeholderTextColor="#aaa"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={styles.input}
          />

          <TextInput
            placeholder="Email"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          <TextInput
            placeholder="Password"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />

          <View style={styles.roleContainer}>
            <TouchableOpacity
              style={[
                styles.roleButton,
                role === "customer" && styles.roleButtonActive,
              ]}
              onPress={() => setRole("customer")}
            >
              <Text
                style={[
                  styles.roleText,
                  role === "customer" && styles.roleTextActive,
                ]}
              >
                Customer
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleButton,
                role === "specialist" && styles.roleButtonActive,
              ]}
              onPress={() => setRole("specialist")}
            >
              <Text
                style={[
                  styles.roleText,
                  role === "specialist" && styles.roleTextActive,
                ]}
              >
                Specialist
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.buttonPrimary}
            onPress={handleSignup}
            disabled={loading}
          >
            <Text style={styles.buttonPrimaryText}>
              {loading ? "Creating Account..." : "Sign Up"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={styles.linkText}>
              Already have an account? Log in
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 25,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 25,
  },
  input: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  roleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 10,
    gap: 10,
  },
  roleButton: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  roleButtonActive: { backgroundColor: "#3b82f6" },
  roleText: {
    color: "#3b82f6",
    fontSize: 16,
    fontWeight: "600",
  },
  roleTextActive: { color: "#fff" },
  buttonPrimary: {
    backgroundColor: "#fff",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  buttonPrimaryText: {
    color: "#3b82f6",
    fontSize: 16,
    fontWeight: "600",
  },
  linkText: {
    color: "#fff",
    marginTop: 18,
    fontSize: 14,
    textAlign: "center",
    opacity: 0.9,
  },
});
