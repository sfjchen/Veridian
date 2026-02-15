import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { palette } from "../constants/palette";
import { radius } from "../constants/palette";

interface Props {
  latex: string;
}

function buildHtml(content: string): string {
  const safe = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"
    onload="renderMathInElement(document.getElementById('content'),{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false},{left:'\\\\(', right:'\\\\)', display:false},{left:'\\\\[', right:'\\\\]', display:true}],throwOnError:false});">
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-size: 14px; padding: 6px 8px; font-family: system-ui; background: transparent; }
    .katex { font-size: 1.1em; }
  </style>
</head>
<body><div id="content">${safe}</div></body>
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
