/**
 * Typography scale. Mirror of teacher semantics for future shared package.
 * Omit fontFamily to use system font; set fontFamily when custom font is loaded (e.g. in app root).
 */

export const fontFamily = {
  regular: undefined as string | undefined,
  medium: undefined as string | undefined,
  semiBold: undefined as string | undefined,
  bold: undefined as string | undefined,
  wordmark: "Caveat",
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: "700" as const, lineHeight: 40, letterSpacing: -0.5 },
  h1: { fontSize: 24, fontWeight: "700" as const, lineHeight: 32, letterSpacing: 0 },
  h2: { fontSize: 20, fontWeight: "600" as const, lineHeight: 28 },
  body: { fontSize: 16, fontWeight: "400" as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: "400" as const, lineHeight: 16 },
  button: { fontSize: 16, fontWeight: "600" as const, lineHeight: 24 },
  buttonSmall: { fontSize: 14, fontWeight: "600" as const, lineHeight: 20 },
} as const;
