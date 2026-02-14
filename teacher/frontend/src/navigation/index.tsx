import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth } from "../stores/auth";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { SignupScreen } from "../screens/auth/SignupScreen";
import { TeacherDashboardScreen } from "../screens/teacher/DashboardScreen";
import { TeacherClassroomScreen } from "../screens/teacher/ClassroomScreen";
import { CorpusUploadScreen } from "../screens/teacher/CorpusUploadScreen";
import { CreateAssignmentScreen } from "../screens/teacher/CreateAssignmentScreen";
import { TeacherAssignmentScreen } from "../screens/teacher/AssignmentScreen";
import { StudentDashboardScreen } from "../screens/student/DashboardScreen";
import { StudentClassroomScreen } from "../screens/student/ClassroomScreen";
import { AssignmentScreen } from "../screens/student/AssignmentScreen";

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

function TeacherNavigator() {
  return (
    <TeacherStack.Navigator>
      <TeacherStack.Screen name="TeacherDashboard" component={TeacherDashboardScreen} options={{ title: "Dashboard" }} />
      <TeacherStack.Screen name="Classroom" component={TeacherClassroomScreen} options={{ title: "Classroom" }} />
      <TeacherStack.Screen name="CorpusUpload" component={CorpusUploadScreen} options={{ title: "Upload File" }} />
      <TeacherStack.Screen name="CreateAssignment" component={CreateAssignmentScreen} options={{ title: "New Assignment" }} />
      <TeacherStack.Screen name="TeacherAssignment" component={TeacherAssignmentScreen} options={{ title: "Assignment" }} />
    </TeacherStack.Navigator>
  );
}

function StudentNavigator() {
  return (
    <StudentStack.Navigator>
      <StudentStack.Screen name="StudentDashboard" component={StudentDashboardScreen} options={{ title: "My Classes" }} />
      <StudentStack.Screen name="StudentClassroom" component={StudentClassroomScreen} options={{ title: "Classroom" }} />
      <StudentStack.Screen name="Assignment" component={AssignmentScreen} options={{ title: "Assignment" }} />
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
