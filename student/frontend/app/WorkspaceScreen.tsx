import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { DrawingCanvas, type DrawingCanvasRef } from "@/components/DrawingCanvas";
import { MistakeOverlay } from "@/components/MistakeOverlay";
import { ProblemHeader } from "@/components/ProblemHeader";
import { ToolBar, type Tool } from "@/components/ToolBar";
import { Button } from "@/components/ui";
import { palette } from "@/constants/palette";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";
import { BACKEND_URL } from "@/lib/backendBaseUrl";
import { submitAnalysis, type Mistake } from "@/lib/api";

export default function WorkspaceScreen() {
  const [tool, setTool] = useState<Tool>('pen');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [captureSize, setCaptureSize] = useState<{ w: number; h: number } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const canvasRef = useRef<DrawingCanvasRef | null>(null);

  const handleHistoryChange = useCallback((undo: boolean, redo: boolean) => {
    setCanUndo(undo);
    setCanRedo(redo);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setTool('pen');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setTool('eraser');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) canvasRef.current?.redo();
        else canvasRef.current?.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        canvasRef.current?.redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);


  const captureCanvas = async (): Promise<string | null> => {
    const uri = await canvasRef.current?.captureWorkArea();
    if (!uri) Alert.alert('Capture failed', 'No image URI returned.');
    return uri ?? null;
  };

  const handleDone = async () => {
    setSubmitStatus(null);
    setSubmitLoading(true);
    setMistakes([]);
    try {
      const uri = await captureCanvas();
      if (!uri) return;
      if (!BACKEND_URL) {
        Alert.alert('Submit failed', 'Set EXPO_PUBLIC_BACKEND_URL in frontend/.env and restart Expo.');
        return;
      }
      const body = await submitAnalysis(uri, { isSample: true });
      const raw = body.mistakes ?? [];
      const ms = raw.filter((m): m is Mistake => typeof m?.dot?.x === 'number' && typeof m?.dot?.y === 'number');
      if (__DEV__ && ms.length !== raw.length) {
        console.warn('[Analysis] Filtered invalid mistake coords:', raw);
      }
      setMistakes(ms);
      const n = body.mistake_count ?? ms.length;
      const summary = n === 0 ? 'No mistakes found!' : `Found ${n} mistake${n !== 1 ? 's' : ''}.`;
      setSubmitStatus(summary);
      Alert.alert('Analysis Complete', summary);
      setTimeout(() => setSubmitStatus(null), 5000);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (__DEV__) console.warn('[WorkspaceScreen] Submit error:', errMsg);
      const isNetwork =
        /fetch|network|failed to fetch/i.test(errMsg) || errMsg.includes('Load failed');
      const msg = isNetwork
        ? "Can't reach server. Start the student backend (python get_coords.py)."
        : errMsg;
      Alert.alert('Submit failed', msg);
      setSubmitStatus('Submit failed');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.headerWrap}>
          <View style={styles.headerCard}>
            <ProblemHeader problemNum={1} statementTex="2x + 5 = 13" />
          </View>
          <Button
            onPress={handleDone}
            loading={submitLoading}
            disabled={submitLoading}
            accessibilityLabel="Check work"
            style={styles.checkButton}
          >
            Check
          </Button>
        </View>
        <ToolBar
          tool={tool}
          onSelectTool={setTool}
          onClear={() => canvasRef.current?.clear()}
          onUndo={() => canvasRef.current?.undo()}
          onRedo={() => canvasRef.current?.redo()}
          canUndo={canUndo}
          canRedo={canRedo}
        />
        {submitStatus ? (
          <View style={styles.statusBanner}>
            <Text style={styles.statusText}>{submitStatus}</Text>
          </View>
        ) : null}
        <View
          style={styles.canvasWrap}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0) setCaptureSize({ w: width, h: height });
          }}>
          <DrawingCanvas
            ref={canvasRef}
            tool={tool}
            onHistoryChange={handleHistoryChange}
            captureSize={captureSize}
          />
          {mistakes.length > 0 && captureSize && (
            <MistakeOverlay mistakes={mistakes} revealMode="single-tap" />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerCard: {
    flex: 1,
  },
  checkButton: {
    minWidth: 88,
  },
  statusBanner: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: palette.primaryMuted,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  statusText: {
    ...typography.caption,
    color: palette.primary,
    fontWeight: "600",
  },
  canvasWrap: {
    flex: 1,
    position: "relative",
  },
});
