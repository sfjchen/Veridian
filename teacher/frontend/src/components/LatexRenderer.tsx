import React from "react";
import { View, StyleSheet, Platform } from "react-native";

interface Props {
  latex: string;
  style?: object;
}

const KATEX_HTML_TEMPLATE = (content: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <style>
    body { font-size: 18px; padding: 16px; margin: 0; font-family: system-ui; }
    .katex { font-size: 1.1em; }
  </style>
</head>
<body>
  <div id="content">${content}</div>
  <script>
    renderMathInElement(document.getElementById("content"), {
      delimiters: [
        {left: "$$", right: "$$", display: true},
        {left: "$", right: "$", display: false},
        {left: "\\\\(", right: "\\\\)", display: false},
        {left: "\\\\[", right: "\\\\]", display: true},
      ],
      throwOnError: false,
    });
  </script>
</body>
</html>
`;

function sanitizeLatex(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?(<\/iframe>|\/>)/gi, "")
    .replace(/<object[\s\S]*?(<\/object>|\/>)/gi, "")
    .replace(/<embed[\s\S]*?\/>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/on\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript\s*:/gi, "removed:");
}

function WebLatexRenderer({ latex, style }: Props) {
  const html = KATEX_HTML_TEMPLATE(sanitizeLatex(latex));
  const blob = new Blob([html], { type: "text/html" });
  const blobUrl = URL.createObjectURL(blob);

  return (
    <View style={[styles.container, style]}>
      <iframe
        src={blobUrl}
        style={{ width: "100%", minHeight: 300, border: "none", flex: 1 } as any}
        sandbox="allow-scripts"
        title="LaTeX Preview"
      />
    </View>
  );
}

function NativeLatexRenderer({ latex, style }: Props) {
  const { WebView } = require("react-native-webview");
  const html = KATEX_HTML_TEMPLATE(sanitizeLatex(latex));

  return (
    <View style={[styles.container, style]}>
      <WebView
        source={{ html }}
        style={styles.webview}
        scrollEnabled={true}
        originWhitelist={["about:blank"]}
        javaScriptEnabled={true}
      />
    </View>
  );
}

export function LatexRenderer(props: Props) {
  if (Platform.OS === "web") {
    return <WebLatexRenderer {...props} />;
  }
  return <NativeLatexRenderer {...props} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 200 },
  webview: { flex: 1, backgroundColor: "transparent" },
});
