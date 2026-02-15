import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ChatPanel } from '../../student-view/components/ChatPanel';
import { InkCanvas, type Stroke } from '../../student-view/components/InkCanvas';
import { MistakeOverlay } from '../../student-view/components/MistakeOverlay';
import { ProblemHeader } from '../../student-view/components/ProblemHeader';
import { StatusBadge, type StatusTone } from '../../student-view/components/notifications/StatusBadge';
import { ToastHost, type ToastNotice } from '../../student-view/components/notifications/ToastHost';
import { palette, radius } from '../../student-view/constants/palette';
import { palette as teacherPalette } from '../../constants/palette';
import { useAutoAnalysis } from '../../student-view/hooks/useAutoAnalysis';
import type { CaptureResult } from '../../student-view/lib/capture-types';
import { captureStrokesAsDataUri } from '../../student-view/lib/capture-web';
import {
  fetchAssignment,
  fetchProblems,
  type AnalysisResult,
  type Assignment,
  type Mistake,
  type Problem,
} from '../../student-view/lib/studentApi';
import {
  DEFAULT_RESOLVED_CONFIG,
  normalizeResolvedConfig,
  type AnalysisTrigger,
} from '../../student-view/lib/teacherConfig';

type BadgeState = { label: string; tone: StatusTone };

function analysisSummaryText(result: AnalysisResult): string {
  const count = result.mistake_count ?? result.mistakes?.length ?? 0;
  if (count === 0) return 'No mistakes found.';
  return `Found ${count} mistake${count === 1 ? '' : 's'}.`;
}

export function StudentExperienceScreen({ route, navigation }: { route: any; navigation: any }) {
  const { assignmentId } = route.params as { assignmentId: string };

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [strokesByPage, setStrokesByPage] = useState<Record<number, Stroke[]>>({});
  const [resultsByProblem, setResultsByProblem] = useState<Record<number, AnalysisResult>>({});
  const [chatVisible, setChatVisible] = useState(false);
  const [chatProblemNum, setChatProblemNum] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const [badgeState, setBadgeState] = useState<BadgeState | null>(null);
  const [canvasDims, setCanvasDims] = useState<{ w: number; h: number } | null>(null);
  const viewShotRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, p] = await Promise.all([
          fetchAssignment(assignmentId),
          fetchProblems(assignmentId),
        ]);
        if (cancelled) return;
        setAssignment(a);
        setProblems(p);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [assignmentId]);

  const config = useMemo(
    () => assignment?.resolved_config
      ? normalizeResolvedConfig(assignment.resolved_config)
      : DEFAULT_RESOLVED_CONFIG,
    [assignment],
  );

  const analysisTrigger = config.analysis_trigger as AnalysisTrigger;
  const checkButtonVisible = config.check_button_visible && analysisTrigger !== 'passive';
  const chatEnabled = config.chat_enabled;
  const revealMode = assignment?.reveal_mode ?? ('single-tap' as const);
  const totalPages = problems.length;
  const pageIndex = currentPage - 1;
  const currentStrokes = useMemo(() => strokesByPage[pageIndex] ?? [], [strokesByPage, pageIndex]);
  const currentProblem = problems[pageIndex] ?? null;
  const currentMistakes: Mistake[] = currentProblem
    ? resultsByProblem[currentProblem.num]?.mistakes ?? []
    : [];

  const setCurrentStrokes = useCallback(
    (strokes: Stroke[]) => {
      setStrokesByPage((prev) => ({ ...prev, [pageIndex]: strokes }));
    },
    [pageIndex],
  );

  const hideToast = useCallback(() => setToast(null), []);

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

  const captureScreenshot = useCallback(async (): Promise<CaptureResult> => {
    if (Platform.OS === 'web') {
      if (!canvasDims) return { error: 'unavailable' };
      const hasStrokes = currentStrokes.some(s => s.points.length > 0);
      if (!hasStrokes) return { error: 'unavailable' };
      try {
        const uri = captureStrokesAsDataUri(currentStrokes, canvasDims.w, canvasDims.h);
        return { uri };
      } catch {
        return { error: 'failed' };
      }
    }
    try {
      const ref = viewShotRef.current as any;
      if (!ref?.capture) return { error: 'unavailable' };
      const uri: string = await ref.capture();
      return { uri };
    } catch {
      return { error: 'failed' };
    }
  }, [canvasDims, currentStrokes, viewShotRef]);

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
    assignmentId,
    problemNum: currentProblem?.num,
    debounceMs: config.analysis_debounce_seconds * 1000,
    enabled: problems.length > 0 && !!canvasDims,
    mode: analysisTrigger,
    captureScreenshot,
    onError: (msg) => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`Analysis failed\n\n${msg}`);
      }
    },
    onStaleResult,
  });

  const badgeStatus = useMemo(() => {
    if (config.notification_style !== 'badge') return null;
    if (analysisTrigger === 'passive') return { label: 'Passive mode', tone: 'info' as const };
    if (isAnalyzing) return { label: 'Analyzing...', tone: 'info' as const };
    if (analysisError) return { label: analysisError, tone: 'error' as const };
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
      if (analysisTrigger === 'auto_page_change') triggerOnPageChange();
      setCurrentPage(clamped);
    },
    [totalPages, currentPage, analysisTrigger, triggerOnPageChange],
  );

  const handleCheckWork = useCallback(() => {
    if (analysisTrigger === 'passive') return;
    triggerNow();
  }, [analysisTrigger, triggerNow]);

  const handleAskAboutMistake = useCallback(
    (_mistake: Mistake) => {
      if (!chatEnabled || !currentProblem) return;
      setChatProblemNum(currentProblem.num);
      setChatVisible(true);
    },
    [chatEnabled, currentProblem],
  );

  const handleOpenChat = useCallback(() => {
    if (!chatEnabled || !currentProblem) return;
    setChatProblemNum(currentProblem.num);
    setChatVisible(true);
  }, [chatEnabled, currentProblem]);

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>Loading assignment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !assignment) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Assignment not found'}</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (problems.length === 0) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.errorText}>This assignment has no problems configured yet.</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title={assignment.title} onBack={() => navigation.goBack()}
        checkVisible={checkButtonVisible} isAnalyzing={isAnalyzing} onCheck={handleCheckWork} />
      <View style={styles.previewBanner}>
        <Text style={styles.previewBannerText}>Teacher Preview</Text>
      </View>
      {currentProblem && (
        <View style={styles.problemHeaderWrap}>
          <ProblemHeader problemNum={currentProblem.num} statementTex={currentProblem.statement_tex} />
        </View>
      )}
      {assignment.assignment_file_download_url && (
        <Pressable
          style={({ pressed }) => [styles.assignmentFileBanner, pressed && { opacity: 0.7 }]}
          onPress={async () => {
            const url = assignment.assignment_file_download_url!;
            if (Platform.OS === 'web') {
              window.open(url, '_blank');
            } else {
              try {
                await Linking.openURL(url);
              } catch {
                Alert.alert('Could not open file', 'Unable to open the assignment file URL.');
              }
            }
          }}
          accessibilityRole="link"
          accessibilityLabel="View assignment file">
          <MaterialCommunityIcons name="file-document-outline" size={18} color={palette.primary} />
          <Text style={styles.assignmentFileBannerText}>View Assignment File</Text>
          <MaterialCommunityIcons name="open-in-new" size={16} color={palette.primary} />
        </Pressable>
      )}
      {badgeStatus && (
        <View style={styles.badgeBar}><StatusBadge label={badgeStatus.label} tone={badgeStatus.tone} /></View>
      )}
      <PagerBar currentPage={currentPage} totalPages={totalPages} onChangePage={changePage} />
      {totalPages > 1 && <PageStrip currentPage={currentPage} totalPages={totalPages} onChangePage={changePage} />}
      <CanvasArea pageIndex={pageIndex} viewShotRef={viewShotRef} strokes={currentStrokes}
        onStrokesChange={handleStrokesChange} onCanvasLayout={(w, h) => setCanvasDims({ w, h })}
        mistakes={currentMistakes} revealMode={revealMode} config={config}
        chatEnabled={chatEnabled} onAskAboutMistake={handleAskAboutMistake} />
      {chatEnabled && !chatVisible && <ChatFab onPress={handleOpenChat} />}
      <ChatPanel visible={chatVisible && chatEnabled} onClose={() => setChatVisible(false)}
        assignmentId={assignmentId} problemNum={chatProblemNum} />
      {config.notification_style === 'toast' && <ToastHost toast={toast} onHide={hideToast} />}
    </SafeAreaView>
  );
}

function ScreenHeader({ title, onBack, checkVisible, isAnalyzing, onCheck }: {
  title: string; onBack: () => void; checkVisible: boolean; isAnalyzing: boolean; onCheck: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable style={({ pressed }) => [styles.headerBackBtn, pressed && { opacity: 0.7 }]}
        onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button" accessibilityLabel="Back">
        <MaterialCommunityIcons name="arrow-left" size={24} color={palette.primary} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {checkVisible && (
        <Pressable style={({ pressed }) => [styles.checkButton, pressed && { opacity: 0.7 }]}
          onPress={onCheck} disabled={isAnalyzing} accessibilityRole="button" accessibilityLabel="Check my work">
          {isAnalyzing ? <ActivityIndicator size="small" color={palette.white} /> : <Text style={styles.checkButtonText}>Check</Text>}
        </Pressable>
      )}
    </View>
  );
}

function PagerBar({ currentPage, totalPages, onChangePage }: {
  currentPage: number; totalPages: number; onChangePage: (p: number) => void;
}) {
  return (
    <View style={styles.pagerBar}>
      <Pressable
        style={({ pressed }) => [styles.pageBtn, currentPage <= 1 && styles.pageBtnDisabled, currentPage > 1 && pressed && { opacity: 0.7 }]}
        onPress={() => onChangePage(currentPage - 1)} disabled={currentPage <= 1}
        accessibilityRole="button" accessibilityLabel="Previous">
        <MaterialCommunityIcons name="chevron-left" size={28} color={currentPage <= 1 ? palette.textDisabled : palette.primary} />
      </Pressable>
      <Text style={styles.pageText}>Problem {currentPage} of {totalPages}</Text>
      <Pressable
        style={({ pressed }) => [styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled, currentPage < totalPages && pressed && { opacity: 0.7 }]}
        onPress={() => onChangePage(currentPage + 1)} disabled={currentPage >= totalPages}
        accessibilityRole="button" accessibilityLabel="Next">
        <MaterialCommunityIcons name="chevron-right" size={28} color={currentPage >= totalPages ? palette.textDisabled : palette.primary} />
      </Pressable>
    </View>
  );
}

function PageStrip({ currentPage, totalPages, onChangePage }: {
  currentPage: number; totalPages: number; onChangePage: (p: number) => void;
}) {
  return (
    <View style={styles.pageStrip}>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <Pressable key={p}
          style={({ pressed }) => [styles.pageThumb, currentPage === p && styles.pageThumbActive, currentPage !== p && pressed && { opacity: 0.7 }]}
          onPress={() => onChangePage(p)} accessibilityRole="button" accessibilityLabel={`Problem ${p}`}>
          <Text style={[styles.pageThumbText, currentPage === p && styles.pageThumbTextActive]}>{p}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function CanvasArea({ pageIndex, viewShotRef, strokes, onStrokesChange, onCanvasLayout, mistakes, revealMode, config, chatEnabled, onAskAboutMistake }: {
  pageIndex: number; viewShotRef: React.RefObject<any>; strokes: Stroke[];
  onStrokesChange: (s: Stroke[]) => void; onCanvasLayout: (w: number, h: number) => void;
  mistakes: Mistake[]; revealMode: 'single-tap' | 'progressive'; config: any; chatEnabled: boolean; onAskAboutMistake: (m: Mistake) => void;
}) {
  return (
    <View style={styles.contentWrap}>
      <View style={styles.canvasFull}>
        <InkCanvas key={pageIndex} viewShotRef={viewShotRef} strokes={strokes}
          onStrokesChange={onStrokesChange} onCanvasLayout={onCanvasLayout} showToolbar style={styles.inkCanvas} />
        {mistakes.length > 0 && (
          <MistakeOverlay mistakes={mistakes} revealMode={revealMode}
            dotThreshold={config.dot_threshold} maxDotsShown={config.max_dots_shown}
            onAskAboutMistake={chatEnabled ? onAskAboutMistake : undefined} />
        )}
      </View>
    </View>
  );
}

function ChatFab({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.chatFab, pressed && { opacity: 0.8 }]}
      onPress={onPress} accessibilityRole="button" accessibilityLabel="Open chat">
      <MaterialCommunityIcons name="chat-outline" size={24} color={palette.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "rgba(255,255,255,0.68)" },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 15, color: palette.textMuted },
  errorText: { fontSize: 16, color: palette.textSecondary, textAlign: 'center' },
  backLink: { marginTop: 16 },
  backLinkText: { fontSize: 15, fontWeight: '600', color: palette.primary },
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
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: palette.textPrimary },
  checkButton: {
    minWidth: 72,
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  checkButtonText: { color: palette.white, fontSize: 14, fontWeight: '700' },
  previewBanner: {
    backgroundColor: teacherPalette.primaryMutedTint,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  previewBannerText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: teacherPalette.primary,
  },
  problemHeaderWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  assignmentFileBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  assignmentFileBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: palette.primary,
  },
  badgeBar: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
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
  pageThumbActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  pageThumbText: { fontSize: 13, fontWeight: '600', color: palette.textSecondary },
  pageThumbTextActive: { color: palette.white },
  contentWrap: { flex: 1, padding: 12, gap: 8, position: 'relative' },
  canvasFull: { flex: 1, position: 'relative' },
  inkCanvas: { flex: 1 },
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
