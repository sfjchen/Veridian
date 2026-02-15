import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { palette, radius } from "../constants/palette";

interface Props {
  latex: string;
}

function normalizeLatexInput(raw: string): string {
  const tex = raw.trim();
  if (tex.length < 2) return tex;
  if (tex.startsWith("$$") && tex.endsWith("$$") && tex.length > 4) return tex.slice(2, -2).trim();
  if (tex.startsWith("\\[") && tex.endsWith("\\]")) return tex.slice(2, -2).trim();
  if (tex.startsWith("\\(") && tex.endsWith("\\)")) return tex.slice(2, -2).trim();
  if (tex.startsWith("$") && tex.endsWith("$") && tex.length > 2) return tex.slice(1, -1).trim();
  return tex;
}

function hasMathDelimiters(input: string): boolean {
  return /\$\$[\s\S]*\$\$|\$[^$]+\$|\\\([\s\S]*\\\)|\\\[[\s\S]*\\\]/.test(input);
}

function hasLatexEnvironment(input: string): boolean {
  return /\\begin\{[a-zA-Z*]+\}[\s\S]*\\end\{[a-zA-Z*]+\}/.test(input);
}

function normalizeCommonLatexArtifacts(raw: string): string {
  const trimmed = raw.trim();
  const withoutQuotes =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1).trim()
      : trimmed;

  return withoutQuotes
    .replace(/\\\{begin\{/g, "\\begin{")
    .replace(/\\\{end\{/g, "\\end{")
    .replace(/\\n/g, "\n");
}

function isLikelyLatex(input: string): boolean {
  const tex = input.trim();
  if (!tex) return false;
  if (tex.includes("$$") || tex.includes("\\(") || tex.includes("\\[")) return true;
  if (/\\[a-zA-Z]+/.test(tex)) return true;
  return /\^|_|\\{|\\}/.test(tex);
}

function buildHtml(content: string): string {
  const normalizedInput = normalizeCommonLatexArtifacts(content);
  const normalized = normalizeLatexInput(normalizedInput);
  const useDelimiterRender = hasMathDelimiters(content);
  const hasEnvironment = hasLatexEnvironment(normalizedInput);
  const likelyLatex = isLikelyLatex(content);
  const safe = normalizedInput
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const sourcePayload = JSON.stringify(normalized);
  const originalPayload = JSON.stringify(normalizedInput);
  const useDelimiterPayload = JSON.stringify(useDelimiterRender);
  const hasEnvironmentPayload = JSON.stringify(hasEnvironment);
  const likelyLatexPayload = JSON.stringify(likelyLatex);
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-size: 14px; padding: 6px 8px; font-family: system-ui; background: transparent; }
    .katex { font-size: 1.1em; }
  </style>
</head>
<body><div id="content">${safe}</div>
<script>
  const target = document.getElementById('content');
  const source = ${sourcePayload};
  const original = ${originalPayload};
  const useDelimiterRender = ${useDelimiterPayload};
  const hasEnvironment = ${hasEnvironmentPayload};
  const likelyLatex = ${likelyLatexPayload};

  try {
    if (useDelimiterRender && typeof renderMathInElement === 'function') {
      target.textContent = original;
      renderMathInElement(target, {
        throwOnError: false,
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\\\[', right: '\\\\]', display: true },
          { left: '\\\\(', right: '\\\\)', display: false },
        ],
      });
    } else if (likelyLatex && typeof katex !== 'undefined') {
      target.textContent = '';
      katex.render(source, target, { throwOnError: false, displayMode: hasEnvironment });
    }
  } catch (e) {
    target.textContent = original;
  }
</script>
</body>
</html>`;
}

function WebInlineLatex({ latex }: Props) {
  const html = buildHtml(latex);
  return (
    <View style={styles.container}>
      <iframe
        srcDoc={html}
        style={{ width: "100%", height: 48, border: "none" } as any}
        title="LaTeX Preview"
      />
    </View>
  );
}

function NativeInlineLatex({ latex }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WebView } = require("react-native-webview");
  const html = buildHtml(latex);

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        originWhitelist={["*"]}
        javaScriptEnabled={true}
      />
    </View>
  );
}

export function InlineLatexRenderer(props: Props) {
  if (Platform.OS === "web") return <WebInlineLatex {...props} />;
  return <NativeInlineLatex {...props} />;
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    borderRadius: radius.input,
    backgroundColor: palette.surface,
    overflow: "hidden",
    marginTop: 4,
  },
  webview: { flex: 1, backgroundColor: "transparent" },
});
