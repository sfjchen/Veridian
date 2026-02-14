import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { WebView } from 'react-native-webview';

import { CenteredMessage } from '@/components/CenteredMessage';
import { ChatPanel } from '@/components/ChatPanel';
import { InkCanvas, type Stroke } from '@/components/InkCanvas';
import { MistakeOverlay } from '@/components/MistakeOverlay';
import { ProblemHeader } from '@/components/ProblemHeader';
import { SampleAlgebraContent } from '@/components/SampleAlgebraContent';
import { palette, radius } from '@/constants/palette';
import { useAssignment } from '@/hooks/useAssignment';
import { useAutoAnalysis } from '@/hooks/useAutoAnalysis';
import { useDocuments, isDefaultDocument } from '@/hooks/useDocuments';
import type { AnalysisResult, Mistake } from '@/lib/api';
import type { CaptureResult } from '@/lib/capture-types';
import { buildAnalysisFormData } from '@/lib/image-upload';
import { captureStrokesAsDataUri } from '@/lib/capture-web';
import { PDF_VIEWER_HTML } from '@/lib/pdf-viewer-html';
import { SAMPLE_ALGEBRA_HTML } from '@/lib/sample-algebra-html';

// Default problems matching the sample algebra worksheet.
const SAMPLE_PROBLEMS = [
  { num: 1, statement_tex: '2x + 5 = 13' },
  { num: 2, statement_tex: '3(x - 4) = 15' },
  { num: 3, statement_tex: '4x + 2 - 3x + 7' },
  { num: 4, statement_tex: 'x/2 + 3 = 8' },
  { num: 5, statement_tex: 'x + y = 10,\\; 2x - y = 2' },
];

function isNetworkError(err: Error): boolean {
  if (err.name === 'TypeError' || err.name === 'NetworkError') return true;
  const msg = err.message.toLowerCase();
  return msg.includes('fetch') || msg.includes('network') || msg.includes('failed to') || msg.includes('connection');
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

type CanvasViewProps = {
  isProblemMode: boolean;
  isDefault: boolean;
  webViewRef: React.MutableRefObject<WebView | null>;
  handleWebViewLoad: () => void;
  handleMessage: (event: { nativeEvent: { data: string } }) => void;
  pageIndex: number;
  viewShotRef: React.RefObject<ViewShot | null>;
  currentStrokes: Stroke[];
  onStrokesChange: (strokes: Stroke[]) => void;
  currentMistakes: Mistake[];
  revealMode: 'single-tap' | 'progressive';
  onAskAboutMistake?: (mistake: Mistake) => void;
  onCanvasLayout?: (width: number, height: number) => void;
};

function CanvasView({
  isProblemMode,
  isDefault,
  webViewRef,
  handleWebViewLoad,
  handleMessage,
  pageIndex,
  viewShotRef,
  currentStrokes,
  onStrokesChange,
  currentMistakes,
  revealMode,
  onAskAboutMistake,
  onCanvasLayout,
}: CanvasViewProps) {
  return (
    <View style={styles.contentWrap}>
      {!isProblemMode && (
        Platform.OS === 'web' ? (
          isDefault ? (
            <View style={styles.webView}><SampleAlgebraContent /></View>
          ) : (
            <View style={[styles.webView, styles.webPdfPlaceholder]}>
              <Text style={styles.webPdfPlaceholderText}>PDF viewing is available in the iOS and Android app.</Text>
            </View>
          )
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html: isDefault ? SAMPLE_ALGEBRA_HTML : PDF_VIEWER_HTML }}
            originWhitelist={['https://', 'about:blank']}
            onLoadEnd={handleWebViewLoad}
            onMessage={handleMessage}
            style={styles.webView}
            scrollEnabled
          />
        )
      )}
      <View style={isProblemMode ? styles.canvasFull : styles.inkOverlay} pointerEvents="box-none">
        <InkCanvas
          key={pageIndex}
          viewShotRef={viewShotRef}
          strokes={currentStrokes}
          onStrokesChange={onStrokesChange}
          onCanvasLayout={onCanvasLayout}
          showToolbar
          style={styles.inkCanvas}
        />
        {currentMistakes.length > 0 && (
          <MistakeOverlay
            mistakes={currentMistakes}
            revealMode={revealMode}
            onAskAboutMistake={onAskAboutMistake}
          />
        )}
      </View>
    </View>
  );
}

export default function DocumentScreen() {
  const params = useLocalSearchParams<{ id: string; assignmentId?: string; classroomName?: string }>();
  const { id, assignmentId: assignmentIdParam, classroomName } = params;
  const assignmentId = assignmentIdParam ?? null;
  const router = useRouter();
  const {
    getDocument,
    loading: docsLoading,
    loadError: docsLoadError,
    saveError: docsSaveError,
    clearLoadError: clearDocsLoadError,
    clearSaveError: clearDocsSaveError,
    refresh: refreshDocuments,
  } = useDocuments();
  const doc = id ? getDocument(id) : undefined;

  const assignmentOnly = !!assignmentId;
  const { assignment, problems: assignmentProblems, loading: assignmentLoading, error: assignmentError } = useAssignment(assignmentId);

  const isDefault = doc ? isDefaultDocument(doc) : false;
  const problems =
    assignmentProblems.length > 0
      ? assignmentProblems
      : isDefault
        ? SAMPLE_PROBLEMS
        : [];
  const isProblemMode = problems.length > 0;
  const assignmentIdForChat = assignmentId ?? (isDefault ? 'sample-algebra' : null);
  const headerTitle = assignmentOnly && assignment ? assignment.title : doc?.name ?? '';
  const backLabel = assignmentOnly
    ? (classroomName ? `Back to ${classroomName}` : 'Back')
    : 'Back to Library';

  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(isProblemMode ? problems.length : 1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [strokesByPage, setStrokesByPage] = useState<Record<number, Stroke[]>>({});
  const [strokesLoaded, setStrokesLoaded] = useState(false);
  const [strokeLoadError, setStrokeLoadError] = useState<string | null>(null);
  const [strokeSaveError, setStrokeSaveError] = useState(false);
  const [resultsByProblem, setResultsByProblem] = useState<Record<number, AnalysisResult>>({});
  const [chatVisible, setChatVisible] = useState(false);
  const [chatProblemNum, setChatProblemNum] = useState<number | null>(null);
  const webViewRef = useRef<WebView | null>(null);
  const webViewReadyRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewShotRef = useRef<ViewShot | null>(null);
  const [canvasDims, setCanvasDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    setCanvasDims(null);
  }, [pageIndex]);

  const STROKES_KEY = id ? `veridian_strokes:${id}` : null;

  const pageIndex = currentPage - 1;
  const currentStrokes = useMemo(() => strokesByPage[pageIndex] ?? [], [strokesByPage, pageIndex]);
  const currentProblem = isProblemMode ? problems[pageIndex] : null;
  const currentMistakes: Mistake[] = currentProblem
    ? resultsByProblem[currentProblem.num]?.mistakes ?? []
    : [];
  const revealMode = assignment?.reveal_mode ?? 'single-tap';

  // Update totalPages when problems change.
  useEffect(() => {
    if (isProblemMode) setTotalPages(problems.length);
  }, [isProblemMode, problems.length]);

  const setCurrentStrokes = useCallback(
    (strokes: Stroke[]) => {
      setStrokesByPage((prev) => ({ ...prev, [pageIndex]: strokes }));
    },
    [pageIndex],
  );

  // --- Stroke persistence ---
  useEffect(() => {
    if (!STROKES_KEY || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STROKES_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as Record<string, Stroke[]>;
          const byPage: Record<number, Stroke[]> = {};
          Object.keys(parsed).forEach((k) => { byPage[Number(k)] = parsed[k]; });
          setStrokesByPage(byPage);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Failed to load saved strokes';
          setStrokeLoadError(msg);
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/b95751e3-13de-4370-a43a-9eeabde26151', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'document/[id].tsx:stroke load', message: 'stroke load error', data: { msg }, hypothesisId: 'H5a', timestamp: Date.now() }) }).catch(() => {});
          // #endregion
        }
      } finally {
        if (!cancelled) setStrokesLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [STROKES_KEY, id]);

  useEffect(() => {
    if (!STROKES_KEY || !strokesLoaded) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const done = () => { saveTimeoutRef.current = null; };
      AsyncStorage.setItem(STROKES_KEY, JSON.stringify(strokesByPage)).catch(() => {
        setStrokeSaveError(true);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b95751e3-13de-4370-a43a-9eeabde26151', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'document/[id].tsx:stroke save', message: 'stroke save error', data: {}, hypothesisId: 'H5b', timestamp: Date.now() }) }).catch(() => {});
        // #endregion
      }).finally(done);
    }, 500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [STROKES_KEY, strokesLoaded, strokesByPage]);

  // --- PDF loading (legacy mode) ---
  useEffect(() => {
    if (!doc) return;
    if (isDefault || isProblemMode) {
      setPdfBase64('default');
      return;
    }
    if (!doc.uri) return;
    let cancelled = false;
    (async () => {
      try {
        const base64 = await FileSystem.readAsStringAsync(doc.uri, {
          encoding: (FileSystem.EncodingType?.Base64 ?? 'base64') as 'base64',
        });
        if (!cancelled) setPdfBase64(base64);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to read PDF');
      }
    })();
    return () => { cancelled = true; };
  }, [doc, isDefault, isProblemMode, doc?.uri]);

  // --- PDF page injection (legacy) ---
  const injectPage = useCallback(
    (pageNum: number) => {
      if (pdfBase64 && pdfBase64 !== 'default' && webViewRef.current) {
        const escaped = JSON.stringify(pdfBase64);
        webViewRef.current.injectJavaScript(`window.loadPdfPage(${escaped}, ${pageNum}); true;`);
      }
    },
    [pdfBase64],
  );

  const handleWebViewLoad = useCallback(() => {
    webViewReadyRef.current = true;
    if (!isDefault && !isProblemMode) injectPage(currentPage);
  }, [currentPage, injectPage, isDefault, isProblemMode]);

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'totalPages') setTotalPages(msg.totalPages ?? 1);
      if (msg.type === 'error') setLoadError(msg.message ?? 'PDF error');
    } catch {
      setLoadError('Invalid response from PDF viewer');
    }
  }, []);

  useEffect(() => {
    if (!isDefault && !isProblemMode && webViewReadyRef.current && pdfBase64) injectPage(currentPage);
  }, [currentPage, pdfBase64, injectPage, isDefault, isProblemMode]);

  // --- Navigation ---
  const goPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));
  const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(totalPages, page)));

  // --- Screenshot capture ---
  const captureScreenshot = useCallback(async (): Promise<CaptureResult> => {
    if (Platform.OS === 'web') {
      if (!canvasDims) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b95751e3-13de-4370-a43a-9eeabde26151', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'document/[id].tsx:captureScreenshot', message: 'capture error', data: { error: 'unavailable', reason: 'no canvasDims' }, hypothesisId: 'H5c', timestamp: Date.now() }) }).catch(() => {});
        // #endregion
        return { error: 'unavailable' };
      }
      try {
        const uri = captureStrokesAsDataUri(currentStrokes, canvasDims.w, canvasDims.h);
        return { uri };
      } catch {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b95751e3-13de-4370-a43a-9eeabde26151', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'document/[id].tsx:captureScreenshot', message: 'capture error', data: { error: 'failed', reason: 'web catch' }, hypothesisId: 'H5c', timestamp: Date.now() }) }).catch(() => {});
        // #endregion
        return { error: 'failed' };
      }
    }
    const viewShot = viewShotRef.current;
    if (!viewShot || typeof viewShot.capture !== 'function') {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b95751e3-13de-4370-a43a-9eeabde26151', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'document/[id].tsx:captureScreenshot', message: 'capture error', data: { error: 'unavailable', reason: 'no viewShot ref' }, hypothesisId: 'H5c', timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      return { error: 'unavailable' };
    }
    try {
      const uri = await viewShot.capture();
      if (!uri) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b95751e3-13de-4370-a43a-9eeabde26151', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'document/[id].tsx:captureScreenshot', message: 'capture error', data: { error: 'failed', reason: 'uri empty' }, hypothesisId: 'H5c', timestamp: Date.now() }) }).catch(() => {});
        // #endregion
        return { error: 'failed' };
      }
      return { uri };
    } catch {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b95751e3-13de-4370-a43a-9eeabde26151', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'document/[id].tsx:captureScreenshot', message: 'capture error', data: { error: 'failed', reason: 'native catch' }, hypothesisId: 'H5c', timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      return { error: 'failed' };
    }
  }, [canvasDims, currentStrokes]);

  // --- Auto-analysis ---
  const debounceMs = assignment?.analysis_debounce_seconds
    ? assignment.analysis_debounce_seconds * 1000
    : 15_000;

  const onStaleResult = useCallback((result: AnalysisResult) => {
    if (result.problem_num == null) return;
    setResultsByProblem((prev) => ({ ...prev, [result.problem_num!]: result }));
  }, []);

  const {
    isAnalyzing,
    lastResult,
    error: analysisError,
    triggerNow,
    markDirty,
  } = useAutoAnalysis({
    assignmentId: assignmentId ?? undefined,
    problemNum: currentProblem?.num,
    isSample: isDefault,
    debounceMs,
    enabled: isProblemMode && (assignment?.auto_analyze ?? isDefault) && !!canvasDims,
    captureScreenshot,
    onError: (msg) => showAlert('Analysis failed', msg),
    onStaleResult,
  });

  // Store results per problem when analysis completes.
  useEffect(() => {
    if (!lastResult || lastResult.problem_num == null) return;
    setResultsByProblem((prev) => ({ ...prev, [lastResult.problem_num!]: lastResult }));
  }, [lastResult]);

  // Mark dirty when strokes change.
  const handleStrokesChange = useCallback(
    (strokes: Stroke[]) => {
      setCurrentStrokes(strokes);
      if (isProblemMode) markDirty();
    },
    [setCurrentStrokes, isProblemMode, markDirty],
  );

  // Manual "Check my work" -- for non-problem mode, use legacy submission.
  const handleCheckWork = useCallback(async () => {
    if (isProblemMode) {
      triggerNow();
      return;
    }
    // Legacy: full-page analysis for non-assignment documents.
    const result = await captureScreenshot();
    if ('error' in result) {
      showAlert('Capture failed', result.error === 'unavailable' ? 'Capture unavailable' : 'Capture failed');
      return;
    }
    const uri = result.uri;
    const apiUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';
    if (!apiUrl) {
      showAlert('Submit failed', 'Set EXPO_PUBLIC_BACKEND_URL in .env and restart Expo.');
      return;
    }
    const extra: Record<string, string> = isDefault
      ? { is_sample: 'true', sample_slug: 'high-school-algebra-01' }
      : {};
    const formData = await buildAnalysisFormData(uri, extra);
    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/analyze-solution`, { method: 'POST', body: formData });
      const body = await res.json();
      if (res.ok) {
        const count = body.mistake_count ?? 0;
        showAlert('Analysis Complete', count === 0 ? 'No mistakes found!' : `Found ${count} mistake${count !== 1 ? 's' : ''}.`);
      } else {
        showAlert('Analysis failed', body.error ?? 'Unable to analyze work.');
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (isNetworkError(err)) {
        showAlert(
          'Submit failed',
          Platform.OS === 'android'
            ? 'Cannot reach server. On Android emulator use EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:8000 in .env'
            : 'Check that the Flask server is running (python get_coords.py) and .env has EXPO_PUBLIC_BACKEND_URL. Restart Expo after changing .env.',
        );
      } else {
        showAlert('Submit failed', 'Check that the Flask server is running.');
      }
    }
  }, [isProblemMode, triggerNow, captureScreenshot, isDefault]);

  // --- Chat panel ---
  const handleAskAboutMistake = useCallback(
    (_mistake: Mistake) => {
      if (!currentProblem || !assignmentIdForChat) return;
      setChatProblemNum(currentProblem.num);
      setChatVisible(true);
    },
    [currentProblem, assignmentIdForChat],
  );

  const handleOpenChat = useCallback(() => {
    if (!currentProblem || !assignmentIdForChat) return;
    setChatProblemNum(currentProblem.num);
    setChatVisible(true);
  }, [currentProblem, assignmentIdForChat]);

  const handleCloseChat = useCallback(() => setChatVisible(false), []);

  const backAction = (
    <Pressable
      style={({ pressed }) => [styles.backButtonTextWrap, pressed && { opacity: 0.7 }]}
      onPress={() => router.back()}>
      <Text style={styles.backButtonText}>{backLabel}</Text>
    </Pressable>
  );

  if (!id) {
    return (
      <SafeAreaView style={styles.screen}>
        <CenteredMessage message={<Text style={styles.errorText}>Missing document ID</Text>} action={backAction} />
      </SafeAreaView>
    );
  }

  if (assignmentOnly) {
    if (assignmentLoading) {
      return (
        <SafeAreaView style={styles.screen}>
          <CenteredMessage
            message={
              <>
                <ActivityIndicator size="large" color={palette.primary} />
                <Text style={styles.loadingText}>Loading assignment…</Text>
              </>
            }
            action={backAction}
          />
        </SafeAreaView>
      );
    }
    if (assignmentError || !assignment) {
      return (
        <SafeAreaView style={styles.screen}>
          <CenteredMessage
            message={<Text style={styles.errorText}>{assignmentError ?? 'Assignment not found'}</Text>}
            action={backAction}
          />
        </SafeAreaView>
      );
    }
  } else {
    if (docsLoading || !doc) {
      if (docsLoading) {
        return (
          <SafeAreaView style={styles.screen}>
            <CenteredMessage
              message={
                <>
                  <ActivityIndicator size="large" color={palette.primary} />
                  <Text style={styles.loadingText}>Loading…</Text>
                </>
              }
            />
          </SafeAreaView>
        );
      }
      return (
        <SafeAreaView style={styles.screen}>
          <CenteredMessage message={<Text style={styles.errorText}>Document not found</Text>} action={backAction} />
        </SafeAreaView>
      );
    }
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.screen}>
        <CenteredMessage message={<Text style={styles.errorText}>{loadError}</Text>} action={backAction} />
      </SafeAreaView>
    );
  }

  if (!assignmentOnly && !isProblemMode && !isDefault && !pdfBase64) {
    return (
      <SafeAreaView style={styles.screen}>
        <CenteredMessage
          message={
            <>
              <ActivityIndicator size="large" color={palette.primary} />
              <Text style={styles.loadingText}>Loading PDF…</Text>
            </>
          }
        />
      </SafeAreaView>
    );
  }

  // --- Main render ---
  const pageLabel = isProblemMode ? `Problem ${currentPage} of ${totalPages}` : `${currentPage} / ${totalPages}`;

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.headerBackBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <MaterialCommunityIcons name="arrow-left" size={24} color={palette.primary} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{headerTitle}</Text>
        <Pressable
          style={({ pressed }) => [styles.checkButton, pressed && { opacity: 0.7 }]}
          onPress={handleCheckWork}
          disabled={isAnalyzing}
          accessibilityRole="button"
          accessibilityLabel="Check my work">
          {isAnalyzing ? (
            <ActivityIndicator size="small" color={palette.white} />
          ) : (
            <Text style={styles.checkButtonText}>Check</Text>
          )}
        </Pressable>
      </View>

      {/* Problem header (per-problem mode) */}
      {isProblemMode && currentProblem && (
        <View style={styles.problemHeaderWrap}>
          <ProblemHeader problemNum={currentProblem.num} statementTex={currentProblem.statement_tex} />
        </View>
      )}

      {/* Analyzing indicator */}
      {isAnalyzing && (
        <View style={styles.analyzingBar}>
          <ActivityIndicator size="small" color={palette.textMuted} />
          <Text style={styles.analyzingText}>Analyzing...</Text>
        </View>
      )}

      {/* Capture / analysis error status */}
      {analysisError !== null && !isAnalyzing && (
        <View style={styles.analyzingBar}>
          <MaterialCommunityIcons name="alert-outline" size={18} color={palette.textMuted} />
          <Text style={styles.analyzingText}>{analysisError}</Text>
        </View>
      )}

      {/* Stroke / docs persistence errors (non-blocking) */}
      {(strokeLoadError || strokeSaveError || docsLoadError || docsSaveError) && (
        <View style={styles.strokeErrorBar}>
          <MaterialCommunityIcons name="alert-outline" size={18} color={palette.errorText} />
          <Text style={styles.strokeErrorText}>
            {strokeLoadError ?? docsLoadError ?? docsSaveError ?? (strokeSaveError ? "Couldn't save strokes." : '')}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.strokeErrorDismiss, pressed && { opacity: 0.7 }]}
            onPress={() => {
              setStrokeLoadError(null);
              setStrokeSaveError(false);
              clearDocsLoadError();
              clearDocsSaveError();
            }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss">
            <Text style={styles.strokeErrorDismissText}>Dismiss</Text>
          </Pressable>
        </View>
      )}

      {/* Page navigation */}
      <View style={styles.pagerBar}>
        <Pressable
          style={({ pressed }) => [styles.pageBtn, currentPage <= 1 && styles.pageBtnDisabled, currentPage > 1 && pressed && { opacity: 0.7 }]}
          onPress={goPrev}
          disabled={currentPage <= 1}
          accessibilityRole="button"
          accessibilityLabel="Previous">
          <MaterialCommunityIcons name="chevron-left" size={28} color={currentPage <= 1 ? palette.textDisabled : palette.primary} />
        </Pressable>
        <Text style={styles.pageText}>{pageLabel}</Text>
        <Pressable
          style={({ pressed }) => [styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled, currentPage < totalPages && pressed && { opacity: 0.7 }]}
          onPress={goNext}
          disabled={currentPage >= totalPages}
          accessibilityRole="button"
          accessibilityLabel="Next">
          <MaterialCommunityIcons name="chevron-right" size={28} color={currentPage >= totalPages ? palette.textDisabled : palette.primary} />
        </Pressable>
      </View>

      {/* Page thumbnails */}
      {totalPages > 1 && (
        <View style={styles.pageStrip}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Pressable
              key={p}
              style={({ pressed }) => [styles.pageThumb, currentPage === p && styles.pageThumbActive, currentPage !== p && pressed && { opacity: 0.7 }]}
              onPress={() => goToPage(p)}
              accessibilityRole="button"
              accessibilityLabel={isProblemMode ? `Problem ${p}` : `Page ${p}`}>
              <Text style={[styles.pageThumbText, currentPage === p && styles.pageThumbTextActive]}>{p}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Canvas + overlay */}
      <CanvasView
        isProblemMode={isProblemMode}
        isDefault={isDefault}
        webViewRef={webViewRef}
        handleWebViewLoad={handleWebViewLoad}
        handleMessage={handleMessage}
        pageIndex={pageIndex}
        viewShotRef={viewShotRef}
        currentStrokes={currentStrokes}
        onStrokesChange={handleStrokesChange}
        currentMistakes={currentMistakes}
        revealMode={revealMode}
        onAskAboutMistake={handleAskAboutMistake}
        onCanvasLayout={(w, h) => setCanvasDims({ w, h })}
      />

      {/* Chat FAB — visible in problem mode when chat is closed */}
      {isProblemMode && !chatVisible && (
        <Pressable
          style={({ pressed }) => [styles.chatFab, pressed && { opacity: 0.8 }]}
          onPress={handleOpenChat}
          accessibilityRole="button"
          accessibilityLabel="Open chat"
        >
          <MaterialCommunityIcons name="chat-outline" size={24} color={palette.white} />
        </Pressable>
      )}

      {/* Chat panel */}
      <ChatPanel
        visible={chatVisible}
        onClose={handleCloseChat}
        assignmentId={assignmentIdForChat}
        problemNum={chatProblemNum}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  headerBackBtn: {
    padding: 8,
    marginRight: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  checkButton: {
    minWidth: 72,
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  checkButtonText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '700',
  },
  problemHeaderWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  analyzingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  analyzingText: {
    fontSize: 13,
    color: palette.textMuted,
  },
  strokeErrorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: palette.errorBg,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  strokeErrorText: {
    flex: 1,
    fontSize: 13,
    color: palette.errorText,
  },
  strokeErrorDismiss: { paddingVertical: 4, paddingHorizontal: 8 },
  strokeErrorDismissText: { fontSize: 13, fontWeight: '600', color: palette.primary },
  pagerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    gap: 16,
  },
  pageBtn: { padding: 4 },
  pageBtnDisabled: { opacity: 0.6 },
  pageText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.textSecondary,
    minWidth: 120,
    textAlign: 'center',
  },
  pageStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    justifyContent: 'center',
  },
  pageThumb: {
    width: 32,
    height: 32,
    borderRadius: radius.thumb,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageThumbActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  pageThumbText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  pageThumbTextActive: {
    color: palette.white,
  },
  contentWrap: {
    flex: 1,
    padding: 12,
    gap: 8,
    position: 'relative',
  },
  canvasFull: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  webPdfPlaceholder: {
    justifyContent: 'center',
    padding: 24,
  },
  webPdfPlaceholderText: {
    fontSize: 15,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  inkOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: 12,
    left: 12,
    right: 12,
    bottom: 12,
  },
  inkCanvas: { flex: 1 },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: palette.textMuted,
  },
  errorText: {
    fontSize: 16,
    color: palette.textSecondary,
    textAlign: 'center',
  },
  backButtonTextWrap: {},
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: palette.primary,
    borderRadius: radius.button,
  },
  retryButtonText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '600',
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.primary,
  },
  chatFab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 50,
  },
});
