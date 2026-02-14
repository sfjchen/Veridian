import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
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
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

function StudentPlaceholder() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
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

export function RootNavigator() {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
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
      ) : (
        <StudentNavigator />
      )}
    </NavigationContainer>
  );
}
