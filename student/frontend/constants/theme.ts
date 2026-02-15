import { elevation, palette as lightPalette, radius } from "@/constants/palette";
import { motion } from "@/constants/motion";
import { spacing } from "@/constants/spacing";
import { fontFamily, typography } from "@/constants/typography";

export type ThemeMode = "light" | "dark";
export type PaletteTokens = typeof lightPalette;

export interface SemanticTheme {
  bg: { app: string; surface: string; card: string; elevated: string; muted: string; overlay: string };
  text: { primary: string; secondary: string; muted: string; onPrimary: string; disabled: string };
  border: { default: string; strong: string; input: string };
  action: { primary: string; primaryPressed: string; subtle: string; link: string };
  state: {
    error: string;
    errorBg: string;
    success: string;
    successBg: string;
    warning: string;
    warningBg: string;
  };
  forest: { skyTop: string; skyMid: string; skyGlow: string; layerNear: string; layerMid: string; layerFar: string };
}

export interface AppTheme {
  mode: ThemeMode;
  palette: PaletteTokens;
  semantic: SemanticTheme;
  radius: typeof radius;
  elevation: typeof elevation;
  typography: typeof typography;
  fontFamily: typeof fontFamily;
  spacing: typeof spacing;
  motion: typeof motion;
}

const darkSunsetPalette: PaletteTokens = {
  ...lightPalette,
  primary: "#E27A3F",
  primaryMutedTint: "#2F2220",
  surface: "#120F1B",
  card: "#221D31",
  border: "#3A3248",
  borderStrong: "#50465F",
  inputBorder: "#50465F",
  tabInactive: "#2D263A",
  textPrimary: "#F3ECE6",
  textSecondary: "#C9BBB1",
  textMuted: "#9E8F86",
  textDisabled: "#756A63",
  textOnPrimary: "#FFF7F2",
  rowPressed: "#2B2436",
  inkStroke: "#F3ECE6",
  error: "#F87171",
  errorBg: "#3A1E25",
  errorText: "#FFD5D8",
  link: "#F4A261",
  overlay: "rgba(0,0,0,0.58)",
  success: "#34D399",
  successBg: "#173329",
  warning: "#F59E0B",
  warningBg: "#3D2A16",
  primaryMuted: "#3A2A22",
  forestCanopy: "#273C39",
  forestLeaf: "#1C2F2D",
  forestBark: "#4E3D35",
  forestMist: "#2A1B3D",
  forestGradientStart: "#1A1028",
  forestGradientEnd: "#4A2A3F",
  forestSky: "#1A1028",
  forestSunGlow: "#B65A3A",
  forestLayer1: "#3D2C3A",
  forestLayer2: "#322835",
  forestLayer3: "#273033",
  forestLayer4: "#223331",
  forestLayer5: "#1C2F2D",
  forestLayer6: "#132523",
  forestLayer7: "#0E1B1A",
};

export const lightTheme: AppTheme = {
  mode: "light" as const,
  palette: lightPalette,
  semantic: {
    bg: {
      app: lightPalette.surface,
      surface: lightPalette.surface,
      card: lightPalette.card,
      elevated: lightPalette.card,
      muted: lightPalette.primaryMutedTint,
      overlay: lightPalette.overlay,
    },
    text: {
      primary: lightPalette.textPrimary,
      secondary: lightPalette.textSecondary,
      muted: lightPalette.textMuted,
      onPrimary: lightPalette.textOnPrimary,
      disabled: lightPalette.textDisabled,
    },
    border: {
      default: lightPalette.border,
      strong: lightPalette.borderStrong,
      input: lightPalette.inputBorder,
    },
    action: {
      primary: lightPalette.primary,
      primaryPressed: "#15803D",
      subtle: lightPalette.primaryMuted,
      link: lightPalette.link,
    },
    state: {
      error: lightPalette.error,
      errorBg: lightPalette.errorBg,
      success: lightPalette.success,
      successBg: lightPalette.successBg,
      warning: lightPalette.warning,
      warningBg: lightPalette.warningBg,
    },
    forest: {
      skyTop: lightPalette.forestSky,
      skyMid: lightPalette.forestGradientStart,
      skyGlow: lightPalette.forestSunGlow,
      layerNear: lightPalette.forestLayer3,
      layerMid: lightPalette.forestLayer5,
      layerFar: lightPalette.forestLayer7,
    },
  } satisfies SemanticTheme,
  radius,
  elevation,
  typography,
  fontFamily,
  spacing,
  motion,
};

export const darkSunsetTheme: AppTheme = {
  ...lightTheme,
  mode: "dark" as const,
  palette: darkSunsetPalette,
  semantic: {
    bg: {
      app: darkSunsetPalette.surface,
      surface: darkSunsetPalette.surface,
      card: darkSunsetPalette.card,
      elevated: darkSunsetPalette.card,
      muted: darkSunsetPalette.primaryMutedTint,
      overlay: darkSunsetPalette.overlay,
    },
    text: {
      primary: darkSunsetPalette.textPrimary,
      secondary: darkSunsetPalette.textSecondary,
      muted: darkSunsetPalette.textMuted,
      onPrimary: darkSunsetPalette.textOnPrimary,
      disabled: darkSunsetPalette.textDisabled,
    },
    border: {
      default: darkSunsetPalette.border,
      strong: darkSunsetPalette.borderStrong,
      input: darkSunsetPalette.inputBorder,
    },
    action: {
      primary: darkSunsetPalette.primary,
      primaryPressed: "#C8632D",
      subtle: darkSunsetPalette.primaryMuted,
      link: darkSunsetPalette.link,
    },
    state: {
      error: darkSunsetPalette.error,
      errorBg: darkSunsetPalette.errorBg,
      success: darkSunsetPalette.success,
      successBg: darkSunsetPalette.successBg,
      warning: darkSunsetPalette.warning,
      warningBg: darkSunsetPalette.warningBg,
    },
    forest: {
      skyTop: darkSunsetPalette.forestSky,
      skyMid: darkSunsetPalette.forestGradientStart,
      skyGlow: darkSunsetPalette.forestSunGlow,
      layerNear: darkSunsetPalette.forestLayer3,
      layerMid: darkSunsetPalette.forestLayer5,
      layerFar: darkSunsetPalette.forestLayer7,
    },
  } satisfies SemanticTheme,
};

export function resolveTheme(mode?: ThemeMode | null): AppTheme {
  return mode === "dark" ? darkSunsetTheme : lightTheme;
}

export function useAppTheme(): AppTheme {
  return lightTheme;
}

export { radius, elevation, typography, fontFamily, spacing, motion };
