import { Platform } from 'react-native';

/**
 * Shared palette for the main flow (library + document screens).
 * Keeps colors and radii consistent and easy to tweak.
 */

export const palette = {
  primary: '#111827',
  primaryMutedTint: '#f5f7fb',
  surface: '#f3f4f6',
  card: '#ffffff',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  tabInactive: '#e5e7eb',
  textPrimary: '#111827',
  textSecondary: '#374151',
  textMuted: '#6b7280',
  textDisabled: '#9ca3af',
  rowPressed: '#f9fafb',
  inkStroke: '#111827',
  white: '#ffffff',
  textOnPrimary: '#ffffff',
  error: '#dc2626',
  errorBg: '#fef2f2',
  errorText: '#dc2626',
  link: '#2563eb',
  overlay: 'rgba(0,0,0,0.4)',
} as const;

export const radius = {
  button: 10,
  card: 12,
  thumb: 8,
  input: 8,
  modal: 16,
} as const;

export const elevation = {
  shadowSm: Platform.select({
    web: { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' as const },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    } as const,
  }),
  shadowMd: Platform.select({
    web: { boxShadow: '0 4px 12px rgba(0,0,0,0.08)' as const },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    } as const,
  }),
  shadowLg: Platform.select({
    web: { boxShadow: '0 12px 40px rgba(0,0,0,0.12)' as const },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 40,
      elevation: 8,
    } as const,
  }),
} as const;
