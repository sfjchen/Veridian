import { Platform } from "react-native";

/**
 * Veridian design palette. Single source for colors, radii, elevation.
 * Primary: Veridian green (#16A34A).
 */

export const palette = {
  primary: "#16A34A",
  primaryPressed: "#15803D",
  primaryMuted: "#ECFDF5",
  primaryMutedTint: "#F5FBF8",
  surface: "#f9fafb",
  surfaceElevated: "#ffffff",
  card: "#ffffff",
  border: "#e5e7eb",
  borderStrong: "#d1d5db",
  inputBorder: "#d1d5db",
  textPrimary: "#111827",
  textSecondary: "#374151",
  textMuted: "#6B7280",
  textDisabled: "#9CA3AF",
  textOnPrimary: "#ffffff",
  error: "#EF4444",
  errorBg: "#FEF2F2",
  success: "#10B981",
  successBg: "#F0FDF4",
  successButton: "#059669",
  successText: "#065F46",
  warning: "#F59E0B",
  warningBg: "#FEF3C7",
  warningText: "#92400E",
  info: "#1E3A8A",
  infoBg: "#EFF6FF",
  white: "#ffffff",
  tabInactive: "#E5E7EB",
  link: "#16A34A",
  overlay: "rgba(0,0,0,0.4)",
} as const;

export const radius = {
  button: 8,
  card: 12,
  input: 8,
  chip: 16,
  modal: 16,
} as const;

export const elevation = {
  shadowSm: Platform.select({
    web: { boxShadow: "0 1px 3px rgba(0,0,0,0.06)" as const },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
  }),
  shadowMd: Platform.select({
    web: { boxShadow: "0 4px 12px rgba(0,0,0,0.08)" as const },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
  }),
  shadowLg: Platform.select({
    web: { boxShadow: "0 12px 40px rgba(0,0,0,0.12)" as const },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 40,
      elevation: 8,
    },
  }),
} as const;
