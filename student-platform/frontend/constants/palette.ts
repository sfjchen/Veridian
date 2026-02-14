/**
 * Shared palette for the main flow (library + document screens).
 * Keeps colors and radii consistent and easy to tweak.
 */

export const palette = {
  primary: '#111827',
  surface: '#f3f4f6',
  card: '#ffffff',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  textPrimary: '#111827',
  textSecondary: '#374151',
  textMuted: '#6b7280',
  textDisabled: '#9ca3af',
  rowPressed: '#f9fafb',
  inkStroke: '#111827',
  white: '#ffffff',
  errorBg: '#fef2f2',
  errorText: '#dc2626',
} as const;

export const radius = {
  button: 10,
  card: 12,
  thumb: 8,
} as const;
