import { Platform, StyleSheet, Text, View } from 'react-native';

export function ShortcutHint() {
  if (Platform.OS !== 'web') return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>← pen · → eraser · Shift+erase · ⌘Z/⌘Y undo/redo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  text: { fontSize: 11, color: '#9ca3af' },
});
