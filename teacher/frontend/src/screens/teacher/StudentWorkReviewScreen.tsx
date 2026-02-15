import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useStudentResults } from "../../hooks/useStudentResults";
import { LatexRenderer } from "../../components/LatexRenderer";
import { ProblemResult } from "../../types";
import { SEVERITY_COLORS } from "../../constants/severity";
import {
  Card,
  EmptyState,
  ErrorState,
  ScreenContainer,
  Section,
  SkeletonCard,
} from "../../components/ui";
import { palette, radius } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

export function StudentWorkReviewScreen({ route, navigation }: { route: any; navigation: any }) {
  const { assignmentId, studentId, studentDisplayName } = route.params as {
    assignmentId: string; studentId: string; studentDisplayName: string;
  };
  const { results, loading, error, refresh } = useStudentResults(assignmentId, studentId);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (loading) {
    return (
      <ScreenContainer maxWidth="dashboard">
        <Header name={studentDisplayName} onBack={() => navigation.goBack()} />
        <SkeletonCard />
        <SkeletonCard />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer maxWidth="dashboard">
        <Header name={studentDisplayName} onBack={() => navigation.goBack()} />
        <ErrorState message={error} onRetry={refresh} />
      </ScreenContainer>
    );
  }

  if (results.length === 0) {
    return (
      <ScreenContainer maxWidth="dashboard">
        <Header name={studentDisplayName} onBack={() => navigation.goBack()} />
        <EmptyState title="No work submitted yet" description="This student has not submitted any work for this assignment." />
      </ScreenContainer>
    );
  }

  const result = results[currentIndex];

  return (
    <ScreenContainer maxWidth="dashboard">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Header name={studentDisplayName} onBack={() => navigation.goBack()} />
        <ProblemPager
          current={currentIndex}
          total={results.length}
          onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          onNext={() => setCurrentIndex((i) => Math.min(results.length - 1, i + 1))}
        />
        <ProblemContent result={result} />
        <MistakeList result={result} />
      </ScrollView>
    </ScreenContainer>
  );
}

function Header({ name, onBack }: { name: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.studentName} numberOfLines={1}>{name}</Text>
    </View>
  );
}

function ProblemPager({ current, total, onPrev, onNext }: {
  current: number; total: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <View style={styles.pager}>
      <TouchableOpacity onPress={onPrev} disabled={current === 0} style={styles.pagerButton}>
        <Text style={[styles.pagerButtonText, current === 0 && styles.pagerDisabled]}>Prev</Text>
      </TouchableOpacity>
      <Text style={styles.pagerLabel}>{current + 1} / {total}</Text>
      <TouchableOpacity onPress={onNext} disabled={current === total - 1} style={styles.pagerButton}>
        <Text style={[styles.pagerButtonText, current === total - 1 && styles.pagerDisabled]}>Next</Text>
      </TouchableOpacity>
    </View>
  );
}

function ProblemContent({ result }: { result: ProblemResult }) {
  return (
    <Section title={`Problem ${result.problem_num}`}>
      {result.status === "error" ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>{result.error_message ?? "Analysis failed"}</Text>
        </Card>
      ) : result.student_tex ? (
        <LatexRenderer latex={result.student_tex} />
      ) : (
        <Text style={styles.noContent}>No student work captured</Text>
      )}
    </Section>
  );
}

function MistakeList({ result }: { result: ProblemResult }) {
  if (result.status !== "complete") {
    return (
      <Section title="Mistakes">
        <Text style={styles.noContent}>
          {result.status === "analyzing" ? "Analysis in progress..." : "Awaiting analysis"}
        </Text>
      </Section>
    );
  }

  if (!result.mistakes || result.mistakes.length === 0) {
    return (
      <Section title="Mistakes">
        <Text style={styles.noContent}>No mistakes detected</Text>
      </Section>
    );
  }

  return (
    <Section title={`Mistakes (${result.mistakes.length})`}>
      {result.mistakes.map((m, i) => (
        <Card key={m.id ?? i} style={styles.mistakeCard}>
          <View style={styles.mistakeHeader}>
            <Text style={styles.mistakeTag}>{m.tag}</Text>
            <View style={[styles.severityDot, { backgroundColor: SEVERITY_COLORS[m.severity] ?? "#9CA3AF" }]} />
            <Text style={styles.severityText}>{m.severity}</Text>
          </View>
          <Text style={styles.mistakeExplanation}>{m.explanation}</Text>
        </Card>
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.md, paddingBottom: spacing.xxxl },
  header: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md, gap: spacing.sm },
  backButton: { paddingVertical: spacing.xxs, paddingHorizontal: spacing.sm, backgroundColor: palette.border, borderRadius: radius.button },
  backText: { ...typography.buttonSmall, color: palette.textSecondary },
  studentName: { ...typography.h1, color: palette.textPrimary, flex: 1 },

  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, marginBottom: spacing.md },
  pagerButton: { paddingVertical: spacing.xxs, paddingHorizontal: spacing.sm, backgroundColor: palette.primary, borderRadius: radius.button },
  pagerButtonText: { ...typography.buttonSmall, color: palette.textOnPrimary },
  pagerDisabled: { color: palette.textDisabled },
  pagerLabel: { ...typography.body, fontWeight: "600", color: palette.textPrimary },

  errorCard: { backgroundColor: palette.errorBg },
  errorText: { ...typography.bodySmall, color: palette.error },
  noContent: { ...typography.body, color: palette.textMuted, textAlign: "center", paddingVertical: spacing.md },

  mistakeCard: { marginBottom: spacing.sm },
  mistakeHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.xxs },
  mistakeTag: { ...typography.bodySmall, fontWeight: "600", color: palette.textPrimary },
  severityDot: { width: 8, height: 8, borderRadius: 4 },
  severityText: { ...typography.caption, color: palette.textMuted },
  mistakeExplanation: { ...typography.bodySmall, color: palette.textSecondary },
});
