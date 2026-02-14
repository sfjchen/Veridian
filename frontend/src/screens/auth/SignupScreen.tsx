import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../stores/auth";
import { UserRole } from "../../types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

type SignupScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Signup">;
};

export function SignupScreen({ navigation }: SignupScreenProps) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!displayName.trim() || !email.trim() || !password) {
      Alert.alert("Validation Error", "Please fill in all fields.");
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert("Weak Password", `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, role, displayName.trim());
      Alert.alert("Success", "Account created! You can now sign in.");
      navigation.navigate("Login");
    } catch (e: any) {
      Alert.alert("Signup Failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <TextInput
        style={styles.input}
        placeholder="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <View style={styles.roleContainer}>
        <Text style={styles.roleLabel}>I am a:</Text>
        <View style={styles.roleButtons}>
          <TouchableOpacity
            style={[styles.roleButton, role === "student" && styles.roleActive]}
            onPress={() => setRole("student")}
          >
            <Text style={[styles.roleText, role === "student" && styles.roleTextActive]}>Student</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleButton, role === "teacher" && styles.roleActive]}
            onPress={() => setRole("teacher")}
          >
            <Text style={[styles.roleText, role === "teacher" && styles.roleTextActive]}>Teacher</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Creating account..." : "Sign Up"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate("Login")}>
        <Text style={styles.link}>Already have an account? Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 32, textAlign: "center" },
  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 14,
    marginBottom: 16, fontSize: 16,
  },
  roleContainer: { marginBottom: 24 },
  roleLabel: { fontSize: 16, marginBottom: 8, fontWeight: "500" },
  roleButtons: { flexDirection: "row", gap: 12 },
  roleButton: {
    flex: 1, borderWidth: 2, borderColor: "#ddd", borderRadius: 8,
    padding: 12, alignItems: "center",
  },
  roleActive: { borderColor: "#4F46E5", backgroundColor: "#EEF2FF" },
  roleText: { fontSize: 16, color: "#666" },
  roleTextActive: { color: "#4F46E5", fontWeight: "600" },
  button: {
    backgroundColor: "#4F46E5", borderRadius: 8, padding: 16,
    alignItems: "center", marginBottom: 16,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { textAlign: "center", color: "#4F46E5", fontSize: 14 },
});
