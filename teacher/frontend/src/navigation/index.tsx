import React from "react";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
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
import { StudentExperienceScreen } from "../screens/teacher/StudentExperienceScreen";
import { StudentMistakeDetailScreen } from "../screens/teacher/StudentMistakeDetailScreen";
import { ReviewAssignmentScreen } from "../screens/teacher/ReviewAssignmentScreen";
import { StudentDashboardScreen } from "../screens/student/DashboardScreen";
import { StudentClassroomScreen } from "../screens/student/ClassroomScreen";
import { AssignmentScreen } from "../screens/student/AssignmentScreen";
import { StudentWorkReviewScreen } from "../screens/teacher/StudentWorkReviewScreen";
import { StudentSubmissionsScreen } from "../screens/teacher/StudentSubmissionsScreen";
import { palette, radius } from "../constants/palette";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";
import { TeacherHeaderLeft } from "../components/TeacherHeaderLeft";
import { TeacherHeaderRight } from "../components/TeacherHeaderRight";

const AuthStack = createNativeStackNavigator();
const TeacherStack = createNativeStackNavigator();
const StudentStack = createNativeStackNavigator();

const headerScreenOptions = {
  contentStyle: { backgroundColor: "transparent" },
  headerStyle: {
    backgroundColor: "rgba(255,255,255,0.92)",
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
      <TeacherStack.Screen name="ReviewAssignment" component={ReviewAssignmentScreen} options={{ title: "Review Assignment" }} />
      <TeacherStack.Screen name="TeacherAssignment" component={TeacherAssignmentScreen} options={{ title: "Assignment" }} />
      <TeacherStack.Screen name="StudentExperience" component={StudentExperienceScreen} options={{ title: "Student Experience", headerShown: false }} />
      <TeacherStack.Screen name="StudentMistakeDetail" component={StudentMistakeDetailScreen} options={{ title: "Student Mistakes" }} />
      <TeacherStack.Screen name="StudentWorkReview" component={StudentWorkReviewScreen} options={{ title: "Student Work" }} />
      <TeacherStack.Screen name="StudentSubmissions" component={StudentSubmissionsScreen} options={{ title: "Student Submissions" }} />
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
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  const transparentTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: "transparent",
      card: "transparent",
    },
  };

  return (
    <NavigationContainer theme={transparentTheme}>
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
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg, backgroundColor: "transparent" },
  errorText: { ...typography.h2, color: palette.textPrimary, marginBottom: spacing.xs, textAlign: "center" },
  errorSubtext: { ...typography.bodySmall, color: palette.textMuted, marginBottom: spacing.lg, textAlign: "center" },
  signOutButton: {
    backgroundColor: palette.error,
    borderRadius: radius.button,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  signOutText: { ...typography.button, color: palette.textOnPrimary },
});
