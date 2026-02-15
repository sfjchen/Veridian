import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ShortcutHint } from '@/components/ShortcutHint';

export type Tool = 'pen' | 'eraser';

type ToolBarProps = {
  tool: Tool;
  onSelectTool: (tool: Tool) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export function ToolBar({ tool, onSelectTool, onClear, onUndo, onRedo, canUndo, canRedo }: ToolBarProps) {
  return (
    <View>
    <View style={styles.row}>
      <Pressable
        style={[styles.iconButton, tool === 'pen' && styles.iconButtonActive]}
        onPress={() => onSelectTool('pen')}
        accessibilityRole="button"
        accessibilityLabel="Pen tool">
        <MaterialCommunityIcons
          name="pencil-outline"
          size={20}
          color={tool === 'pen' ? '#2f5fd6' : '#6b7280'}
        />
      </Pressable>

      <Pressable
        style={[styles.iconButton, tool === 'eraser' && styles.iconButtonActive]}
        onPress={() => onSelectTool('eraser')}
        accessibilityRole="button"
        accessibilityLabel="Eraser tool">
        <MaterialCommunityIcons
          name="eraser-variant"
          size={20}
          color={tool === 'eraser' ? '#2f5fd6' : '#6b7280'}
        />
      </Pressable>

      <Pressable
        style={[styles.iconButton, !canUndo && styles.iconButtonDisabled]}
        onPress={onUndo}
        disabled={!canUndo}
        accessibilityRole="button"
        accessibilityLabel="Undo">
        <MaterialCommunityIcons
          name="undo"
          size={20}
          color={canUndo ? '#6b7280' : '#d1d5db'}
        />
      </Pressable>

      <Pressable
        style={[styles.iconButton, !canRedo && styles.iconButtonDisabled]}
        onPress={onRedo}
        disabled={!canRedo}
        accessibilityRole="button"
        accessibilityLabel="Redo">
        <MaterialCommunityIcons
          name="redo"
          size={20}
          color={canRedo ? '#6b7280' : '#d1d5db'}
        />
      </Pressable>

      <View style={styles.spacer} />

      <Pressable
        style={styles.clearButton}
        onPress={onClear}
        accessibilityRole="button"
        accessibilityLabel="Clear canvas">
        <Text style={styles.clearText}>Clear</Text>
      </Pressable>
    </View>
    <ShortcutHint />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: {
    backgroundColor: '#eaf0ff',
    borderColor: '#c9d7ff',
  },
  iconButtonDisabled: {
    opacity: 0.5,
  },
  spacer: {
    flex: 1,
  },
  clearButton: {
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  clearText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
});
