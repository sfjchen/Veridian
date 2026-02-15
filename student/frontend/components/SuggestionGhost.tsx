import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/palette';
import type { BBox } from '@/lib/line-grouping';

type SuggestionGhostProps = {
  text: string;
  lineBBox: BBox;
  opacity?: number;
  color?: string;
};

export function SuggestionGhost({
  text,
  lineBBox,
  opacity = 0.4,
  color = palette.textMuted,
}: SuggestionGhostProps) {
  const lineHeight = lineBBox.maxY - lineBBox.minY;
  const fontSize = Math.min(32, Math.max(16, lineHeight * 0.8));
  const top = lineBBox.minY + (lineHeight - fontSize) / 2;

  return (
    <View style={styles.container} pointerEvents="none">
      <Text
        style={[
          styles.ghost,
          {
            left: lineBBox.maxX + 12,
            top,
            fontSize,
            opacity,
            color,
          },
        ]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  ghost: {
    position: 'absolute',
    fontFamily: 'Caveat',
  },
});
