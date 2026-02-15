import { useCallback, useMemo, useState } from 'react';
import {
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { palette, radius } from '@/constants/palette';
import { spacing, typography } from '@/constants/theme';
import type { Mistake } from '@/lib/api';
import type { DotThreshold } from '@/lib/teacherConfig';

// Re-export Mistake from the canonical api module so existing imports from
// MistakeOverlay continue to work after the PR #20 merge.
export type { Mistake } from '@/lib/api';

export type AnalysisResponse = {
  mistakes?: Mistake[];
  mistake_count?: number;
  error?: string;
};

// ---------------------------------------------------------------------------
// Bounding-box overlay (PR #20) — pixel-based rectangles
// ---------------------------------------------------------------------------

type BoxOverlayProps = {
  mistakes: Mistake[];
  layoutWidth: number;
  layoutHeight: number;
};

/** Backend coords: image pixels (layout * PixelRatio), bottom-left origin. Convert to layout points, top-left. */
function toLayoutRect(
  m: Mistake,
  imgH: number,
  scale: number,
): { left: number; top: number; width: number; height: number } {
  return {
    left: m.x_min * scale,
    top: (imgH - m.y_max) * scale,
    width: (m.x_max - m.x_min) * scale,
    height: (m.y_max - m.y_min) * scale,
  };
}

export function BoxOverlay({ mistakes, layoutWidth, layoutHeight }: BoxOverlayProps) {
  const pr = PixelRatio.get();
  const imgH = layoutHeight * pr;
  const scale = 1 / pr;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {mistakes.map((m, i) => (
        <View key={i} style={[styles.box, toLayoutRect(m, imgH, scale)]} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Dot overlay (PR #11) — normalised dot positions with hint bubbles
// ---------------------------------------------------------------------------

const DOT_RADIUS = 8;
const SEVERITY_RANK: Record<DotThreshold, number> = {
  notational: 0,
  mechanical: 1,
  procedural: 2,
  conceptual: 3,
};

type TapState = { id: string; taps: number };

type MistakeOverlayProps = {
  mistakes: Mistake[];
  revealMode?: 'single-tap' | 'progressive';
  onAskAboutMistake?: (mistake: Mistake) => void;
  dotThreshold?: DotThreshold;
  maxDotsShown?: number;
};

function severityRank(severity: string): number {
  if (severity === 'notational') return SEVERITY_RANK.notational;
  if (severity === 'mechanical') return SEVERITY_RANK.mechanical;
  if (severity === 'procedural') return SEVERITY_RANK.procedural;
  if (severity === 'conceptual') return SEVERITY_RANK.conceptual;
  return -1;
}

function filterVisibleMistakes(
  mistakes: Mistake[],
  dotThreshold: DotThreshold,
  maxDotsShown: number,
): Mistake[] {
  const minRank = SEVERITY_RANK[dotThreshold];
  const filtered = mistakes.filter((m) => m.dot != null && severityRank(m.severity) >= minRank);
  if (maxDotsShown <= 0 || filtered.length <= maxDotsShown) return filtered;

  const prioritized = filtered
    .map((mistake, index) => ({ mistake, index }))
    .sort((a, b) => {
      const rankDiff = severityRank(b.mistake.severity) - severityRank(a.mistake.severity);
      if (rankDiff !== 0) return rankDiff;
      return a.index - b.index;
    })
    .slice(0, maxDotsShown)
    .map((item) => item.mistake);
  return prioritized;
}

export function MistakeOverlay({
  mistakes,
  revealMode = 'single-tap',
  onAskAboutMistake,
  dotThreshold = 'mechanical',
  maxDotsShown = 0,
}: MistakeOverlayProps) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [activeDot, setActiveDot] = useState<TapState | null>(null);

  const visibleMistakes = useMemo(
    () => filterVisibleMistakes(mistakes, dotThreshold, maxDotsShown),
    [mistakes, dotThreshold, maxDotsShown],
  );

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

  const handleDotPress = useCallback(
    (mistake: Mistake) => {
      setActiveDot((prev) => {
        if (prev?.id === mistake.id) {
          if (revealMode === 'progressive') {
            return { id: mistake.id, taps: prev.taps + 1 };
          }
          return null;
        }
        return { id: mistake.id, taps: 1 };
      });
    },
    [revealMode],
  );

  const dismissBubble = useCallback(() => setActiveDot(null), []);

  if (!containerSize.width || !containerSize.height || visibleMistakes.length === 0) {
    return <View style={styles.overlay} pointerEvents="box-none" onLayout={handleLayout} />;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none" onLayout={handleLayout}>
      {activeDot && (
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissBubble} />
      )}
      {visibleMistakes.map((m) => {
        if (!m.dot) return null;
        const left = m.dot.x * containerSize.width - DOT_RADIUS;
        // Backend uses bottom-left origin (math convention), frontend uses
        // top-left origin, so invert Y.
        const top = (1 - m.dot.y) * containerSize.height - DOT_RADIUS;

        return (
          <View key={m.id} style={[styles.dotWrap, { left, top }]}>
            <Pressable
              style={styles.dot}
              onPress={() => handleDotPress(m)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Mistake: ${m.tag}`}
            />
            {activeDot?.id === m.id && (
              <HintBubble
                mistake={m}
                taps={activeDot.taps}
                revealMode={revealMode}
                onAskAboutMistake={onAskAboutMistake}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

function HintBubble({
  mistake,
  taps,
  revealMode,
  onAskAboutMistake,
}: {
  mistake: Mistake;
  taps: number;
  revealMode: 'single-tap' | 'progressive';
  onAskAboutMistake?: (mistake: Mistake) => void;
}) {
  let text: string;
  if (revealMode === 'progressive') {
    if (taps === 1) text = "There's a mistake here.";
    else if (taps === 2) text = `Hint: ${mistake.tag.replace(/-/g, ' ')}`;
    else text = mistake.explanation || mistake.tag;
  } else {
    text = mistake.explanation || mistake.tag;
  }

  return (
    <View style={styles.bubble}>
      <Text style={styles.bubbleText}>{text}</Text>
      {onAskAboutMistake && (
        <Pressable
          style={({ pressed }) => [styles.askLink, pressed && { opacity: 0.6 }]}
          onPress={() => onAskAboutMistake(mistake)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Ask about this mistake"
        >
          <Text style={styles.askLinkText}>Ask about this</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  dotWrap: {
    position: 'absolute',
    zIndex: 10,
  },
  dot: {
    width: DOT_RADIUS * 2,
    height: DOT_RADIUS * 2,
    borderRadius: DOT_RADIUS,
    backgroundColor: palette.error,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  bubble: {
    position: 'absolute',
    bottom: DOT_RADIUS * 2 + spacing.xs,
    left: -80,
    width: 180,
    backgroundColor: palette.textPrimary,
    borderRadius: radius.button,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    zIndex: 20,
  },
  bubbleText: {
    ...typography.bodySmall,
    color: palette.card,
  },
  askLink: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  askLinkText: {
    ...typography.caption,
    fontWeight: '600',
    color: palette.primaryMutedTint,
  },
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: palette.error,
    backgroundColor: palette.errorBg,
  },
});
