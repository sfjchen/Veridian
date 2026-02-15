import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { palette, radius } from '@/constants/palette';
import { spacing, typography } from '@/constants/theme';

type ProblemHeaderProps =
  | { problemNum: number; statementTex: string; onDone?: never; loading?: never }
  | { problemNum?: never; statementTex?: never; onDone: () => void; loading?: boolean };

function normalizeLatexInput(raw: string): string {
  const tex = raw.trim();
  if (tex.length < 2) return tex;
  if (tex.startsWith('$$') && tex.endsWith('$$') && tex.length > 4) return tex.slice(2, -2).trim();
  if (tex.startsWith('\\[') && tex.endsWith('\\]')) return tex.slice(2, -2).trim();
  if (tex.startsWith('\\(') && tex.endsWith('\\)')) return tex.slice(2, -2).trim();
  if (tex.startsWith('$') && tex.endsWith('$') && tex.length > 2) return tex.slice(1, -1).trim();
  return tex;
}

function isLikelyLatex(input: string): boolean {
  const tex = input.trim();
  if (!tex) return false;
  if (tex.includes('$$') || tex.includes('\\(') || tex.includes('\\[')) return true;
  if (/\\[a-zA-Z]+/.test(tex)) return true;
  return /\^|_|\\{|\\}/.test(tex);
}

function hasMathDelimiters(input: string): boolean {
  return /\$\$[\s\S]*\$\$|\$[^$]+\$|\\\([\s\S]*\\\)|\\\[[\s\S]*\\\]/.test(input);
}

function hasEnumerateEnvironment(input: string): boolean {
  return /\\begin\{enumerate\}[\s\S]*\\end\{enumerate\}/.test(input);
}

function katexHtml(tex: string): string {
  const normalized = normalizeLatexInput(tex);
  const useDelimiterRender = hasMathDelimiters(tex);
  const useEnumerateRender = hasEnumerateEnvironment(tex);
  const payload = JSON.stringify(normalized);
  const originalPayload = JSON.stringify(tex);
  const useDelimiterRenderPayload = JSON.stringify(useDelimiterRender);
  const useEnumerateRenderPayload = JSON.stringify(useEnumerateRender);
  const fallbackText = JSON.stringify(tex);
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"/>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
<style>
  body { margin: 0; padding: 12px 16px; display: flex; align-items: center; justify-content: center;
         font-family: -apple-system, sans-serif; background: transparent; min-height: 56px; }
  #math { font-size: 22px; color: #111827; text-align: center; }
  #math ol { margin: 0; padding-left: 1.4em; text-align: left; font-size: 20px; line-height: 1.45; }
  #math li { margin: 0.2em 0; }
  #math .katex-display { margin: 0.5em 0; overflow-x: auto; overflow-y: hidden; max-width: 100%; }
</style>
</head><body>
<div id="math"></div>
<script>
  const source = ${payload};
  const original = ${originalPayload};
  const useDelimiterRender = ${useDelimiterRenderPayload};
  const useEnumerateRender = ${useEnumerateRenderPayload};
  const fallback = ${fallbackText};
  const target = document.getElementById('math');

  function renderEnumerateList(text) {
    const cleaned = text
      .replace(/\\\\begin\\{enumerate\\}/g, '')
      .replace(/\\\\end\\{enumerate\\}/g, '')
      .trim();
    const items = cleaned.split(/\\\\item/g).map(part => part.trim()).filter(Boolean);
    if (!items.length) return false;
    const list = document.createElement('ol');
    items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
    target.innerHTML = '';
    target.appendChild(list);
    if (typeof renderMathInElement === 'function') {
      renderMathInElement(target, {
        throwOnError: false,
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\\\[', right: '\\\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\\\(', right: '\\\\)', display: false },
        ],
      });
    }
    return true;
  }

  try {
    if (useEnumerateRender && renderEnumerateList(original)) {
      // already rendered as HTML list, with math auto-rendered per item
    } else if (useDelimiterRender && typeof renderMathInElement === 'function') {
      target.textContent = original;
      renderMathInElement(target, {
        throwOnError: false,
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\\\[', right: '\\\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\\\(', right: '\\\\)', display: false },
        ],
      });
    } else {
      katex.render(source, target, { throwOnError: false, displayMode: true });
    }
  } catch (e) {
    target.textContent = fallback;
  }
  const height = Math.max(56, document.documentElement.scrollHeight, document.body.scrollHeight);
  const message = '__latex_height__:' + String(height);
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(message);
  }
  if (window.parent && window.parent !== window && window.parent.postMessage) {
    window.parent.postMessage(message, '*');
  }
</script>
</body></html>`;
}

function WebLatexView({ statementTex }: { statementTex: string }) {
  const [webLatexHeight, setWebLatexHeight] = React.useState(72);
  const html = katexHtml(statementTex);
  const blobUrl = React.useMemo(() => {
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [html]);

  React.useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      if (!event.data.startsWith('__latex_height__:')) return;
      const nextHeight = Number(event.data.replace('__latex_height__:', ''));
      if (Number.isFinite(nextHeight) && nextHeight >= 56 && nextHeight <= 1200) {
        setWebLatexHeight(nextHeight);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <View style={[styles.webViewWrap, { minHeight: webLatexHeight }]}>
      <iframe
        src={blobUrl}
        style={{ width: '100%', height: webLatexHeight, border: 'none' } as any}
        sandbox="allow-scripts allow-same-origin"
        title="Problem Statement"
      />
    </View>
  );
}

export function ProblemHeader(props: ProblemHeaderProps) {
  const [mobileLatexHeight, setMobileLatexHeight] = React.useState(72);
  const [latexErrored, setLatexErrored] = React.useState(false);

  React.useEffect(() => {
    setLatexErrored(false);
    setMobileLatexHeight(72);
  }, [props.statementTex]);

  if (props.onDone) {
    return (
      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.promptLabel}>Problem</Text>
          <Text style={styles.promptText}>Expand (x − 4)²</Text>
        </View>
        <Pressable
          style={[styles.doneButton, props.loading && styles.doneButtonDisabled]}
          onPress={props.onDone}
          disabled={props.loading}
          accessibilityRole="button"
          accessibilityLabel="Done">
          {props.loading ? (
            <ActivityIndicator size="small" color={palette.white} />
          ) : (
            <Text style={styles.doneText}>Done</Text>
          )}
        </Pressable>
      </View>
    );
  }
  const { problemNum, statementTex } = props;
  const hasLatex = isLikelyLatex(statementTex);
  const isWeb = Platform.OS === 'web';
  const showPlainFallback = !hasLatex || latexErrored;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Problem {problemNum}</Text>
      {showPlainFallback ? (
        <Text style={styles.statement}>{statementTex}</Text>
      ) : hasLatex && isWeb ? (
        <WebLatexView statementTex={statementTex} />
      ) : hasLatex ? (
        <View style={[styles.webViewWrap, { minHeight: mobileLatexHeight }]}>
          <WebView
            source={{ html: katexHtml(statementTex) }}
            style={[styles.webView, { height: mobileLatexHeight }]}
            scrollEnabled={false}
            javaScriptEnabled
            mixedContentMode="always"
            originWhitelist={['*']}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={palette.primary} />
              </View>
            )}
            onMessage={event => {
              const raw = event.nativeEvent.data;
              const value = typeof raw === 'string' ? raw.replace('__latex_height__:', '') : raw;
              const nextHeight = Number(value);
              if (Number.isFinite(nextHeight) && nextHeight >= 56 && nextHeight <= 1200) {
                setMobileLatexHeight(nextHeight);
              }
            }}
            onError={() => setLatexErrored(true)}
            onHttpError={() => setLatexErrored(true)}
          />
        </View>
      ) : (
        <Text style={styles.statement}>{statementTex}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: palette.textMuted,
    marginBottom: spacing.xxs,
    textAlign: 'center',
  },
  statement: {
    ...typography.h1,
    fontSize: 22,
    lineHeight: 30,
    color: palette.textPrimary,
    textAlign: 'center',
  },
  webViewWrap: {
    minHeight: 56,
  },
  webView: {
    backgroundColor: 'transparent',
  },
  loadingWrap: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  promptLabel: {
    ...typography.caption,
    color: palette.textMuted,
    marginBottom: spacing.xxs,
    textAlign: 'center',
  },
  promptText: {
    ...typography.h1,
    fontSize: 26,
    lineHeight: 32,
    color: palette.textPrimary,
    textAlign: 'center',
  },
  doneButton: {
    minWidth: 92,
    minHeight: 44,
    borderRadius: radius.card,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  doneButtonDisabled: { opacity: 0.7 },
  doneText: {
    ...typography.button,
    color: palette.textOnPrimary,
  },
});
