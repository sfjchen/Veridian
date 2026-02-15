import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
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
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";

type SubTab = "overview" | "faq" | "mistakes" | "trends";
const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "faq", label: "FAQ" },
  { key: "mistakes", label: "Mistakes" },
  { key: "trends", label: "Trends" },
];

function cellColor(count: number, maxCount: number): string {
  if (count === 0 || maxCount === 0) return "#F9FAFB";
  const t = Math.min(count / maxCount, 1);
  const channel = Math.round(68 + 182 * (1 - t));
  return `rgb(239,${channel},${channel})`;
}

type Severity = (typeof SEVERITY_ORDER)[number];

function sortTagsBySeverity(tags: string[]): string[] {
  return [...tags].sort((a, b) => {
    const ai = SEVERITY_ORDER.indexOf((TAG_TO_SEVERITY[a] ?? "") as Severity);
    const bi = SEVERITY_ORDER.indexOf((TAG_TO_SEVERITY[b] ?? "") as Severity);
    return ai - bi;
  });
}

export function InsightsContent({ classroomId, navigation }: { classroomId: string; navigation: any }) {
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const { faq, totalMessages: faqTotalMessages, loading: faqLoading, error: faqError, refresh: refreshFaq } = useClassroomFaq(classroomId);
  const { heatmap, loading: heatmapLoading, error: heatmapError, refresh: refreshHeatmap } = useMistakeHeatmap(classroomId);
  const { overview, loading: overviewLoading, error: overviewError, refresh: refreshOverview } = useClassroomOverview(classroomId);
  const { trends, loading: trendsLoading, error: trendsError, refresh: refreshTrends } = useClassroomTrends(classroomId);

  const refreshActive = useCallback(async () => {
    const refreshMap: Record<SubTab, () => Promise<void>> = {
      overview: refreshOverview, faq: refreshFaq, mistakes: refreshHeatmap, trends: refreshTrends,
    };
    await refreshMap[subTab]();
  }, [subTab, refreshOverview, refreshFaq, refreshHeatmap, refreshTrends]);

  useFocusEffect(useCallback(() => { refreshActive(); }, [refreshActive]));

  const handleRefresh = useCallback(async () => {
    const refreshMap: Record<SubTab, () => Promise<void>> = {
      overview: refreshOverview, faq: refreshFaq, mistakes: refreshHeatmap, trends: refreshTrends,
    };
    setRefreshing(true);
    try { await refreshMap[subTab](); } finally { setRefreshing(false); }
  }, [subTab, refreshOverview, refreshFaq, refreshHeatmap, refreshTrends]);

  const isLoading = subTab === "overview" ? overviewLoading
    : subTab === "faq" ? faqLoading
    : subTab === "mistakes" ? heatmapLoading
    : trendsLoading;

  return (
    <View style={styles.container}>
      <SubTabBar subTab={subTab} setSubTab={setSubTab} onRefresh={handleRefresh}
        refreshing={refreshing} disabled={isLoading} />
      {subTab === "overview" && <OverviewPanel overview={overview} loading={overviewLoading} error={overviewError} onRetry={refreshOverview} />}
      {subTab === "faq" && <FaqPanel faq={faq} totalMessages={faqTotalMessages} loading={faqLoading} error={faqError} />}
      {subTab === "mistakes" && (
        <MistakesPanel heatmap={heatmap} loading={heatmapLoading} error={heatmapError}
          navigation={navigation} classroomId={classroomId} />
      )}
      {subTab === "trends" && <TrendsPanel trends={trends} loading={trendsLoading} error={trendsError} />}
    </View>
  );
}

function SubTabBar({ subTab, setSubTab, onRefresh, refreshing, disabled }: {
  subTab: SubTab; setSubTab: (t: SubTab) => void; onRefresh: () => void;
  refreshing: boolean; disabled: boolean;
}) {
  return (
    <View style={styles.subTabs}>
      {SUB_TABS.map(({ key, label }) => (
        <TouchableOpacity key={key} style={[styles.subTab, subTab === key && styles.subTabActive]} onPress={() => setSubTab(key)}>
          <Text style={[styles.subTabText, subTab === key && styles.subTabTextActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={[styles.refreshBtn, disabled && styles.refreshBtnDisabled]}
        onPress={onRefresh} disabled={disabled}>
        {refreshing
          ? <ActivityIndicator size="small" color={palette.white} />
          : <Text style={styles.refreshBtnText}>Refresh</Text>}
      </TouchableOpacity>
    </View>
  );
}

// --- Overview Panel ---

function OverviewPanel({ overview, loading, error, onRetry }: {
  overview: ClassroomOverview | null; loading: boolean; error: string | null; onRetry?: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.skeletonPanel}>
        <View style={styles.statsGrid}>
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
    <ScrollView style={styles.panel}>
      <View style={styles.statsGrid}>
        <StatCard label="Students" value={overview.active_students} sub={`of ${overview.student_count} enrolled`} />
        <StatCard label="Problems" value={overview.total_problems} />
        <StatCard label="Mistakes" value={overview.total_mistakes} />
        <StatCard label="Per Student" value={overview.avg_mistakes_per_student} />
        <StatCard label="Per Problem" value={overview.avg_mistakes_per_problem} />
      </View>
      {overview.most_common_tag && (
        <View style={styles.highlightCard}>
          <Text style={styles.highlightLabel}>Most Common Mistake</Text>
          <Text style={styles.highlightValue}>{overview.most_common_tag}</Text>
          <View style={styles.highlightMeta}>
            <View style={[styles.highlightSevDot, { backgroundColor: SEVERITY_COLORS[TAG_TO_SEVERITY[overview.most_common_tag] ?? ""] ?? "#9CA3AF" }]} />
            <Text style={styles.highlightSub}>
              {TAG_TO_SEVERITY[overview.most_common_tag] ?? ""} &middot; {overview.most_common_tag_count} occurrences
            </Text>
          </View>
        </View>
      )}
      <SeverityBar dist={overview.severity_distribution} />
    </ScrollView>
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

function FaqPanel({ faq, totalMessages, loading, error }: {
  faq: FaqTopic[]; totalMessages: number; loading: boolean; error: string | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (loading) return <ActivityIndicator style={styles.centered} />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (faq.length === 0 && totalMessages > 0) return <Text style={styles.emptyText}>Students have sent {totalMessages} message{totalMessages !== 1 ? "s" : ""}, but no recognizable math topics were detected.</Text>;
  if (faq.length === 0) return <Text style={styles.emptyText}>No student chat messages yet. Topics will appear as students ask questions.</Text>;
  const maxPct = Math.max(...faq.map((t) => t.student_percentage), 1);
  return (
    <ScrollView style={styles.panel}>
      {faq.map((topic) => (
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
    </ScrollView>
  );
}

// --- Mistakes Panel ---

function MistakesPanel({ heatmap, loading, error, navigation, classroomId }: {
  heatmap: MistakeHeatmapResponse | null; loading: boolean; error: string | null;
  navigation: any; classroomId: string;
}) {
  if (loading) return <ActivityIndicator style={styles.centered} />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (!heatmap || heatmap.students.length === 0) return <Text style={styles.emptyText}>No mistake data yet. The heatmap will populate as students work through problems.</Text>;
  const sortedTags = sortTagsBySeverity(heatmap.tags);
  const maxCount = Math.max(...heatmap.students.flatMap((s) => sortedTags.map((t) => s.tag_counts[t] ?? 0)), 1);
  return (
    <ScrollView style={styles.panel}>
      <HeatmapLegend />
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <HeatmapHeader tags={sortedTags} />
          {heatmap.students.map((student) => (
            <HeatmapRow key={student.student_id} student={student} tags={sortedTags}
              maxCount={maxCount} classroomId={classroomId} navigation={navigation} />
          ))}
          <HeatmapTotalRow tags={sortedTags} tagTotals={heatmap.tag_totals} />
        </View>
      </ScrollView>
    </ScrollView>
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

function HeatmapHeader({ tags }: { tags: string[] }) {
  let prevSev = "";
  return (
    <View style={styles.heatmapRow}>
      <View style={styles.nameCell}><Text style={styles.headerText}>Student</Text></View>
      {tags.map((tag) => {
        const sev = TAG_TO_SEVERITY[tag] ?? "";
        const showDivider = sev !== prevSev && prevSev !== "";
        prevSev = sev;
        return (
          <View key={tag} style={[styles.tagCell, showDivider && styles.severityDivider,
            { borderTopWidth: 3, borderTopColor: SEVERITY_COLORS[sev] ?? "#E5E7EB" }]}>
            <Text style={styles.tagHeader}>{TAG_ABBREV[tag] ?? tag.slice(0, 4)}</Text>
          </View>
        );
      })}
      <View style={styles.tagCell}><Text style={styles.tagHeader}>Total</Text></View>
    </View>
  );
}

function HeatmapRow({ student, tags, maxCount, classroomId, navigation }: {
  student: { student_id: string; display_name: string; tag_counts: Record<string, number>; total: number };
  tags: string[]; maxCount: number; classroomId: string; navigation: any;
}) {
  let prevSev = "";
  return (
    <TouchableOpacity style={styles.heatmapRow} onPress={() => navigation.navigate("StudentMistakeDetail", {
      classroomId, studentId: student.student_id, displayName: student.display_name || "Student",
    })}>
      <View style={styles.nameCell}>
        <Text style={styles.nameText} numberOfLines={1}>{student.display_name || "Unnamed"}</Text>
      </View>
      {tags.map((tag) => {
        const count = student.tag_counts[tag] ?? 0;
        const sev = TAG_TO_SEVERITY[tag] ?? "";
        const showDivider = sev !== prevSev && prevSev !== "";
        prevSev = sev;
        return (
          <View key={tag} style={[styles.tagCell, { backgroundColor: cellColor(count, maxCount) }, showDivider && styles.severityDivider]}>
            <Text style={styles.cellText}>{count || ""}</Text>
          </View>
        );
      })}
      <View style={styles.tagCell}><Text style={styles.totalText}>{student.total}</Text></View>
    </TouchableOpacity>
  );
}

function HeatmapTotalRow({ tags, tagTotals }: { tags: string[]; tagTotals: Record<string, number> }) {
  const grandTotal = Object.values(tagTotals).reduce((a, b) => a + b, 0);
  let prevSev = "";
  return (
    <View style={[styles.heatmapRow, styles.totalRow]}>
      <View style={styles.nameCell}><Text style={styles.totalLabel}>Class Total</Text></View>
      {tags.map((tag) => {
        const sev = TAG_TO_SEVERITY[tag] ?? "";
        const showDivider = sev !== prevSev && prevSev !== "";
        prevSev = sev;
        return (
          <View key={tag} style={[styles.tagCell, showDivider && styles.severityDivider]}>
            <Text style={styles.totalText}>{tagTotals[tag] ?? 0}</Text>
          </View>
        );
      })}
      <View style={styles.tagCell}><Text style={styles.totalText}>{grandTotal}</Text></View>
    </View>
  );
}

// --- Trends Panel ---

function TrendsPanel({ trends, loading, error }: {
  trends: AssignmentTrend[]; loading: boolean; error: string | null;
}) {
  if (loading) return <ActivityIndicator style={styles.centered} />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (trends.length === 0) return <Text style={styles.emptyText}>No assignment data yet. Trends will appear as students submit work on assignments.</Text>;
  const maxMistakes = Math.max(...trends.map((t) => t.total_mistakes), 1);
  return (
    <ScrollView style={styles.panel}>
      <Text style={styles.trendSectionLabel}>Newest first</Text>
      {trends.map((t, i) => {
        const total = t.severity_distribution.conceptual + t.severity_distribution.procedural
          + t.severity_distribution.mechanical + t.severity_distribution.notational;
        const prev = trends[i + 1];
        const curRate = t.student_count > 0 ? t.total_mistakes / t.student_count : 0;
        const prevRate = prev && prev.student_count > 0 ? prev.total_mistakes / prev.student_count : null;
        const trendArrow = prevRate === null ? null
          : curRate < prevRate ? { symbol: "\u2193", color: "#10B981" }
          : curRate > prevRate ? { symbol: "\u2191", color: "#EF4444" }
          : null;
        return (
          <View key={t.assignment_id} style={styles.trendRow}>
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
              <Text style={styles.trendStat}>{t.total_mistakes} mistake{t.total_mistakes !== 1 ? "s" : ""}</Text>
              <Text style={styles.trendStatSub}>{t.student_count} student{t.student_count !== 1 ? "s" : ""}</Text>
              <Text style={styles.trendStatSub}>{t.problem_count} problem{t.problem_count !== 1 ? "s" : ""}</Text>
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
        );
      })}
    </ScrollView>
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
  skeletonPanel: { padding: spacing.md },
  subTabs: { flexDirection: "row", gap: 6, marginBottom: 12, alignItems: "center", flexWrap: "wrap" },
  subTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: "#E5E7EB" },
  subTabActive: { backgroundColor: "#4F46E5" },
  subTabText: { fontWeight: "600", color: "#374151", fontSize: 13 },
  subTabTextActive: { color: "#fff" },
  refreshBtn: { marginLeft: "auto", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#10B981", minWidth: 70, alignItems: "center" },
  refreshBtnDisabled: { opacity: 0.6 },
  refreshBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  panel: { flex: 1 },
  centered: { marginTop: 40 },
  errorText: { textAlign: "center", color: "#EF4444", marginTop: 20 },
  emptyText: { textAlign: "center", color: "#9CA3AF", marginTop: 20 },

  // Overview
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  statCard: { flex: 1, minWidth: 140, backgroundColor: "#fff", borderRadius: 10, padding: 14, alignItems: "center" },
  statValue: { fontSize: 26, fontWeight: "bold", color: "#4F46E5" },
  statLabel: { fontSize: 12, color: "#6B7280", marginTop: 4, fontWeight: "600" },
  statSub: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  highlightCard: { backgroundColor: "#FEF3C7", borderRadius: 10, padding: 14, marginBottom: 16, alignItems: "center" },
  highlightLabel: { fontSize: 12, color: "#92400E", fontWeight: "600" },
  highlightValue: { fontSize: 18, fontWeight: "bold", color: "#B45309", marginTop: 4 },
  highlightMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  highlightSevDot: { width: 8, height: 8, borderRadius: 4 },
  highlightSub: { fontSize: 12, color: "#92400E" },

  // Severity bar
  severitySection: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 8 },
  severityBar: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", backgroundColor: "#E5E7EB" },
  severitySegment: { height: 12 },
  severityLegend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: "#6B7280" },

  // FAQ
  faqRow: { backgroundColor: "#fff", borderRadius: 8, padding: 12, marginBottom: 8 },
  faqHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  faqTopic: { fontSize: 15, fontWeight: "600", color: "#111827" },
  faqStat: { fontSize: 13, color: "#6B7280" },
  barBg: { height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, marginBottom: 4 },
  barFill: { height: 8, backgroundColor: "#4F46E5", borderRadius: 4 },
  faqCount: { fontSize: 12, color: "#9CA3AF" },
  sampleSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  sampleTitle: { fontSize: 12, fontWeight: "700", color: "#6B7280", marginBottom: 6 },
  sampleQuestion: { fontSize: 13, color: "#374151", marginBottom: 4, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: "#E5E7EB" },

  // Heatmap
  heatmapLegendRow: { flexDirection: "row", gap: 16, marginBottom: 10, paddingHorizontal: 4 },
  heatmapRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  nameCell: { width: 120, padding: 8, justifyContent: "center" },
  nameText: { fontSize: 13, color: "#374151" },
  headerText: { fontSize: 12, fontWeight: "700", color: "#374151" },
  tagCell: { width: 48, padding: 4, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderLeftColor: "#F3F4F6" },
  tagHeader: { fontSize: 10, fontWeight: "700", color: "#6B7280", textAlign: "center" },
  cellText: { fontSize: 12, color: "#374151" },
  totalText: { fontSize: 12, fontWeight: "700", color: "#111827" },
  totalRow: { backgroundColor: "#F3F4F6" },
  totalLabel: { fontSize: 13, fontWeight: "700", color: "#111827" },
  severityDivider: { borderLeftWidth: 2, borderLeftColor: "#9CA3AF" },

  // Trends
  trendRow: { backgroundColor: "#fff", borderRadius: 8, padding: 12, marginBottom: 8 },
  trendHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  trendTitle: { fontSize: 14, fontWeight: "600", color: "#374151", flex: 1 },
  trendArrow: { fontSize: 16, fontWeight: "bold", marginLeft: 4 },
  trendDate: { fontSize: 12, color: "#9CA3AF", marginLeft: 8 },
  trendBarBg: { height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, marginBottom: 6 },
  trendBarFill: { height: 8, backgroundColor: "#4F46E5", borderRadius: 4 },
  trendStats: { flexDirection: "row", gap: 12, marginBottom: 4 },
  trendStat: { fontSize: 13, color: "#4F46E5", fontWeight: "600" },
  trendStatSub: { fontSize: 12, color: "#9CA3AF" },
  trendSectionLabel: { fontSize: 11, color: "#9CA3AF", marginBottom: 6, fontStyle: "italic" },
  trendSeverityLabels: { flexDirection: "row", gap: 10, marginTop: 4 },
  trendSeverityLabel: { fontSize: 11, fontWeight: "600" },
  miniSeverityBar: { flexDirection: "row", height: 4, borderRadius: 2, overflow: "hidden", marginTop: 4 },
  miniSeveritySegment: { height: 4 },
});
