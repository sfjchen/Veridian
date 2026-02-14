import React from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

interface Props {
  latex: string;
  style?: object;
}

export function LatexRenderer({ latex, style }: Props) {
  const html = `
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
      <div id="content">${latex.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
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

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 200 },
  webview: { flex: 1, backgroundColor: "transparent" },
});
