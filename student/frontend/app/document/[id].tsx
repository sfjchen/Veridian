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
import { StatusBadge, type StatusTone } from '@/components/notifications/StatusBadge';
import { ToastHost, type ToastNotice } from '@/components/notifications/ToastHost';
import { ProblemHeader } from '@/components/ProblemHeader';
import { SampleAlgebraContent } from '@/components/SampleAlgebraContent';
import { palette, radius } from "@/constants/palette";
import { spacing } from "@/constants/spacing";
import { useAssignment } from '@/hooks/useAssignment';
import { useAutoAnalysis } from '@/hooks/useAutoAnalysis';
import { useAccessToken } from '@/hooks/useAccessToken';
import { useAuth } from '@/hooks/useAuth';
import { useDocuments, isDefaultDocument } from '@/hooks/useDocuments';
import { useWebSocket, type ResultPayload } from '@/hooks/useWebSocket';
import { scopedKey } from '@/lib/scoped-storage';
import { submitAnalysis, submitAssignment, type AnalysisResult, type Mistake } from '@/lib/api';
import type { CaptureResult } from '@/lib/capture-types';
import { captureStrokesAsDataUri } from '@/lib/capture-web';
import { PDF_VIEWER_HTML } from '@/lib/pdf-viewer-html';
import { SAMPLE_ALGEBRA_HTML } from '@/lib/sample-algebra-html';
import {
  DEFAULT_RESOLVED_CONFIG,
  type AnalysisTrigger,
  type DotThreshold,
} from '@/lib/teacherConfig';

const SAMPLE_PROBLEMS = [
  { num: 1, statement_tex: '2x + 5 = 13' },
  { num: 2, statement_tex: '3(x - 4) = 15' },
  { num: 3, statement_tex: '4x + 2 - 3x + 7' },
  { num: 4, statement_tex: 'x/2 + 3 = 8' },
  { num: 5, statement_tex: 'x + y = 10,\\; 2x - y = 2' },
  { num: 6, statement_tex: '\\int_0^3 (2x + 1)\\, dx' },
];

type BadgeState = { label: string; tone: StatusTone };

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
  dotThreshold: DotThreshold;
  maxDotsShown: number;
  onAskAboutMistake?: (mistake: Mistake) => void;
  onCanvasLayout?: (width: number, height: number) => void;
};

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function analysisSummaryText(result: AnalysisResult): string {
  const count = result.mistake_count ?? result.mistakes?.length ?? 0;
  if (count === 0) return 'No mistakes found.';
  return `Found ${count} mistake${count === 1 ? '' : 's'}.`;
}

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
  dotThreshold,
  maxDotsShown,
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
            dotThreshold={dotThreshold}
            maxDotsShown={maxDotsShown}
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
  const token = useAccessToken() ?? undefined;
  const { userId } = useAuth();
  const {
    getDocument,
    loading: docsLoading,
    loadError: docsLoadError,
    saveError: docsSaveError,
    clearLoadError: clearDocsLoadError,
    clearSaveError: clearDocsSaveError,
  } = useDocuments(userId);
  const doc = id ? getDocument(id) : undefined;

  const assignmentOnly = !!assignmentId;
  const {
    assignment,
    problems: assignmentProblems,
    resolvedConfig,
    loading: assignmentLoading,
    error: assignmentError,
  } = useAssignment(assignmentId);

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
    : 'Back';

  const config = useMemo(
    () => resolvedConfig ?? DEFAULT_RESOLVED_CONFIG,
    [resolvedConfig],
  );
  const analysisTrigger = config.analysis_trigger as AnalysisTrigger;
  const checkButtonVisible = config.check_button_visible && analysisTrigger !== 'passive';
  const chatEnabled = config.chat_enabled;
  const revealMode = assignment?.reveal_mode ?? 'single-tap';

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
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const [badgeState, setBadgeState] = useState<BadgeState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const webViewRef = useRef<WebView | null>(null);
  const webViewReadyRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewShotRef = useRef<ViewShot | null>(null);
  const [canvasDims, setCanvasDims] = useState<{ w: number; h: number } | null>(null);

  const handleWebSocketResult = useCallback((data: ResultPayload) => {
    if (data.problem_num != null && data.assignment_id === assignmentId) {
      setResultsByProblem((prev) => ({
        ...prev,
        [data.problem_num]: {
          student_tex: '',
          annotated_tex: '',
          continuation_tex: '',
          mistake_count: data.mistake_count,
          mistakes: data.mistakes,
          problem_num: data.problem_num,
          assignment_id: data.assignment_id,
        },
      }));
    }
  }, [assignmentId]);

  const WS_URL = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
  useWebSocket(WS_URL, token ?? null, handleWebSocketResult);

  const STROKES_KEY = (id && userId) ? scopedKey(userId, `veridian_strokes:${id}`) : null;
  const pageIndex = currentPage - 1;
  const currentStrokes = useMemo(() => strokesByPage[pageIndex] ?? [], [strokesByPage, pageIndex]);
  const currentProblem = isProblemMode ? problems[pageIndex] : null;
  const currentMistakes: Mistake[] = currentProblem
    ? resultsByProblem[currentProblem.num]?.mistakes ?? []
    : [];

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const pushToast = useCallback((message: string, tone: ToastNotice['tone']) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToast({ id, message, tone });
  }, []);

  const notifySuccess = useCallback(
    (message: string) => {
      if (config.notification_style === 'silent') return;
      if (config.notification_style === 'toast') {
        pushToast(message, 'success');
        return;
      }
      setBadgeState({ label: message, tone: 'success' });
    },
    [config.notification_style, pushToast],
  );

  const notifyError = useCallback(
    (message: string) => {
      showAlert('Analysis failed', message);
    },
    [],
  );

  useEffect(() => {
    if (isProblemMode) setTotalPages(problems.length);
  }, [isProblemMode, problems.length]);

  const setCurrentStrokes = useCallback(
    (strokes: Stroke[]) => {
      setStrokesByPage((prev) => ({ ...prev, [pageIndex]: strokes }));
    },
    [pageIndex],
  );

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
          setStrokeLoadError(e instanceof Error ? e.message : 'Failed to load saved strokes');
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
      AsyncStorage.setItem(STROKES_KEY, JSON.stringify(strokesByPage)).catch((error: unknown) => {
        console.error('Failed to save strokes', error);
        setStrokeSaveError(true);
      }).finally(done);
    }, 500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [STROKES_KEY, strokesLoaded, strokesByPage]);

  useEffect(() => {
    if (!doc) return;
    if (isDefault || isProblemMode) {
      setPdfBase64('default');
      return;
    }
    if (!doc.uri) return;
    if (Platform.OS === 'web') {
      setPdfBase64('default');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(doc.uri);
        if (!info.exists) {
          if (!cancelled) setLoadError('PDF file not found. It may have been removed by the system. Try uploading it again.');
          return;
        }
        const base64 = await FileSystem.readAsStringAsync(doc.uri, {
          encoding: (FileSystem.EncodingType?.Base64 ?? 'base64') as 'base64',
        });
        if (!cancelled) setPdfBase64(base64);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to read PDF');
      }
    })();
    return () => { cancelled = true; };
  }, [doc, isDefault, isProblemMode]);

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

  const captureScreenshot = useCallback(async (): Promise<CaptureResult> => {
    if (Platform.OS === 'web') {
      if (!canvasDims) return { error: 'unavailable' };
      try {
        const uri = captureStrokesAsDataUri(currentStrokes, canvasDims.w, canvasDims.h);
        return { uri };
      } catch {
        return { error: 'failed' };
      }
    }
    const viewShot = viewShotRef.current;
    if (!viewShot || typeof viewShot.capture !== 'function') return { error: 'unavailable' };
    try {
      const uri = await viewShot.capture();
      if (!uri) return { error: 'failed' };
      return { uri };
    } catch {
      return { error: 'failed' };
    }
  }, [canvasDims, currentStrokes]);

  const onStaleResult = useCallback((result: AnalysisResult) => {
    if (result.problem_num == null) return;
    setResultsByProblem((prev) => ({ ...prev, [result.problem_num!]: result }));
  }, []);

  const {
    isAnalyzing,
    lastResult,
    error: analysisError,
    clearError: clearAnalysisError,
    triggerNow,
    triggerOnPageChange,
    markDirty,
  } = useAutoAnalysis({
    assignmentId: assignmentId ?? undefined,
    problemNum: currentProblem?.num,
    isSample: isDefault,
    token,
    debounceMs: config.analysis_debounce_seconds * 1000,
    enabled: isProblemMode && !!canvasDims,
    mode: analysisTrigger,
    captureScreenshot,
    onError: (msg) => notifyError(msg),
    onStaleResult,
  });

  const badgeStatus = useMemo(() => {
    if (config.notification_style !== 'badge') return null;
    if (analysisTrigger === 'passive') {
      return { label: 'Passive mode', tone: 'info' as const };
    }
    if (isAnalyzing) {
      return { label: 'Analyzing…', tone: 'info' as const };
    }
    if (analysisError) {
      return { label: analysisError, tone: 'error' as const };
    }
    if (badgeState) return badgeState;
    return null;
  }, [config.notification_style, analysisTrigger, isAnalyzing, analysisError, badgeState]);

  useEffect(() => {
    setCanvasDims(null);
    clearAnalysisError();
    setBadgeState(null);
  }, [pageIndex, clearAnalysisError]);

  useEffect(() => {
    if (!lastResult || lastResult.problem_num == null) return;
    setResultsByProblem((prev) => ({ ...prev, [lastResult.problem_num!]: lastResult }));
    if (currentProblem?.num === lastResult.problem_num) {
      notifySuccess(analysisSummaryText(lastResult));
    }
  }, [lastResult, currentProblem?.num, notifySuccess]);

  useEffect(() => {
    if (!chatEnabled && chatVisible) setChatVisible(false);
  }, [chatEnabled, chatVisible]);

  const handleStrokesChange = useCallback(
    (strokes: Stroke[]) => {
      setCurrentStrokes(strokes);
      markDirty();
    },
    [setCurrentStrokes, markDirty],
  );

  const changePage = useCallback(
    (nextPage: number) => {
      const clamped = Math.max(1, Math.min(totalPages, nextPage));
      if (clamped === currentPage) return;
      if (analysisTrigger === 'auto_page_change') {
        triggerOnPageChange();
      }
      setCurrentPage(clamped);
    },
    [totalPages, currentPage, analysisTrigger, triggerOnPageChange],
  );

  const goPrev = useCallback(() => {
    changePage(currentPage - 1);
  }, [changePage, currentPage]);

  const goNext = useCallback(() => {
    changePage(currentPage + 1);
  }, [changePage, currentPage]);

  const goToPage = useCallback((page: number) => {
    changePage(page);
  }, [changePage]);

  const handleCheckWork = useCallback(async () => {
    if (isProblemMode) {
      if (analysisTrigger === 'passive') return;
      triggerNow();
      return;
    }

    const result = await captureScreenshot();
    if ('error' in result) {
      showAlert('Capture failed', result.error === 'unavailable' ? 'Capture unavailable' : 'Capture failed');
      return;
    }

    const uri = result.uri;
    try {
      const body = await submitAnalysis(uri, {
        isSample: isDefault,
        sampleSlug: isDefault ? 'high-school-algebra-01' : undefined,
        token,
      });
      const count = body.mistake_count ?? 0;
      showAlert('Analysis Complete', count === 0 ? 'No mistakes found!' : `Found ${count} mistake${count !== 1 ? 's' : ''}.`);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      showAlert('Analysis failed', err.message);
    }
  }, [isProblemMode, analysisTrigger, triggerNow, captureScreenshot, isDefault, token]);

  const handleAskAboutMistake = useCallback(
    (_mistake: Mistake) => {
      if (!chatEnabled || !currentProblem || !assignmentIdForChat) return;
      setChatProblemNum(currentProblem.num);
      setChatVisible(true);
    },
    [chatEnabled, currentProblem, assignmentIdForChat],
  );

  const handleOpenChat = useCallback(() => {
    if (!chatEnabled || !currentProblem || !assignmentIdForChat) return;
    setChatProblemNum(currentProblem.num);
    setChatVisible(true);
  }, [chatEnabled, currentProblem, assignmentIdForChat]);

  const handleCloseChat = useCallback(() => setChatVisible(false), []);

  const handleSubmit = useCallback(() => {
    if (!assignmentId || isSubmitted) return;
    Alert.alert(
      'Submit Assignment',
      'Are you sure you want to submit this assignment? You can still access it after submission.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await submitAssignment(assignmentId, token);
              setIsSubmitted(true);
              pushToast('Assignment submitted successfully', 'success');
            } catch (e) {
              const err = e instanceof Error ? e : new Error(String(e));
              showAlert('Submission failed', err.message);
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ],
    );
  }, [assignmentId, isSubmitted, token, pushToast]);

  const backAction = (
    <Pressable
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
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

  const pageLabel = isProblemMode ? `Problem ${currentPage} of ${totalPages}` : `${currentPage} / ${totalPages}`;

  return (
    <SafeAreaView style={styles.screen}>
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
        <View style={styles.headerActions}>
          {checkButtonVisible && (
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
          )}
          {assignmentId && (
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                isSubmitted && styles.submitButtonSubmitted,
                pressed && !isSubmitted && { opacity: 0.7 },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || isSubmitted}
              accessibilityRole="button"
              accessibilityLabel={isSubmitted ? 'Submitted' : 'Submit assignment'}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color={palette.white} />
              ) : (
                <Text style={[styles.submitButtonText, isSubmitted && styles.submitButtonTextSubmitted]}>
                  {isSubmitted ? 'Submitted' : 'Submit'}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </View>

      {isProblemMode && currentProblem && (
        <View style={styles.problemHeaderWrap}>
          <ProblemHeader problemNum={currentProblem.num} statementTex={currentProblem.statement_tex} />
        </View>
      )}

      {badgeStatus && (
        <View style={styles.badgeBar}>
          <StatusBadge label={badgeStatus.label} tone={badgeStatus.tone} />
        </View>
      )}

      {analysisError !== null && !isAnalyzing && (
        <View style={styles.analyzingBar}>
          <MaterialCommunityIcons name="alert-outline" size={18} color={palette.textMuted} />
          <Text style={styles.analyzingText}>{analysisError}</Text>
        </View>
      )}

      {(strokeLoadError || strokeSaveError || docsLoadError || docsSaveError) && (
        <View style={styles.strokeErrorBar}>
          <MaterialCommunityIcons name="alert-outline" size={18} color={palette.error} />
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
        dotThreshold={config.dot_threshold}
        maxDotsShown={config.max_dots_shown}
        onAskAboutMistake={chatEnabled ? handleAskAboutMistake : undefined}
        onCanvasLayout={(w, h) => setCanvasDims({ w, h })}
      />

      {isProblemMode && chatEnabled && !chatVisible && (
        <Pressable
          style={({ pressed }) => [styles.chatFab, pressed && { opacity: 0.8 }]}
          onPress={handleOpenChat}
          accessibilityRole="button"
          accessibilityLabel="Open chat"
        >
          <MaterialCommunityIcons name="chat-outline" size={24} color={palette.white} />
        </Pressable>
      )}

      <ChatPanel
        visible={chatVisible && chatEnabled}
        onClose={handleCloseChat}
        assignmentId={assignmentIdForChat}
        problemNum={chatProblemNum}
      />

      {config.notification_style === 'toast' && (
        <ToastHost toast={toast} onHide={hideToast} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  headerBackBtn: {
    padding: spacing.xs,
    marginRight: spacing.xs,
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: palette.textPrimary,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
  },
  checkButton: {
    minWidth: 72,
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  checkButtonText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: "700",
  },
  submitButton: {
    minWidth: 80,
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  submitButtonSubmitted: {
    backgroundColor: palette.success,
  },
  submitButtonText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: "700",
  },
  submitButtonTextSubmitted: {
    opacity: 0.9,
  },
  problemHeaderWrap: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  badgeBar: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  analyzingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  analyzingText: {
    fontSize: 13,
    color: palette.textMuted,
  },
  strokeErrorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    backgroundColor: palette.errorBg,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  strokeErrorText: {
    flex: 1,
    fontSize: 13,
    color: palette.error,
  },
  strokeErrorDismiss: { paddingVertical: spacing.xxs, paddingHorizontal: spacing.xs },
  strokeErrorDismissText: { fontSize: 13, fontWeight: "600", color: palette.primary },
  pagerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    gap: spacing.md,
  },
  pageBtn: { padding: spacing.xxs },
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
