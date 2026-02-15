import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';

import { ShortcutHint } from '@/components/ShortcutHint';
import { DOT_CURSOR } from '@/constants/cursor';
import { palette, radius } from "@/constants/palette";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";

export type Point = { x: number; y: number };

export type Stroke = {
  id: string;
  points: Point[];
};

export type Tool = 'pen' | 'eraser';

const ERASER_RADIUS = 16;
const PEN_WIDTH = 3;

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function pathFromPoints(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.01} ${p.y + 0.01}`;
  }
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

function deepCopyStrokes(strokes: Stroke[]): Stroke[] {
  return strokes.map((s) => ({ id: s.id, points: s.points.map((p) => ({ x: p.x, y: p.y })) }));
}

export type InkCanvasProps = {
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[]) => void;
  onStrokeComplete?: (strokes: Stroke[], completedStrokeId: string) => void;
  style?: object;
  showToolbar?: boolean;
  showAcceptButton?: boolean;
  onAccept?: () => void;
  viewShotRef?: React.RefObject<ViewShot | null>;
  onCanvasLayout?: (width: number, height: number) => void;
  /** Called when a new undoable stroke/erase action is recorded. */
  onStrokeAction?: () => void;
  /** Return true to intercept undo (parent handled it). */
  beforeUndo?: () => boolean;
  /** Return true to intercept redo (parent handled it). */
  beforeRedo?: () => boolean;
  /** External undoable state exists (keeps undo button enabled). */
  hasExternalUndo?: boolean;
  /** External redoable state exists (keeps redo button enabled). */
  hasExternalRedo?: boolean;
  /** Background color for the ViewShot capture (e.g. white for OCR). */
  canvasBackground?: string;
};

export type ViewShotRef = React.RefObject<ViewShot | null>;

export function InkCanvas({
  strokes,
  onStrokesChange,
  onStrokeComplete,
  style,
  showToolbar = true,
  showAcceptButton,
  onAccept,
  viewShotRef: externalViewShotRef,
  onCanvasLayout,
  onStrokeAction,
  beforeUndo,
  beforeRedo,
  hasExternalUndo,
  hasExternalRedo,
  canvasBackground,
}: InkCanvasProps) {
  const [tool, setTool] = useState<Tool>('pen');
  const [markedForErase, setMarkedForErase] = useState<Set<string>>(new Set());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const activeStrokeIdRef = useRef<string | null>(null);
  const shiftHeldRef = useRef(false);
  const handlersRef = useRef({ handleUndo: () => {}, handleRedo: () => {}, commitErase: () => {} });
  const externalRef = useRef({ onStrokeAction, beforeUndo, beforeRedo });
  externalRef.current = { onStrokeAction, beforeUndo, beforeRedo };
  const internalViewShotRef = useRef<ViewShot | null>(null);
  const viewShotRef = externalViewShotRef ?? internalViewShotRef;
  const strokesRef = useRef<Stroke[]>(strokes);
  const markedForEraseRef = useRef<Set<string>>(new Set());
  const historyRef = useRef<Stroke[][]>([]);
  const redoRef = useRef<Stroke[][]>([]);
  strokesRef.current = strokes;

  const pushHistory = () => {
    historyRef.current = [...historyRef.current, deepCopyStrokes(strokesRef.current)];
    redoRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
    externalRef.current.onStrokeAction?.();
  };

  const handleUndo = () => {
    if (externalRef.current.beforeUndo?.()) return;
    if (historyRef.current.length === 0) return;
    redoRef.current = [...redoRef.current, deepCopyStrokes(strokesRef.current)];
    const previous = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    strokesRef.current = previous;
    onStrokesChange(previous);
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
  };

  const handleRedo = () => {
    if (externalRef.current.beforeRedo?.()) return;
    if (redoRef.current.length === 0) return;
    historyRef.current = [...historyRef.current, deepCopyStrokes(strokesRef.current)];
    const next = redoRef.current[redoRef.current.length - 1];
    redoRef.current = redoRef.current.slice(0, -1);
    strokesRef.current = next;
    onStrokesChange(next);
    setCanUndo(true);
    setCanRedo(redoRef.current.length > 0);
  };

  const markEraseAtPoint = (point: Point) => {
    setMarkedForErase((prev) => {
      const hitIds = strokesRef.current
        .filter((stroke) =>
          stroke.points.some((sp) => distance(sp, point) <= ERASER_RADIUS)
        )
        .map((s) => s.id);
      if (hitIds.length === 0) return prev;
      const next = new Set(prev);
      for (const id of hitIds) next.add(id);
      markedForEraseRef.current = next;
      return next;
    });
  };

  const commitErase = () => {
    const toErase = markedForEraseRef.current;
    if (toErase.size === 0) return;
    const nextStrokes = strokesRef.current.filter((s) => !toErase.has(s.id));
    strokesRef.current = nextStrokes;
    onStrokesChange(nextStrokes);
    markedForEraseRef.current = new Set();
    setMarkedForErase(new Set());
  };

  handlersRef.current = { handleUndo, handleRedo, commitErase };

  const extractPoint = (event: GestureResponderEvent): Point => ({
    x: event.nativeEvent.locationX,
    y: event.nativeEvent.locationY,
  });

  const handleTouchStart = (event: GestureResponderEvent) => {
    const point = extractPoint(event);
    if (Platform.OS === 'web' && shiftHeldRef.current && (tool === 'pen' || tool === 'eraser')) return;
    if (tool === 'eraser') {
      pushHistory();
      setMarkedForErase(new Set());
      markEraseAtPoint(point);
      return;
    }
    pushHistory();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeStrokeIdRef.current = id;
    const nextStrokes = [...strokesRef.current, { id, points: [point] }];
    strokesRef.current = nextStrokes;
    onStrokesChange(nextStrokes);
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    const point = extractPoint(event);
    if (tool === 'eraser') {
      markEraseAtPoint(point);
      return;
    }
    const activeId = activeStrokeIdRef.current;
    if (!activeId) return;
    const nextStrokes = strokesRef.current.map((stroke) =>
      stroke.id === activeId ? { ...stroke, points: [...stroke.points, point] } : stroke
    );
    strokesRef.current = nextStrokes;
    onStrokesChange(nextStrokes);
  };

  const handleTouchEnd = () => {
    if (tool === 'eraser') {
      commitErase();
      return;
    }
    const completedId = activeStrokeIdRef.current;
    activeStrokeIdRef.current = null;
    if (completedId) {
      onStrokeComplete?.(strokesRef.current, completedId);
    }
  };

  const handleClear = () => {
    pushHistory();
    strokesRef.current = [];
    onStrokesChange([]);
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftHeldRef.current = true;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setTool('pen');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setTool('eraser');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handlersRef.current.handleRedo();
        else handlersRef.current.handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handlersRef.current.handleRedo();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftHeldRef.current = false;
        if (tool === 'eraser') {
          handlersRef.current.commitErase();
        } else if (activeStrokeIdRef.current) {
          const completedId = activeStrokeIdRef.current;
          activeStrokeIdRef.current = null;
          onStrokeComplete?.(strokesRef.current, completedId);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [tool]);

  const handleWebMouseMove = (e: { nativeEvent: { clientX: number; clientY: number; target?: HTMLElement } }) => {
    if (Platform.OS !== 'web' || !shiftHeldRef.current) return;
    const target = e.nativeEvent.target as HTMLElement | undefined;
    if (!target?.getBoundingClientRect) return;
    const rect = target.getBoundingClientRect();
    const x = e.nativeEvent.clientX - rect.left;
    const y = e.nativeEvent.clientY - rect.top;
    const point = { x, y };
    if (tool === 'eraser') {
      markEraseAtPoint(point);
      return;
    }
    const activeId = activeStrokeIdRef.current;
    if (!activeId) {
      pushHistory();
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      activeStrokeIdRef.current = id;
      const nextStrokes = [...strokesRef.current, { id, points: [point] }];
      strokesRef.current = nextStrokes;
      onStrokesChange(nextStrokes);
    } else {
      const nextStrokes = strokesRef.current.map((s) =>
        s.id === activeId ? { ...s, points: [...s.points, point] } : s
      );
      strokesRef.current = nextStrokes;
      onStrokesChange(nextStrokes);
    }
  };

  const handleWebMouseLeave = () => {
    if (Platform.OS !== 'web' || !shiftHeldRef.current) return;
    if (tool === 'eraser') {
      handlersRef.current.commitErase();
    } else if (activeStrokeIdRef.current) {
      const completedId = activeStrokeIdRef.current;
      activeStrokeIdRef.current = null;
      onStrokeComplete?.(strokesRef.current, completedId);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {showToolbar && (
        <View>
        <View style={styles.toolbar}>
          <Pressable
            style={({ pressed }) => [
              styles.toolIconButton,
              tool === 'pen' && styles.toolIconButtonActive,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => setTool('pen')}
            accessibilityRole="button"
            accessibilityLabel="Pen tool">
            <MaterialCommunityIcons
              name="pencil"
              size={20}
              color={tool === 'pen' ? palette.white : palette.primary}
            />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolIconButton,
              tool === 'eraser' && styles.toolIconButtonActive,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => setTool('eraser')}
            accessibilityRole="button"
            accessibilityLabel="Eraser tool">
            <MaterialCommunityIcons
              name="eraser"
              size={20}
              color={tool === 'eraser' ? palette.white : palette.primary}
            />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolIconButton,
              !(canUndo || hasExternalUndo) && styles.toolIconButtonDisabled,
              pressed && (canUndo || hasExternalUndo) && { opacity: 0.7 },
            ]}
            onPress={handleUndo}
            disabled={!(canUndo || hasExternalUndo)}
            accessibilityRole="button"
            accessibilityLabel="Undo">
            <MaterialCommunityIcons
              name="undo"
              size={20}
              color={(canUndo || hasExternalUndo) ? palette.primary : palette.textDisabled}
            />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolIconButton,
              !(canRedo || hasExternalRedo) && styles.toolIconButtonDisabled,
              pressed && (canRedo || hasExternalRedo) && { opacity: 0.7 },
            ]}
            onPress={handleRedo}
            disabled={!(canRedo || hasExternalRedo)}
            accessibilityRole="button"
            accessibilityLabel="Redo">
            <MaterialCommunityIcons
              name="redo"
              size={20}
              color={(canRedo || hasExternalRedo) ? palette.primary : palette.textDisabled}
            />
          </Pressable>
          <View style={styles.toolbarSpacer} />
          {showAcceptButton && onAccept && (
            <Pressable
              style={({ pressed }) => [styles.acceptButton, pressed && { opacity: 0.7 }]}
              onPress={onAccept}
              accessibilityRole="button"
              accessibilityLabel="Accept suggestion">
              <MaterialCommunityIcons name="check" size={16} color={palette.white} />
              <Text style={styles.acceptButtonText}>Accept</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.7 }]}
            onPress={handleClear}
            accessibilityRole="button"
            accessibilityLabel="Clear canvas">
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
        </View>
        <ShortcutHint />
        </View>
      )}
      <ViewShot
        ref={viewShotRef}
        style={[styles.canvasWrap, canvasBackground ? { backgroundColor: canvasBackground } : undefined]}
        options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
        <View
          style={[styles.touchLayer, Platform.OS === 'web' && styles.touchLayerWeb]}
          collapsable={false}
          onLayout={onCanvasLayout ? (e) => {
            const { width, height } = e.nativeEvent.layout;
            onCanvasLayout(width, height);
          } : undefined}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleTouchStart}
          onResponderMove={handleTouchMove}
          onResponderRelease={handleTouchEnd}
          onResponderTerminate={handleTouchEnd}
          {...(Platform.OS === 'web' && {
            onMouseMove: handleWebMouseMove,
            onMouseLeave: handleWebMouseLeave,
          })}
        >
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
            {strokes.map((stroke) => (
              <Path
                key={stroke.id}
                d={pathFromPoints(stroke.points)}
                stroke={palette.inkStroke}
                strokeWidth={PEN_WIDTH}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={markedForErase.has(stroke.id) ? 0.2 : 1}
              />
            ))}
          </Svg>
        </View>
      </ViewShot>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.xs,
  },
  toolbar: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
  },
  toolIconButton: {
    backgroundColor: palette.card,
    width: 42,
    height: 42,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  toolIconButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  toolIconButtonDisabled: {
    opacity: 0.5,
  },
  toolbarSpacer: { flex: 1 },
  acceptButton: {
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    marginRight: spacing.xs,
  },
  acceptButtonText: {
    ...typography.caption,
    color: palette.textOnPrimary,
    fontWeight: "600",
  },
  clearButton: {
    backgroundColor: palette.card,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  clearButtonText: {
    ...typography.caption,
    color: palette.primary,
    fontWeight: "600",
  },
  canvasWrap: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  touchLayer: {
    flex: 1,
  },
  // RN ViewStyle.CursorValue omits custom url(); valid on web
  touchLayerWeb: { cursor: DOT_CURSOR } as unknown as ViewStyle,
});
