/**
 * Shared palette for teacher app. Single source for colors and radii.
 */

export const palette = {
  primary: "#4F46E5",
  primaryPressed: "#4338CA",
  surface: "#f9fafb",
  card: "#ffffff",
  border: "#e5e7eb",
  borderStrong: "#d1d5db",
  inputBorder: "#ddd",
  textPrimary: "#111827",
  textSecondary: "#374151",
  textMuted: "#6B7280",
  textDisabled: "#9CA3AF",
  error: "#EF4444",
  errorBg: "#FEF2F2",
  success: "#10B981",
  successBg: "#F0FDF4",
  warning: "#F59E0B",
  warningBg: "#FEF3C7",
  white: "#ffffff",
  tabInactive: "#E5E7EB",
  link: "#4F46E5",
} as const;

export const radius = {
  button: 8,
  card: 12,
  input: 8,
  chip: 16,
} as const;

export const typography = {
  h1: { fontSize: 24, fontWeight: "bold" as const },
  h2: { fontSize: 22, fontWeight: "bold" as const },
  body: { fontSize: 16 },
  bodySmall: { fontSize: 14 },
  caption: { fontSize: 13 },
} as const;
