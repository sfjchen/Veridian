# Plan: Web-Compatible Alerts

## Problem
`Alert.alert` from React Native is a no-op on web. All user feedback (errors, success messages) is invisible when running in browser, making the app unusable on web.

## Solution
Create a cross-platform `alert` utility that uses `window.alert` on web and `Alert.alert` on native.

## Files to modify
- **New**: `teacher/frontend/src/lib/alert.ts` — cross-platform alert function
- **Modified** (9 files — replace `Alert.alert` imports):
  - `teacher/frontend/src/screens/auth/LoginScreen.tsx`
  - `teacher/frontend/src/screens/auth/SignupScreen.tsx`
  - `teacher/frontend/src/screens/teacher/DashboardScreen.tsx`
  - `teacher/frontend/src/screens/teacher/ClassroomScreen.tsx` (if applicable)
  - `teacher/frontend/src/screens/teacher/CreateAssignmentScreen.tsx`
  - `teacher/frontend/src/screens/teacher/AssignmentScreen.tsx`
  - `teacher/frontend/src/screens/teacher/CorpusUploadScreen.tsx`
  - `teacher/frontend/src/screens/student/AssignmentScreen.tsx`
  - `teacher/frontend/src/components/FileUploader.tsx`
  - `teacher/frontend/src/components/ClassCodeInput.tsx`

## Approach
- Single small utility: `Platform.OS === 'web' ? window.alert(message) : Alert.alert(title, message)`
- Handle the callback variant (Alert.alert with buttons that have onPress) — on web, use `window.confirm` or just call the callback directly after `window.alert`
- Small PRs: PR 1 = utility + auth screens, PR 2 = remaining screens

## Success criteria
- Sign in/sign up shows errors on web
- All success/error feedback visible on web
- No regression on mobile
