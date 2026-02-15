import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { palette } from '@/constants/palette';

type InlineLatexProps = {
  content: string;
  fontSize?: number;
  color?: string;
};

function buildHtml(content: string, fontSize: number, color: string): string {
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"/>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
<style>
  body { margin: 0; padding: 8px 12px; font-family: -apple-system, sans-serif;
         background: transparent; color: ${color}; font-size: ${fontSize}px;
         line-height: 1.45; word-wrap: break-word; }
  .katex { font-size: 1em; }
</style>
</head><body>
<div id="content">${escaped}</div>
<script>
  renderMathInElement(document.getElementById('content'), {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\\\[', right: '\\\\]', display: true },
      { left: '\\\\(', right: '\\\\)', display: false },
    ],
    throwOnError: false,
  });
  var h = document.body.scrollHeight;
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ height: h }));
  else if (window.parent) window.parent.postMessage({ height: h }, '*');
</script>
</body></html>`;
}

function WebInlineLatex({ html }: { html: string }) {
  const [height, setHeight] = React.useState(60);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const blobUrl = useMemo(() => {
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [html]);

  React.useEffect(() => () => URL.revokeObjectURL(blobUrl), [blobUrl]);

  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data.height) setHeight(Math.ceil(data.height) + 4);
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <View style={styles.wrap}>
      <iframe
        ref={iframeRef}
        src={blobUrl}
        style={{ width: '100%', height, border: 'none', overflow: 'hidden' } as any}
        sandbox="allow-scripts allow-same-origin"
        title="LaTeX content"
      />
    </View>
  );
}

function NativeInlineLatex({ html }: { html: string }) {
  const [height, setHeight] = React.useState(60);

  const onMessage = React.useCallback((e: any) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.height) setHeight(Math.ceil(data.height) + 4);
    } catch {}
  }, []);

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        source={{ html }}
        style={styles.webView}
        scrollEnabled={false}
        originWhitelist={['*']}
        onMessage={onMessage}
      />
    </View>
  );
}

export function InlineLatex({ content, fontSize = 14, color = palette.textPrimary }: InlineLatexProps) {
  const html = useMemo(() => buildHtml(content, fontSize, color), [content, fontSize, color]);

  if (Platform.OS === 'web') return <WebInlineLatex html={html} />;
  return <NativeInlineLatex html={html} />;
}

/** Quick check whether content contains LaTeX delimiters or commands. */
export function hasLatex(text: string): boolean {
  return /\\[a-zA-Z]|\\[(\[]|\$/.test(text);
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', minHeight: 30 },
  webView: { backgroundColor: 'transparent' },
});
