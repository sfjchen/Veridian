import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { Mistake } from '@/lib/api';

export type { Mistake } from '@/lib/api';

export type AnalysisResponse = {
  mistakes?: Mistake[];
  mistake_count?: number;
  error?: string;
};

// Red-dot overlay: dot = center of bbox, normalized [0,1]. Backend bottom-left origin;
// frontend top-left: left = dot.x * width - R, top = (1 - dot.y) * height - R.
// 8px radius → 16px visible dot. Combined with hitSlop=12 the total touch target
// is 40px, close to the 44px accessibility minimum while staying unobtrusive.
const DOT_RADIUS = 8;

type TapState = { id: string; taps: number };

type MistakeOverlayProps = {
  mistakes: Mistake[];
  revealMode?: 'single-tap' | 'progressive';
  onAskAboutMistake?: (mistake: Mistake) => void;
};

export function MistakeOverlay({ mistakes, revealMode = 'single-tap', onAskAboutMistake }: MistakeOverlayProps) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [activeDot, setActiveDot] = useState<TapState | null>(null);

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

  if (!containerSize.width || !containerSize.height || mistakes.length === 0) {
    return <View style={styles.overlay} pointerEvents="box-none" onLayout={handleLayout} />;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none" onLayout={handleLayout}>
      {activeDot && (
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissBubble} />
      )}
      {mistakes.map((m) => {
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
    else if (taps === 2) text = mistake.tag.replace(/-/g, ' ');
    else text = mistake.explanation || mistake.tag;
  } else {
    const tag = mistake.tag.replace(/-/g, ' ');
    text = mistake.explanation ? `${tag}: ${mistake.explanation}` : tag;
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
  // Dot overlay styles
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
    backgroundColor: '#ef4444',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  bubble: {
    position: 'absolute',
    bottom: DOT_RADIUS * 2 + 8,
    left: -80,
    width: 180,
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 20,
  },
  bubbleText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
  },
  askLink: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  askLinkText: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '600',
  },
});
