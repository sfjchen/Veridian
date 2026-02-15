import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useClassroomFaq } from "../../hooks/useClassroomFaq";
import { useMistakeHeatmap } from "../../hooks/useMistakeHeatmap";
import { useClassroomOverview } from "../../hooks/useClassroomOverview";
import { useClassroomTrends } from "../../hooks/useClassroomTrends";
import type {
  ClassroomOverview,
  MistakeHeatmapResponse,
  FaqTopic,
  AssignmentTrend,
  SeverityDistribution,
} from "../../types";
import { SEVERITY_ORDER, SEVERITY_COLORS } from "../../constants/severity";
import { TAG_ABBREV, TAG_TO_SEVERITY } from "../../constants/tags";
import { Skeleton, ErrorState, EmptyState } from "../../components/ui";
import { palette, radius } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

type Severity = (typeof SEVERITY_ORDER)[number];

function sortTagsBySeverity(tags: string[]): string[] {
  return [...tags].sort((a, b) => {
    const ai = SEVERITY_ORDER.indexOf((TAG_TO_SEVERITY[a] ?? "") as Severity);
    const bi = SEVERITY_ORDER.indexOf((TAG_TO_SEVERITY[b] ?? "") as Severity);
    return ai - bi;
  });
}

export function InsightsContent({ classroomId, navigation }: { classroomId: string; navigation: any }) {
  const [refreshing, setRefreshing] = useState(false);
  const [faqExpanded, setFaqExpanded] = useState(false);
  const [showAllFaq, setShowAllFaq] = useState(false);
  const [showAllMistakes, setShowAllMistakes] = useState(false);
  const [showAllTrends, setShowAllTrends] = useState(false);
  const { faq, totalMessages: faqTotalMessages, loading: faqLoading, error: faqError, refresh: refreshFaq } = useClassroomFaq(classroomId);
  const { heatmap, loading: heatmapLoading, error: heatmapError, refresh: refreshHeatmap } = useMistakeHeatmap(classroomId);
  const { overview, loading: overviewLoading, error: overviewError, refresh: refreshOverview } = useClassroomOverview(classroomId);
  const { trends, loading: trendsLoading, error: trendsError, refresh: refreshTrends } = useClassroomTrends(classroomId);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshOverview(), refreshFaq(), refreshHeatmap(), refreshTrends()]);
  }, [refreshOverview, refreshFaq, refreshHeatmap, refreshTrends]);

  useFocusEffect(useCallback(() => { refreshAll(); }, [refreshAll]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshAll(); } finally { setRefreshing(false); }
  }, [refreshAll]);

  const isLoading = overviewLoading || faqLoading || heatmapLoading || trendsLoading;

  const topFaq = faq[0];
  const sectionSummary = {
    overview: overview ? `${overview.active_students}/${overview.student_count} active learners` : "No data yet",
    faq: topFaq
      ? `${topFaq.topic} • ${topFaq.student_percentage}% students • ${topFaq.message_count} msgs`
      : "No active student topics yet",
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionHeader}>Canopy Insights</Text>
        <TouchableOpacity style={[styles.refreshBtn, (isLoading || refreshing) && styles.refreshBtnDisabled]}
          onPress={handleRefresh} disabled={isLoading || refreshing}>
          {refreshing
            ? <ActivityIndicator size="small" color={palette.white} />
            : <Text style={styles.refreshBtnText}>Refresh</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <SectionCard
          title="Overview"
          summary={sectionSummary.overview}
          expanded
        >
          <OverviewPanel
            overview={overview}
            loading={overviewLoading}
            error={overviewError}
            onRetry={refreshOverview}
            heatmap={heatmap}
            heatmapLoading={heatmapLoading}
            heatmapError={heatmapError}
            trends={trends}
            trendsLoading={trendsLoading}
            trendsError={trendsError}
            navigation={navigation}
            classroomId={classroomId}
            showAllMistakes={showAllMistakes}
            onToggleShowAllMistakes={() => setShowAllMistakes((prev) => !prev)}
            showAllTrends={showAllTrends}
            onToggleShowAllTrends={() => setShowAllTrends((prev) => !prev)}
          />
        </SectionCard>

        <SectionCard
          title="FAQ"
          summary={sectionSummary.faq}
          expanded={faqExpanded}
          onToggle={() => setFaqExpanded((prev) => !prev)}
        >
          <FaqPanel
            faq={faq}
            totalMessages={faqTotalMessages}
            loading={faqLoading}
            error={faqError}
            showAll={showAllFaq}
            onToggleShowAll={() => setShowAllFaq((prev) => !prev)}
          />
        </SectionCard>
      </ScrollView>
    </View>
  );
}

function SectionCard({
  title,
  summary,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  expanded: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionShell}>
      <TouchableOpacity style={styles.accordionHeader} onPress={onToggle} disabled={!onToggle}>
        <View>
          <Text style={styles.accordionTitle}>{title}</Text>
          <Text style={styles.accordionSummary}>{summary}</Text>
        </View>
        {onToggle ? <Text style={styles.accordionChevron}>{expanded ? "\u25BE" : "\u25B8"}</Text> : null}
      </TouchableOpacity>
      {expanded ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

// --- Overview Panel ---

function OverviewPanel({
  overview,
  loading,
  error,
  onRetry,
  heatmap,
  heatmapLoading,
  heatmapError,
  trends,
  trendsLoading,
  trendsError,
  navigation,
  classroomId,
  showAllMistakes,
  onToggleShowAllMistakes,
  showAllTrends,
  onToggleShowAllTrends,
}: {
  overview: ClassroomOverview | null; loading: boolean; error: string | null; onRetry?: () => void;
  heatmap: MistakeHeatmapResponse | null; heatmapLoading: boolean; heatmapError: string | null;
  trends: AssignmentTrend[]; trendsLoading: boolean; trendsError: string | null;
  navigation: any; classroomId: string;
  showAllMistakes: boolean; onToggleShowAllMistakes: () => void;
  showAllTrends: boolean; onToggleShowAllTrends: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  if (loading) {
    return (
      <View style={styles.skeletonPanel}>
        <View style={styles.statsGridCompact}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.statCard}>
              <Skeleton width={48} height={28} style={{ marginBottom: spacing.xs }} />
              <Skeleton width={64} height={14} />
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!overview) return <EmptyState title="No data yet" description="Data will appear once students begin working on assignments." />;

  return (
    <View style={styles.sectionCard}>
      <View style={styles.canopyBand}>
        <View style={styles.canopyGrid}>
          <CompactMetric
            label="Total mistakes"
            value={overview.total_mistakes}
          />
          <CompactMetric
            label="Avg per student"
            value={overview.avg_mistakes_per_student.toFixed(1)}
          />
        </View>
      </View>

      <TouchableOpacity onPress={() => setShowDetails((prev) => !prev)}>
        <Text style={styles.showMoreText}>{showDetails ? "Hide details" : "Show details"}</Text>
      </TouchableOpacity>
      {showDetails && (
        <>
          <View style={styles.statsGridCompact}>
            <StatCard label="Students" value={overview.active_students} sub={`of ${overview.student_count} enrolled`} />
            <StatCard label="Problems" value={overview.total_problems} />
            <StatCard label="Mistakes" value={overview.total_mistakes} />
            <StatCard label="Per Student" value={overview.avg_mistakes_per_student} />
          </View>
          <SeverityBar dist={overview.severity_distribution} />
        </>
      )}
      {overview.most_common_tag && (
        <View style={styles.highlightCard}>
          <Text style={styles.highlightLabel}>Most Common Mistake</Text>
          <Text style={styles.highlightValue}>{overview.most_common_tag}</Text>
          <View style={styles.highlightMeta}>
            <View style={[styles.highlightSevDot, { backgroundColor: SEVERITY_COLORS[TAG_TO_SEVERITY[overview.most_common_tag] ?? ""] ?? palette.textDisabled }]} />
            <Text style={styles.highlightSub}>
              {TAG_TO_SEVERITY[overview.most_common_tag] ?? ""} &middot; {overview.most_common_tag_count} occurrences
            </Text>
          </View>
        </View>
      )}

      <View style={styles.embeddedSection}>
        <Text style={styles.embeddedSectionTitle}>Mistakes</Text>
        <MistakesPanel
          heatmap={heatmap}
          loading={heatmapLoading}
          error={heatmapError}
          navigation={navigation}
          classroomId={classroomId}
          showAll={showAllMistakes}
          onToggleShowAll={onToggleShowAllMistakes}
        />
      </View>

      <View style={styles.embeddedSection}>
        <Text style={styles.embeddedSectionTitle}>Trends</Text>
        <TrendsPanel
          trends={trends}
          loading={trendsLoading}
          error={trendsError}
          showAll={showAllTrends}
          onToggleShowAll={onToggleShowAllTrends}
        />
      </View>
    </View>
  );
}

function CompactMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.compactMetricCard}>
      <Text style={styles.compactMetricValue}>{value}</Text>
      <Text style={styles.compactMetricLabel}>{label}</Text>
    </View>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{typeof value === "number" && !Number.isInteger(value) ? value.toFixed(1) : value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function SeverityBar({ dist }: { dist: SeverityDistribution }) {
  const total = dist.conceptual + dist.procedural + dist.mechanical + dist.notational;
  if (total === 0) return null;
  return (
    <View style={styles.severitySection}>
      <Text style={styles.sectionTitle}>Severity Breakdown</Text>
      <View style={styles.severityBar}>
        {SEVERITY_ORDER.map((sev) => {
          const count = dist[sev as keyof SeverityDistribution];
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <View key={sev} style={[styles.severitySegment, { width: `${pct}%`, backgroundColor: SEVERITY_COLORS[sev] }]} />
          );
        })}
      </View>
      <View style={styles.severityLegend}>
        {SEVERITY_ORDER.map((sev) => {
          const count = dist[sev as keyof SeverityDistribution];
          if (count === 0) return null;
          const pct = Math.round((count / total) * 100);
          return (
            <View key={sev} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: SEVERITY_COLORS[sev] }]} />
              <Text style={styles.legendText}>{sev} {pct}% ({count})</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// --- FAQ Panel ---

function FaqPanel({ faq, totalMessages, loading, error, showAll, onToggleShowAll }: {
  faq: FaqTopic[]; totalMessages: number; loading: boolean; error: string | null;
  showAll: boolean; onToggleShowAll: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (loading) return <ActivityIndicator style={styles.centered} />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (faq.length === 0 && totalMessages > 0) return <Text style={styles.emptyText}>Students have sent {totalMessages} message{totalMessages !== 1 ? "s" : ""}, but no recognizable math topics were detected.</Text>;
  if (faq.length === 0) return <Text style={styles.emptyText}>No student chat messages yet. Topics will appear as students ask questions.</Text>;
  const visibleFaq = showAll ? faq : faq.slice(0, 3);
  const maxPct = Math.max(...faq.map((t) => t.student_percentage), 1);
  return (
    <View>
      {visibleFaq.map((topic) => (
        <TouchableOpacity key={topic.topic} style={styles.faqRow} onPress={() => setExpanded(expanded === topic.topic ? null : topic.topic)}>
          <View style={styles.faqHeader}>
            <Text style={styles.faqTopic}>{topic.topic}</Text>
            <Text style={styles.faqStat}>{topic.student_percentage}% of students</Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${(topic.student_percentage / maxPct) * 100}%` }]} />
          </View>
          <Text style={styles.faqCount}>
            {topic.message_count} message{topic.message_count !== 1 ? "s" : ""}
            {" "}({topic.unique_students} student{topic.unique_students !== 1 ? "s" : ""})
          </Text>
          {expanded === topic.topic && topic.sample_questions.length > 0 && (
            <View style={styles.sampleSection}>
              <Text style={styles.sampleTitle}>Sample Questions</Text>
              {topic.sample_questions.map((q, i) => (
                <Text key={i} style={styles.sampleQuestion} numberOfLines={3}>{q}</Text>
              ))}
            </View>
          )}
        </TouchableOpacity>
      ))}
      {faq.length > 3 && (
        <TouchableOpacity onPress={onToggleShowAll}>
          <Text style={styles.showMoreText}>{showAll ? "Show less topics" : `Show ${faq.length - 3} more topics`}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// --- Mistakes Panel ---

function MistakesPanel({ heatmap, loading, error, navigation, classroomId, showAll, onToggleShowAll }: {
  heatmap: MistakeHeatmapResponse | null; loading: boolean; error: string | null;
  navigation: any; classroomId: string;
  showAll: boolean; onToggleShowAll: () => void;
}) {
  if (loading) return <ActivityIndicator style={styles.centered} />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (!heatmap || heatmap.students.length === 0) return <Text style={styles.emptyText}>No mistake data yet. The heatmap will populate as students work through problems.</Text>;
  const sortedTags = sortTagsBySeverity(heatmap.tags);
  const tagLimit = showAll ? 8 : 4;
  const studentLimit = showAll ? 6 : 3;
  const topTags = sortedTags
    .map((tag) => ({ tag, total: heatmap.tag_totals[tag] ?? 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, tagLimit);
  const topStudents = [...heatmap.students]
    .sort((a, b) => b.total - a.total)
    .slice(0, studentLimit);

  return (
    <View>
      <HeatmapLegend />
      <View style={styles.compactGrid}>
        <View style={styles.compactCard}>
          <Text style={styles.compactTitle}>Top Mistake Tags</Text>
          {topTags.map(({ tag, total }) => (
            <View key={tag} style={styles.compactRow}>
              <Text style={styles.compactLabel}>{TAG_ABBREV[tag] ?? tag}</Text>
              <Text style={styles.compactValue}>{total}</Text>
            </View>
          ))}
        </View>
        <View style={styles.compactCard}>
          <Text style={styles.compactTitle}>Learners Needing Support</Text>
          {topStudents.map((student) => (
            <TouchableOpacity
              key={student.student_id}
              style={styles.compactRow}
              onPress={() => navigation.navigate("StudentMistakeDetail", {
                classroomId, studentId: student.student_id, displayName: student.display_name || "Student",
              })}
            >
              <Text style={styles.compactLabel} numberOfLines={1}>{student.display_name || "Unnamed"}</Text>
              <Text style={styles.compactValue}>{student.total}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {(sortedTags.length > tagLimit || heatmap.students.length > studentLimit) && (
        <TouchableOpacity onPress={onToggleShowAll}>
          <Text style={styles.showMoreText}>{showAll ? "Show less detail" : "Show more detail"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function HeatmapLegend() {
  return (
    <View style={styles.heatmapLegendRow}>
      {SEVERITY_ORDER.map((sev) => (
        <View key={sev} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: SEVERITY_COLORS[sev] }]} />
          <Text style={styles.legendText}>{sev}</Text>
        </View>
      ))}
    </View>
  );
}

// --- Trends Panel ---

function TrendsPanel({ trends, loading, error, showAll, onToggleShowAll }: {
  trends: AssignmentTrend[]; loading: boolean; error: string | null;
  showAll: boolean; onToggleShowAll: () => void;
}) {
  if (loading) return <ActivityIndicator style={styles.centered} />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (trends.length === 0) return <Text style={styles.emptyText}>No assignment data yet. Trends will appear as students submit work on assignments.</Text>;
  const visibleTrends = showAll ? trends : trends.slice(0, 2);
  const maxMistakes = Math.max(...trends.map((t) => t.total_mistakes), 1);
  const isWeb = Platform.OS === "web";
  return (
    <View>
      <Text style={styles.trendSectionLabel}>Newest first</Text>
      <View style={styles.trendGrid}>
        {visibleTrends.map((t, i) => {
          const total = t.severity_distribution.conceptual + t.severity_distribution.procedural
            + t.severity_distribution.mechanical + t.severity_distribution.notational;
          const prev = trends[i + 1];
          const curRate = t.student_count > 0 ? t.total_mistakes / t.student_count : 0;
          const prevRate = prev && prev.student_count > 0 ? prev.total_mistakes / prev.student_count : null;
          const trendArrow = prevRate === null ? null
            : curRate < prevRate ? { symbol: "\u2193", color: palette.success }
            : curRate > prevRate ? { symbol: "\u2191", color: palette.error }
            : null;
          return (
            <View key={t.assignment_id} style={[styles.trendCardWrap, isWeb && styles.trendCardWrapWeb]}>
              <View style={styles.trendRow}>
                <View style={styles.trendHeader}>
                  <Text style={styles.trendTitle} numberOfLines={1}>{t.assignment_title || "Untitled"}</Text>
                  {trendArrow && (
                    <Text style={[styles.trendArrow, { color: trendArrow.color }]}>{trendArrow.symbol}</Text>
                  )}
                  <Text style={styles.trendDate}>
                    {t.date ? new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : ""}
                  </Text>
                </View>
                <View style={styles.trendBarBg}>
                  <View style={[styles.trendBarFill, { width: `${(t.total_mistakes / maxMistakes) * 100}%` }]} />
                </View>
                <View style={styles.trendStats}>
                  <View style={styles.trendMetricChip}>
                    <Text style={styles.trendMetricLabel}>Mistakes</Text>
                    <Text style={styles.trendMetricValue}>{t.total_mistakes}</Text>
                  </View>
                  <View style={styles.trendMetricChip}>
                    <Text style={styles.trendMetricLabel}>Students</Text>
                    <Text style={styles.trendMetricValue}>{t.student_count}</Text>
                  </View>
                  <View style={styles.trendMetricChip}>
                    <Text style={styles.trendMetricLabel}>Problems</Text>
                    <Text style={styles.trendMetricValue}>{t.problem_count}</Text>
                  </View>
                </View>
                <MiniSeverityBar dist={t.severity_distribution} />
                {total > 0 && (
                  <View style={styles.trendSeverityLabels}>
                    {SEVERITY_ORDER.map((sev) => {
                      const count = t.severity_distribution[sev as keyof SeverityDistribution];
                      if (count === 0) return null;
                      return (
                        <Text key={sev} style={[styles.trendSeverityLabel, { color: SEVERITY_COLORS[sev] }]}>
                          {sev.slice(0, 4)} {count}
                        </Text>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
      {trends.length > 2 && (
        <TouchableOpacity onPress={onToggleShowAll}>
          <Text style={styles.showMoreText}>{showAll ? "Show fewer assignments" : `Show ${trends.length - 2} more assignments`}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function MiniSeverityBar({ dist }: { dist: SeverityDistribution }) {
  const total = dist.conceptual + dist.procedural + dist.mechanical + dist.notational;
  if (total === 0) return null;
  return (
    <View style={styles.miniSeverityBar}>
      {SEVERITY_ORDER.map((sev) => {
        const count = dist[sev as keyof SeverityDistribution];
        if (count === 0) return null;
        return (
          <View key={sev} style={[styles.miniSeveritySegment, {
            width: `${(count / total) * 100}%`, backgroundColor: SEVERITY_COLORS[sev],
          }]} />
        );
      })}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: { flex: 1 },
  skeletonPanel: { paddingTop: spacing.sm },
  headerRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: spacing.sm,
  },
  sectionHeader: { ...typography.bodySmall, color: palette.textSecondary, fontWeight: "600" as const },
  refreshBtn: { marginLeft: "auto" as const, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.input, backgroundColor: palette.forestCanopy, minWidth: 70, alignItems: "center" as const },
  refreshBtnDisabled: { opacity: 0.6 },
  refreshBtnText: { color: palette.white, fontWeight: "600" as const, ...typography.bodySmall },
  panel: { flex: 1 },
  panelContent: { gap: spacing.xs, paddingBottom: spacing.sm },
  sectionShell: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden" as const,
  },
  accordionHeader: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  accordionTitle: { ...typography.bodySmall, fontWeight: "700" as const, color: palette.textPrimary },
  accordionSummary: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  accordionChevron: { color: palette.forestCanopy, fontSize: 14, fontWeight: "700" as const },
  sectionBody: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  sectionCard: {},
  canopyBand: {
    borderRadius: radius.organic,
    borderWidth: 1,
    borderColor: palette.primaryMuted,
    backgroundColor: palette.surfaceElevated,
    padding: spacing.xs,
    marginBottom: spacing.xxs,
  },
  canopyGrid: {
    flexDirection: "row" as const,
    gap: spacing.xxs,
    alignItems: "stretch" as const,
  },
  compactMetricCard: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    minHeight: 54,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    justifyContent: "center" as const,
  },
  compactMetricValue: { ...typography.bodySmall, color: palette.forestCanopy, fontWeight: "700" as const },
  compactMetricLabel: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  centered: { marginTop: spacing.xxl },
  errorText: { ...typography.body, textAlign: "center" as const, color: palette.error, marginTop: spacing.lg },
  emptyText: { ...typography.body, textAlign: "center" as const, color: palette.textDisabled, marginTop: spacing.lg },

  statsGridCompact: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: spacing.xxs, marginBottom: spacing.xs },
  statCard: { width: "48%" as const, minHeight: 64, backgroundColor: palette.surface, borderRadius: radius.card, padding: spacing.xs, alignItems: "center" as const, justifyContent: "center" as const },
  statValue: { fontSize: 16, fontWeight: "700" as const, color: palette.primary },
  statLabel: { ...typography.caption, color: palette.textMuted, marginTop: spacing.xxs, fontWeight: "600" as const },
  statSub: { fontSize: 10, color: palette.textDisabled, marginTop: 2 },
  highlightCard: { minHeight: 58, backgroundColor: palette.warningBg, borderRadius: radius.card, padding: spacing.xs, marginBottom: spacing.xs, alignItems: "center" as const, justifyContent: "center" as const },
  highlightLabel: { ...typography.caption, color: palette.warning, fontWeight: "600" as const },
  highlightValue: { fontSize: 16, fontWeight: "700" as const, color: palette.warning, marginTop: 2 },
  highlightMeta: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.xxs, marginTop: 2 },
  highlightSevDot: { width: 8, height: 8, borderRadius: 4 },
  highlightSub: { ...typography.caption, color: palette.warning },
  embeddedSection: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  embeddedSectionTitle: {
    ...typography.caption,
    color: palette.textPrimary,
    fontWeight: "700" as const,
    marginBottom: spacing.xs,
  },

  severitySection: { marginBottom: spacing.md },
  sectionTitle: { ...typography.bodySmall, fontWeight: "700" as const, color: palette.textPrimary, marginBottom: spacing.xs },
  severityBar: { flexDirection: "row" as const, height: 12, borderRadius: radius.input, overflow: "hidden" as const, backgroundColor: palette.border },
  severitySegment: { height: 12 },
  severityLegend: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: spacing.sm, marginTop: spacing.xs },
  legendItem: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.xxs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: palette.textMuted },

  faqRow: { backgroundColor: palette.card, borderRadius: radius.input, padding: spacing.sm, marginBottom: spacing.xs },
  faqHeader: { flexDirection: "row" as const, justifyContent: "space-between" as const, marginBottom: spacing.xs },
  faqTopic: { ...typography.body, fontWeight: "600" as const, color: palette.textPrimary },
  faqStat: { ...typography.bodySmall, color: palette.textMuted },
  barBg: { height: 8, backgroundColor: palette.border, borderRadius: spacing.xxs, marginBottom: spacing.xxs },
  barFill: { height: 8, backgroundColor: palette.primary, borderRadius: spacing.xxs },
  faqCount: { ...typography.caption, color: palette.textDisabled },
  sampleSection: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: palette.surface },
  sampleTitle: { ...typography.caption, fontWeight: "700" as const, color: palette.textMuted, marginBottom: spacing.xs },
  sampleQuestion: { ...typography.bodySmall, color: palette.textSecondary, marginBottom: spacing.xxs, paddingLeft: spacing.xs, borderLeftWidth: 2, borderLeftColor: palette.border },
  showMoreText: { ...typography.caption, color: palette.forestCanopy, fontWeight: "700" as const, marginTop: spacing.xs },

  heatmapLegendRow: { flexDirection: "row" as const, gap: spacing.md, marginBottom: spacing.sm, paddingHorizontal: spacing.xxs },
  compactGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: spacing.xs, alignItems: "stretch" as const },
  compactCard: {
    flex: 1,
    minWidth: 200,
    minHeight: 126,
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    padding: spacing.xs,
  },
  compactTitle: { ...typography.caption, color: palette.textMuted, fontWeight: "700" as const, marginBottom: spacing.xxs },
  compactRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, marginBottom: 2, minHeight: 16, gap: spacing.xxs },
  compactLabel: { ...typography.bodySmall, color: palette.textSecondary, flex: 1 },
  compactValue: { ...typography.bodySmall, color: palette.forestCanopy, fontWeight: "700" as const },

  trendRow: { minHeight: 126, backgroundColor: palette.card, borderRadius: radius.input, padding: spacing.xs, marginBottom: spacing.xxs, justifyContent: "space-between" as const },
  trendGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: spacing.xxs },
  trendCardWrap: { width: "100%" as const },
  trendCardWrapWeb: { width: "49%" as const },
  trendHeader: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, marginBottom: spacing.xxs },
  trendTitle: { ...typography.bodySmall, fontWeight: "600" as const, color: palette.textSecondary, flex: 1 },
  trendArrow: { fontSize: 14, fontWeight: "700" as const, marginLeft: spacing.xxs },
  trendDate: { ...typography.caption, color: palette.textDisabled, marginLeft: spacing.xs },
  trendBarBg: { height: 6, backgroundColor: palette.border, borderRadius: spacing.xxs, marginBottom: spacing.xxs },
  trendBarFill: { height: 8, backgroundColor: palette.primary, borderRadius: spacing.xxs },
  trendStats: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: spacing.xxs, marginBottom: spacing.xxs },
  trendMetricChip: {
    backgroundColor: palette.forestMist,
    borderWidth: 1,
    borderColor: palette.primaryMuted,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    minWidth: 78,
  },
  trendMetricLabel: { ...typography.caption, color: palette.textMuted },
  trendMetricValue: { ...typography.bodySmall, color: palette.forestCanopy, fontWeight: "700" as const, marginTop: 0 },
  trendSectionLabel: { fontSize: 10, color: palette.textDisabled, marginBottom: spacing.xxs, fontStyle: "italic" as const },
  trendSeverityLabels: { minHeight: 14, flexDirection: "row" as const, gap: spacing.xs, marginTop: 2 },
  trendSeverityLabel: { fontSize: 11, fontWeight: "600" as const },
  miniSeverityBar: { flexDirection: "row" as const, height: 4, borderRadius: 2, overflow: "hidden" as const, marginTop: spacing.xxs },
  miniSeveritySegment: { height: 4 },
});
