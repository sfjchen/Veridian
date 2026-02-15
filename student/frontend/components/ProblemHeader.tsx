import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { palette, radius } from '@/constants/palette';
import { spacing, typography } from '@/constants/theme';

type ProblemHeaderProps =
  | { problemNum: number; statementTex: string; onDone?: never; loading?: never }
  | { problemNum?: never; statementTex?: never; onDone: () => void; loading?: boolean };

function katexHtml(tex: string): string {
  const escaped = tex.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/'/g, "\\'");
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"/>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<style>
  body { margin: 0; padding: 12px 16px; display: flex; align-items: center; justify-content: center;
         font-family: -apple-system, sans-serif; background: transparent; overflow: hidden; }
  #math { font-size: 22px; color: #111827; text-align: center; }
</style>
</head><body>
<div id="math"></div>
<script>
  try { katex.render('${escaped}', document.getElementById('math'), { throwOnError: false, displayMode: true }); }
  catch(e) { document.getElementById('math').textContent = '${escaped}'; }
</script>
</body></html>`;
}

function WebLatexView({ statementTex }: { statementTex: string }) {
  const html = katexHtml(statementTex);
  const blobUrl = React.useMemo(() => {
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [html]);

  React.useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  return (
    <View style={styles.webViewWrap}>
      <iframe
        src={blobUrl}
        style={{ width: '100%', height: 56, border: 'none', overflow: 'hidden' } as any}
        sandbox="allow-scripts allow-same-origin"
        title="Problem Statement"
      />
    </View>
  );
}

export function ProblemHeader(props: ProblemHeaderProps) {
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
  const hasLatex = statementTex.includes('\\');
  const isWeb = Platform.OS === 'web';

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Problem {problemNum}</Text>
      {hasLatex && isWeb ? (
        <WebLatexView statementTex={statementTex} />
      ) : hasLatex ? (
        <View style={styles.webViewWrap}>
          <WebView
            source={{ html: katexHtml(statementTex) }}
            style={styles.webView}
            scrollEnabled={false}
            originWhitelist={['*']}
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
    height: 56,
    overflow: 'hidden',
  },
  webView: {
    backgroundColor: 'transparent',
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
