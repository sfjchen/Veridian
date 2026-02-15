import { MD3LightTheme } from "react-native-paper";
import { palette } from "../constants/palette";

/**
 * React Native Paper theme customized with Veridian palette.
 * Use with PaperProvider. Paper components (Button, TextInput, Card, etc.) use this.
 */
export const veridianPaperTheme = {
  ...MD3LightTheme,
  roundness: 8,
  colors: {
    ...MD3LightTheme.colors,
    primary: palette.primary,
    primaryContainer: palette.primaryMuted,
    secondary: palette.primary,
    secondaryContainer: palette.primaryMutedTint,
    surface: palette.surfaceElevated,
    surfaceVariant: palette.surface,
    background: palette.surface,
    error: palette.error,
    errorContainer: palette.errorBg,
    onPrimary: palette.textOnPrimary,
    onSecondary: palette.textOnPrimary,
    onSurface: palette.textPrimary,
    onSurfaceVariant: palette.textSecondary,
    onError: palette.textOnPrimary,
    outline: palette.border,
    outlineVariant: palette.borderStrong,
  },
};
