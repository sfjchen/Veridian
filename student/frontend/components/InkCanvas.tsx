import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';

import { ShortcutHint } from '@/components/ShortcutHint';
import { palette, radius } from '@/constants/palette';

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
  style?: object;
  showToolbar?: boolean;
  viewShotRef?: React.RefObject<ViewShot | null>;
  onCanvasLayout?: (width: number, height: number) => void;
};

export type ViewShotRef = React.RefObject<ViewShot | null>;

export function InkCanvas({
  strokes,
  onStrokesChange,
  style,
  showToolbar = true,
  viewShotRef: externalViewShotRef,
  onCanvasLayout,
}: InkCanvasProps) {
  const [tool, setTool] = useState<Tool>('pen');
  const [markedForErase, setMarkedForErase] = useState<Set<string>>(new Set());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const activeStrokeIdRef = useRef<string | null>(null);
  const shiftHeldRef = useRef(false);
  const handlersRef = useRef({ handleUndo: () => {}, handleRedo: () => {}, commitErase: () => {} });
  const internalViewShotRef = useRef<ViewShot | null>(null);
  const viewShotRef = externalViewShotRef ?? internalViewShotRef;
  const strokesRef = useRef<Stroke[]>(strokes);
  const historyRef = useRef<Stroke[][]>([]);
  const redoRef = useRef<Stroke[][]>([]);
  strokesRef.current = strokes;

  const pushHistory = () => {
    historyRef.current = [...historyRef.current, deepCopyStrokes(strokesRef.current)];
    redoRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };

  const handleUndo = () => {
    if (historyRef.current.length === 0) return;
    redoRef.current = [...redoRef.current, deepCopyStrokes(strokesRef.current)];
    const previous = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    onStrokesChange(previous);
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
  };

  const handleRedo = () => {
    if (redoRef.current.length === 0) return;
    historyRef.current = [...historyRef.current, deepCopyStrokes(strokesRef.current)];
    const next = redoRef.current[redoRef.current.length - 1];
    redoRef.current = redoRef.current.slice(0, -1);
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
      return next;
    });
  };

  const commitErase = () => {
    setMarkedForErase((prev) => {
      if (prev.size === 0) return prev;
      onStrokesChange(strokesRef.current.filter((s) => !prev.has(s.id)));
      return new Set();
    });
  };

  handlersRef.current = { handleUndo, handleRedo, commitErase };

  const extractPoint = (event: GestureResponderEvent): Point => ({
    x: event.nativeEvent.locationX,
    y: event.nativeEvent.locationY,
  });

  const handleTouchStart = (event: GestureResponderEvent) => {
    if (Platform.OS === 'web' && shiftHeldRef.current && (tool === 'pen' || tool === 'eraser')) return;
    const point = extractPoint(event);
    if (tool === 'eraser') {
      pushHistory();
      setMarkedForErase(new Set());
      markEraseAtPoint(point);
      return;
    }
    pushHistory();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeStrokeIdRef.current = id;
    onStrokesChange([...strokesRef.current, { id, points: [point] }]);
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    const point = extractPoint(event);
    if (tool === 'eraser') {
      markEraseAtPoint(point);
      return;
    }
    const activeId = activeStrokeIdRef.current;
    if (!activeId) return;
    onStrokesChange(
      strokesRef.current.map((stroke) =>
        stroke.id === activeId ? { ...stroke, points: [...stroke.points, point] } : stroke
      )
    );
  };

  const handleTouchEnd = () => {
    if (tool === 'eraser') {
      commitErase();
    }
    activeStrokeIdRef.current = null;
  };

  const handleClear = () => {
    pushHistory();
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
        if (tool === 'eraser') handlersRef.current.commitErase();
        else if (activeStrokeIdRef.current) activeStrokeIdRef.current = null;
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
      onStrokesChange([...strokesRef.current, { id, points: [point] }]);
    } else {
      onStrokesChange(
        strokesRef.current.map((s) =>
          s.id === activeId ? { ...s, points: [...s.points, point] } : s
        )
      );
    }
  };

  const handleWebMouseLeave = () => {
    if (Platform.OS !== 'web' || !shiftHeldRef.current) return;
    if (tool === 'eraser') handlersRef.current.commitErase();
    else if (activeStrokeIdRef.current) activeStrokeIdRef.current = null;
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
              !canUndo && styles.toolIconButtonDisabled,
              pressed && canUndo && { opacity: 0.7 },
            ]}
            onPress={handleUndo}
            disabled={!canUndo}
            accessibilityRole="button"
            accessibilityLabel="Undo">
            <MaterialCommunityIcons
              name="undo"
              size={20}
              color={canUndo ? palette.primary : palette.textDisabled}
            />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolIconButton,
              !canRedo && styles.toolIconButtonDisabled,
              pressed && canRedo && { opacity: 0.7 },
            ]}
            onPress={handleRedo}
            disabled={!canRedo}
            accessibilityRole="button"
            accessibilityLabel="Redo">
            <MaterialCommunityIcons
              name="redo"
              size={20}
              color={canRedo ? palette.primary : palette.textDisabled}
            />
          </Pressable>
          <View style={styles.toolbarSpacer} />
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
        style={styles.canvasWrap}
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
    gap: 8,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  toolIconButton: {
    backgroundColor: palette.card,
    width: 42,
    height: 42,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolIconButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  toolIconButtonDisabled: {
    opacity: 0.5,
  },
  toolbarSpacer: { flex: 1 },
  clearButton: {
    backgroundColor: palette.card,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  clearButtonText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  canvasWrap: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  touchLayer: {
    flex: 1,
  },
  touchLayerWeb: {
    cursor: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%278%27 height=%278%27%3E%3Ccircle cx=%274%27 cy=%274%27 r=%273%27 fill=%27%23333%27/%3E%3C/svg%3E") 4 4, crosshair',
  } as any,
});
