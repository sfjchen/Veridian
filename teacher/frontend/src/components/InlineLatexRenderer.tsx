import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { palette } from "../constants/palette";
import { radius } from "../constants/palette";

interface Props {
  latex: string;
}

const KATEX_INLINE_HTML = (content: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-size: 13px; padding: 4px 8px; font-family: system-ui; background: transparent; overflow: hidden; }
    .katex { font-size: 1em; }
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

function WebInlineLatex({ latex }: Props) {
  const html = KATEX_INLINE_HTML(sanitizeLatex(latex));
  const blobUrl = React.useMemo(() => {
    const blob = new Blob([html], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [html]);

  React.useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  return (
    <View style={styles.container}>
      <iframe
        src={blobUrl}
        style={{ width: "100%", height: 40, border: "none" } as any}
        sandbox="allow-scripts allow-same-origin"
        title="LaTeX Preview"
      />
    </View>
  );
}

function NativeInlineLatex({ latex }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WebView } = require("react-native-webview");
  const html = KATEX_INLINE_HTML(sanitizeLatex(latex));

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        originWhitelist={["about:blank"]}
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
    height: 40,
    borderRadius: radius.input,
    backgroundColor: palette.surface,
    overflow: "hidden",
    marginTop: 4,
  },
  webview: { flex: 1, backgroundColor: "transparent" },
});
