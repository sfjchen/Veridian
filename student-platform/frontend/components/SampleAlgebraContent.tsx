import { ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Native React Native version of the sample algebra worksheet.
 * Used on web where WebView is not supported, and optionally on native for consistency.
 */
export function SampleAlgebraContent() {
  const problems: { num: string; title: string; equations: string[] }[] = [
    { num: '1', title: 'Solve for x', equations: ['2x + 5 = 13'] },
    { num: '2', title: 'Solve for x', equations: ['3(x − 4) = 15'] },
    { num: '3', title: 'Simplify', equations: ['4x + 2 − 3x + 7'] },
    { num: '4', title: 'Solve for x', equations: ['x/2 + 3 = 8'] },
    { num: '5', title: 'Solve the system (optional)', equations: ['x + y = 10', '2x − y = 2'] },
  ];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator>
      <Text style={styles.title}>Sample Algebra Problems</Text>
      <Text style={styles.subtitle}>
        Work through each problem. Use the space below each for your work.
      </Text>
      {problems.map((p) => (
        <View key={p.num} style={styles.problem}>
          <Text style={styles.problemNum}>
            {p.num}. {p.title}
          </Text>
          {p.equations.map((eq, i) => (
            <Text key={i} style={styles.equation}>
              {eq}
            </Text>
          ))}
          <Text style={styles.work}>Show your work here.</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    color: '#374151',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 24,
  },
  problem: {
    marginBottom: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  problemNum: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
  },
  equation: {
    fontSize: 18,
    marginVertical: 8,
    color: '#111827',
  },
  work: {
    marginTop: 12,
    minHeight: 48,
    fontSize: 14,
    color: '#9ca3af',
  },
});
