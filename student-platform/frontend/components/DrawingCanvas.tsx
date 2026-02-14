import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';

import type { Tool } from '@/components/ToolBar';
import { captureStrokesAsDataUri } from '@/lib/capture-web';

const CURSOR_SIZE = 32;

const getWebCursorStyle = (tool: Tool): object | undefined => {
  if (Platform.OS !== 'web') return undefined;
  const asset = tool === 'pen'
    ? require('@/assets/cursor/pen-cursor.png')
    : require('@/assets/cursor/erasor-cursor.png');
  // On web, require() returns the URI string directly (or an object with .uri)
  const uri = typeof asset === 'string' ? asset : asset?.uri ?? asset?.default;
  if (!uri) return undefined;
  return { cursor: `url(${uri}) 0 ${CURSOR_SIZE - 1}, auto` };
};

type Point = {
  x: number;
  y: number;
};

type Stroke = {
  id: string;
  points: Point[];
};

export type DrawingCanvasRef = {
  captureWorkArea: () => Promise<string | undefined>;
  clear: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

const ERASER_RADIUS = 16;
const PEN_WIDTH = 3;

const distance = (a: Point, b: Point) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const pathFromPoints = (points: Point[]) => {
  if (points.length === 0) {
    return '';
  }

  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.01} ${p.y + 0.01}`;
  }

  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
};

type DrawingCanvasProps = {
  tool: Tool;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  captureSize?: { w: number; h: number } | null;
};

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(function DrawingCanvas(
  { tool, onHistoryChange, captureSize },
  ref
) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [markedForErase, setMarkedForErase] = useState<Set<string>>(new Set());
  const viewShotRef = useRef<ViewShot | null>(null);
  const activeStrokeIdRef = useRef<string | null>(null);
  const shiftHeldRef = useRef(false);
  const historyRef = useRef<Stroke[][]>([]);
  const redoStackRef = useRef<Stroke[][]>([]);
  const strokesRef = useRef<Stroke[]>(strokes);
  strokesRef.current = strokes;

  const pushHistory = () => {
    historyRef.current = [...historyRef.current, strokesRef.current];
    redoStackRef.current = [];
    onHistoryChange?.(true, false);
  };

  const undo = () => {
    if (historyRef.current.length === 0) return;
    const previous = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, strokesRef.current];
    setStrokes(previous);
    onHistoryChange?.(historyRef.current.length > 0, true);
  };

  const redo = () => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    historyRef.current = [...historyRef.current, strokesRef.current];
    setStrokes(next);
    onHistoryChange?.(true, redoStackRef.current.length > 0);
  };

  useImperativeHandle(ref, () => ({
    captureWorkArea: async () => {
      if (Platform.OS === 'web' && captureSize && captureSize.w > 0 && captureSize.h > 0) {
        return captureStrokesAsDataUri(strokesRef.current, captureSize.w, captureSize.h);
      }
      if (!viewShotRef.current?.capture) return undefined;
      return viewShotRef.current.capture();
    },
    clear: () => {
      if (strokesRef.current.length > 0) {
        pushHistory();
      }
      setStrokes([]);
    },
    undo,
    redo,
    get canUndo() {
      return historyRef.current.length > 0;
    },
    get canRedo() {
      return redoStackRef.current.length > 0;
    },
  }));

  const markEraseAtPoint = (point: Point) => {
    setMarkedForErase((prev) => {
      const hitIds = strokesRef.current
        .filter((stroke) => !prev.has(stroke.id) && stroke.points.some((sp) => distance(sp, point) <= ERASER_RADIUS))
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
      setStrokes((strokes) => strokes.filter((s) => !prev.has(s.id)));
      return new Set();
    });
  };

  const pointFromEvent = (event: GestureResponderEvent): Point => ({
    x: event.nativeEvent.locationX,
    y: event.nativeEvent.locationY,
  });

  const handleTouchStart = (event: GestureResponderEvent) => {
    if (Platform.OS === 'web' && shiftHeldRef.current && (tool === 'pen' || tool === 'eraser')) return;
    const point = pointFromEvent(event);
    pushHistory();

    if (tool === 'eraser') {
      markEraseAtPoint(point);
      return;
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeStrokeIdRef.current = id;
    setStrokes((prev) => [...prev, { id, points: [point] }]);
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    const point = pointFromEvent(event);

    if (tool === 'eraser') {
      markEraseAtPoint(point);
      return;
    }

    const activeId = activeStrokeIdRef.current;
    if (!activeId) {
      return;
    }

    setStrokes((prev) =>
      prev.map((stroke) =>
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

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftHeldRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftHeldRef.current = false;
        if (tool === 'eraser') commitErase();
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
    const point: Point = { x, y };
    if (tool === 'eraser') {
      markEraseAtPoint(point);
      return;
    }
    const activeId = activeStrokeIdRef.current;
    if (!activeId) {
      pushHistory();
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      activeStrokeIdRef.current = id;
      setStrokes((prev) => [...prev, { id, points: [point] }]);
    } else {
      setStrokes((prev) =>
        prev.map((s) => (s.id === activeId ? { ...s, points: [...s.points, point] } : s))
      );
    }
  };

  const handleWebMouseLeave = () => {
    if (Platform.OS !== 'web' || !shiftHeldRef.current) return;
    if (tool === 'eraser') commitErase();
    else if (activeStrokeIdRef.current) activeStrokeIdRef.current = null;
  };

  const webCursor = useMemo(() => getWebCursorStyle(tool), [tool]);

  return (
    <ViewShot
      ref={viewShotRef}
      style={styles.canvasContainer}
      options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
      <View
        style={[styles.touchLayer, webCursor]}
        collapsable={false}
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
              stroke="#111827"
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
  );
});

const styles = StyleSheet.create({
  canvasContainer: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  touchLayer: {
    flex: 1,
    backgroundColor: '#fffeff',
  },
});
