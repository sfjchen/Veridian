import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth } from "../stores/auth";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { SignupScreen } from "../screens/auth/SignupScreen";

const AuthStack = createNativeStackNavigator();
const TeacherStack = createNativeStackNavigator();
const StudentStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

function TeacherPlaceholder() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" />
    </View>
  );
}

function StudentPlaceholder() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" />
    </View>
  );
}

function TeacherNavigator() {
  return (
    <TeacherStack.Navigator>
      <TeacherStack.Screen name="TeacherDashboard" component={TeacherPlaceholder} options={{ title: "Dashboard" }} />
    </TeacherStack.Navigator>
  );
}

function StudentNavigator() {
  return (
    <StudentStack.Navigator>
      <StudentStack.Screen name="StudentDashboard" component={StudentPlaceholder} options={{ title: "Dashboard" }} />
    </StudentStack.Navigator>
  );
}

function InvalidRoleScreen() {
  const { signOut } = useAuth();

  return (
    <View style={styles.center}>
      <Text style={styles.errorText}>Unable to determine your account role.</Text>
      <Text style={styles.errorSubtext}>Please contact support or try signing in again.</Text>
      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

export function RootNavigator() {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!session ? (
        <AuthNavigator />
      ) : role === "teacher" ? (
        <TeacherNavigator />
      ) : role === "student" ? (
        <StudentNavigator />
      ) : (
        <InvalidRoleScreen />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { fontSize: 18, fontWeight: "600", marginBottom: 8, textAlign: "center" },
  errorSubtext: { fontSize: 14, color: "#666", marginBottom: 24, textAlign: "center" },
  signOutButton: {
    backgroundColor: "#EF4444",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  signOutText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
