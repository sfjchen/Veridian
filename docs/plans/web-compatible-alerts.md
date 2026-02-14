# Plan: Web-Compatible Alerts

## Problem
`Alert.alert` from React Native is a no-op on web. All user feedback (errors, success messages) is invisible when running in browser, making the app unusable on web.

## Solution
Create a cross-platform `alert` utility that uses `window.alert` on web and `Alert.alert` on native.

## Files to modify
- **New**: `frontend/src/lib/alert.ts` — cross-platform alert function
- **Modified** (9 files — replace `Alert.alert` imports):
  - `frontend/src/screens/auth/LoginScreen.tsx`
  - `frontend/src/screens/auth/SignupScreen.tsx`
  - `frontend/src/screens/teacher/DashboardScreen.tsx`
  - `frontend/src/screens/teacher/ClassroomScreen.tsx` (if applicable)
  - `frontend/src/screens/teacher/CreateAssignmentScreen.tsx`
  - `frontend/src/screens/teacher/AssignmentScreen.tsx`
  - `frontend/src/screens/teacher/CorpusUploadScreen.tsx`
  - `frontend/src/screens/student/AssignmentScreen.tsx`
  - `frontend/src/components/FileUploader.tsx`
  - `frontend/src/components/ClassCodeInput.tsx`

## Approach
- Single small utility: `Platform.OS === 'web' ? window.alert(message) : Alert.alert(title, message)`
- Handle the callback variant (Alert.alert with buttons that have onPress) — on web, use `window.confirm` or just call the callback directly after `window.alert`
- Small PRs: PR 1 = utility + auth screens, PR 2 = remaining screens

## Success criteria
- Sign in/sign up shows errors on web
- All success/error feedback visible on web
- No regression on mobile
