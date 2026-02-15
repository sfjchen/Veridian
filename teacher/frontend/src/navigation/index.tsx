import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { useAuth } from "../stores/auth";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { SignupScreen } from "../screens/auth/SignupScreen";
import { TeacherDashboardScreen } from "../screens/teacher/DashboardScreen";
import { TeacherClassroomScreen } from "../screens/teacher/ClassroomScreen";
import { CorpusUploadScreen } from "../screens/teacher/CorpusUploadScreen";
import { CreateAssignmentScreen } from "../screens/teacher/CreateAssignmentScreen";
import { TeacherAssignmentScreen } from "../screens/teacher/AssignmentScreen";
import { StudentExperienceScreen } from "../screens/teacher/StudentExperienceScreen";
import { StudentMistakeDetailScreen } from "../screens/teacher/StudentMistakeDetailScreen";
import { StudentDashboardScreen } from "../screens/student/DashboardScreen";
import { StudentClassroomScreen } from "../screens/student/ClassroomScreen";
import { AssignmentScreen } from "../screens/student/AssignmentScreen";
import { palette } from "../constants/palette";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";
import { Button } from "../components/ui/Button";
import { TeacherHeaderLeft } from "../components/TeacherHeaderLeft";
import { TeacherHeaderRight } from "../components/TeacherHeaderRight";

const AuthStack = createNativeStackNavigator();
const TeacherStack = createNativeStackNavigator();
const StudentStack = createNativeStackNavigator();

const headerScreenOptions = {
  headerStyle: {
    backgroundColor: palette.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  headerTintColor: palette.textPrimary,
  headerTitleStyle: { ...typography.h2 },
  headerShadowVisible: false,
};

const teacherScreenOptions = {
  ...headerScreenOptions,
  headerLeft: () => <TeacherHeaderLeft />,
  headerLeftContainerStyle: { paddingLeft: spacing.sm },
  headerRightContainerStyle: { paddingRight: spacing.sm },
  headerTitleContainerStyle: { paddingHorizontal: spacing.xs },
};

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
    <TeacherStack.Navigator screenOptions={teacherScreenOptions}>
      <TeacherStack.Screen
        name="TeacherDashboard"
        component={TeacherDashboardScreen}
        options={{ headerTitle: () => null, headerRight: () => <TeacherHeaderRight /> }}
      />
      <TeacherStack.Screen name="Classroom" component={TeacherClassroomScreen} options={{ title: "Classroom" }} />
      <TeacherStack.Screen name="CorpusUpload" component={CorpusUploadScreen} options={{ title: "Upload File" }} />
      <TeacherStack.Screen name="CreateAssignment" component={CreateAssignmentScreen} options={{ title: "New Assignment" }} />
      <TeacherStack.Screen name="TeacherAssignment" component={TeacherAssignmentScreen} options={{ title: "Assignment" }} />
      <TeacherStack.Screen name="StudentExperience" component={StudentExperienceScreen} options={{ title: "Student Experience", headerShown: false }} />
      <TeacherStack.Screen name="StudentMistakeDetail" component={StudentMistakeDetailScreen} options={{ title: "Student Mistakes" }} />
    </TeacherStack.Navigator>
  );
}

function StudentNavigator() {
  return (
    <StudentStack.Navigator screenOptions={headerScreenOptions}>
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
      <Button variant="danger" onPress={signOut} style={styles.signOutButton}>
        Sign Out
      </Button>
    </View>
  );
}

export function RootNavigator() {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.primary} />
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
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: palette.surface },
  errorText: { ...typography.h2, color: palette.textPrimary, marginBottom: 8, textAlign: "center" },
  errorSubtext: { ...typography.bodySmall, color: palette.textMuted, marginBottom: 24, textAlign: "center" },
  signOutButton: { marginTop: spacing.xs },
});
