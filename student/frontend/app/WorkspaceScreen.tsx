import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { DrawingCanvas, type DrawingCanvasRef } from '@/components/DrawingCanvas';
import { submitAnalysis, type Mistake } from '@/lib/api';
import { BoxOverlay } from '@/components/MistakeOverlay';
import { ProblemHeader } from '@/components/ProblemHeader';
import { ToolBar, type Tool } from '@/components/ToolBar';

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

  const apiUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';

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
      if (!apiUrl) {
        Alert.alert('Submit failed', 'Set EXPO_PUBLIC_BACKEND_URL in frontend/.env and restart Expo.');
        return;
      }
      const body = await submitAnalysis(uri, { isSample: true });
      const raw = body.mistakes ?? [];
      const ms = raw.filter((m): m is Mistake & { x_min: number; y_min: number; x_max: number; y_max: number } =>
        typeof m.x_min === 'number' && typeof m.y_min === 'number' &&
        typeof m.x_max === 'number' && typeof m.y_max === 'number' &&
        m.x_max > m.x_min && m.y_max > m.y_min
      );
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
        ? Platform.OS === 'android'
          ? 'Use EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:8000 for emulator'
          : 'Check backend at http://localhost:8000 is running (python get_coords.py). Restart Expo after changing .env.'
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
          <Pressable
            style={({ pressed }) => [styles.checkButton, pressed && !submitLoading && { opacity: 0.7 }]}
            onPress={handleDone}
            disabled={submitLoading}
            accessibilityRole="button"
            accessibilityLabel="Check work">
            {submitLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.checkButtonText}>Check</Text>
            )}
          </Pressable>
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
            <BoxOverlay mistakes={mistakes} layoutWidth={captureSize.w} layoutHeight={captureSize.h} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f7fb',
  },
  content: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerCard: {
    flex: 1,
  },
  checkButton: {
    minWidth: 88,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#2d4faa',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  checkButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  statusBanner: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#eaf0ff',
    borderWidth: 1,
    borderColor: '#cad8ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#2d4faa',
    fontWeight: '600',
  },
  canvasWrap: {
    flex: 1,
    position: 'relative',
  },
});
