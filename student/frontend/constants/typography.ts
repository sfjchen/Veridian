/**
 * Veridian typography (matches teacher). Load DM Sans / Dancing Script in app _layout when using these.
 */

export const fontFamily = {
  regular: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  semiBold: "DMSans_600SemiBold",
  bold: "DMSans_700Bold",
  wordmark: "DancingScript_600SemiBold",
} as const;

export const typography = {
  display: { fontFamily: fontFamily.bold, fontSize: 32, fontWeight: "700" as const, lineHeight: 40, letterSpacing: -0.5 },
  h1: { fontFamily: fontFamily.bold, fontSize: 24, fontWeight: "700" as const, lineHeight: 32, letterSpacing: 0 },
  h2: { fontFamily: fontFamily.semiBold, fontSize: 20, fontWeight: "600" as const, lineHeight: 28 },
  body: { fontFamily: fontFamily.regular, fontSize: 16, fontWeight: "400" as const, lineHeight: 24 },
  bodySmall: { fontFamily: fontFamily.regular, fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
  caption: { fontFamily: fontFamily.regular, fontSize: 12, fontWeight: "400" as const, lineHeight: 16 },
  button: { fontFamily: fontFamily.semiBold, fontSize: 16, fontWeight: "600" as const, lineHeight: 24 },
  buttonSmall: { fontFamily: fontFamily.semiBold, fontSize: 14, fontWeight: "600" as const, lineHeight: 20 },
} as const;
