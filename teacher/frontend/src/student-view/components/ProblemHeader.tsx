import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { palette, radius } from '../constants/palette';

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
  const useWebView = Platform.OS !== 'web' && statementTex.includes('\\');
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Problem {problemNum}</Text>
      {useWebView ? (
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
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textMuted,
    marginBottom: 4,
    textAlign: 'center',
  },
  statement: {
    fontSize: 22,
    color: palette.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 30,
  },
  webViewWrap: { height: 56, overflow: 'hidden' },
  webView: { backgroundColor: 'transparent' },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  promptLabel: { fontSize: 12, color: palette.textMuted, marginBottom: 4, textAlign: 'center' },
  promptText: { fontSize: 26, lineHeight: 32, color: palette.textPrimary, fontWeight: '600', textAlign: 'center' },
  doneButton: {
    minWidth: 92,
    borderRadius: radius.card,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  doneButtonDisabled: { opacity: 0.7 },
  doneText: { color: palette.white, fontSize: 16, fontWeight: '700' },
});
