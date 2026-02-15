import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { api } from "../../lib/api";
import { StudentMistakeProfile, SeverityDistribution } from "../../types";
import { SEVERITY_ORDER, SEVERITY_COLORS } from "../../constants/severity";
import { TAG_TO_SEVERITY } from "../../constants/tags";
import { palette, radius } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

export function StudentMistakeDetailScreen({ route }: { route: any }) {
  const { classroomId, studentId, displayName } = route.params as {
    classroomId: string; studentId: string; displayName: string;
  };
  const [profile, setProfile] = useState<StudentMistakeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<StudentMistakeProfile>(
          `/analytics/classrooms/${classroomId}/students/${studentId}/mistakes`
        );
        if (mountedRef.current) setProfile(data);
      } catch (e) {
        if (mountedRef.current) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, [classroomId, studentId]);

  if (loading) return <ActivityIndicator style={styles.centered} size="large" color={palette.primary} />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (!profile) return <Text style={styles.emptyText}>No data available</Text>;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{displayName}</Text>
      <StatsRow profile={profile} />
      <SeverityBreakdown dist={profile.severity_distribution} />
      <TopTags tags={profile.top_tags} />
      <TemporalChart entries={profile.temporal} />
    </ScrollView>
  );
}

function StatsRow({ profile }: { profile: StudentMistakeProfile }) {
  const rateDisplay = profile.problems_attempted > 0
    ? profile.mistake_rate.toFixed(1)
    : "N/A";
  return (
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{profile.total_mistakes}</Text>
        <Text style={styles.statLabel}>Mistakes</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{profile.problems_attempted}</Text>
        <Text style={styles.statLabel}>Problems</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{rateDisplay}</Text>
        <Text style={styles.statLabel}>Per Problem</Text>
      </View>
    </View>
  );
}

function SeverityBreakdown({ dist }: { dist: SeverityDistribution }) {
  const total = dist.conceptual + dist.procedural + dist.mechanical + dist.notational;
  if (total === 0) return null;
  return (
    <View style={styles.severitySection}>
      <Text style={styles.sectionTitle}>Severity Breakdown</Text>
      <View style={styles.severityBar}>
        {SEVERITY_ORDER.map((sev) => {
          const count = dist[sev as keyof SeverityDistribution];
          if (count === 0) return null;
          return (
            <View key={sev} style={[styles.severitySegment, {
              width: `${(count / total) * 100}%`, backgroundColor: SEVERITY_COLORS[sev],
            }]} />
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

function TopTags({ tags }: { tags: StudentMistakeProfile["top_tags"] }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Top Mistake Types</Text>
      {tags.length === 0 ? (
        <Text style={styles.emptyText}>No mistakes recorded</Text>
      ) : (
        tags.map((t) => (
          <View key={t.tag} style={styles.tagRow}>
            <View style={styles.tagInfo}>
              <Text style={styles.tagName}>{t.tag}</Text>
              <View style={styles.severityBadge}>
                <View style={[styles.badgeDot, { backgroundColor: SEVERITY_COLORS[t.severity] ?? palette.textDisabled }]} />
                <Text style={styles.tagSeverity}>{t.severity}</Text>
              </View>
            </View>
            <Text style={styles.tagCount}>{t.count}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function TemporalChart({ entries }: { entries: StudentMistakeProfile["temporal"] }) {
  if (entries.length === 0) {
    return (
      <View>
        <Text style={styles.sectionTitle}>Progress Over Time</Text>
        <Text style={styles.emptyText}>No assignment history</Text>
      </View>
    );
  }
  const maxMistakes = Math.max(...entries.map((e) => e.mistake_count), 1);
  return (
    <View>
      <Text style={styles.sectionTitle}>Progress Over Time</Text>
      {entries.map((entry) => {
        const tagEntries = Object.entries(entry.tags)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);
        return (
          <View key={entry.assignment_id} style={styles.temporalRow}>
            <View style={styles.temporalHeader}>
              <Text style={styles.temporalTitle} numberOfLines={1}>
                {entry.assignment_title || "Untitled"}
              </Text>
              <Text style={styles.temporalDate}>
                {entry.date ? new Date(entry.date).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", timeZone: "UTC",
                }) : ""}
              </Text>
            </View>
            <View style={styles.temporalBarBg}>
              <View style={[styles.temporalBarFill, {
                width: `${(entry.mistake_count / maxMistakes) * 100}%`,
              }]} />
            </View>
            <Text style={styles.temporalCount}>
              {entry.mistake_count} mistake{entry.mistake_count !== 1 ? "s" : ""}
            </Text>
            {tagEntries.length > 0 && (
              <View style={styles.temporalTagsRow}>
                {tagEntries.map(([tag, count]) => {
                  const sev = TAG_TO_SEVERITY[tag] ?? "";
                  return (
                    <View key={tag} style={styles.temporalTagChip}>
                      <View style={[styles.temporalTagDot, { backgroundColor: SEVERITY_COLORS[sev] ?? palette.textDisabled }]} />
                      <Text style={styles.temporalTagText}>{tag} ({count})</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, backgroundColor: "rgba(255,255,255,0.68)" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { ...typography.h2, fontWeight: "700" as const, color: palette.textPrimary, marginBottom: spacing.md },
  errorText: { ...typography.bodySmall, textAlign: "center", color: palette.error, marginTop: spacing.xxl },
  emptyText: { ...typography.caption, textAlign: "center", color: palette.textMuted, marginTop: spacing.sm },

  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, backgroundColor: palette.card, borderRadius: radius.card, padding: spacing.sm, alignItems: "center" },
  statValue: { ...typography.h1, fontSize: 26, fontWeight: "700" as const, color: palette.primary },
  statLabel: { ...typography.caption, color: palette.textMuted, marginTop: spacing.xxs, fontWeight: "600" as const },

  severitySection: { marginBottom: spacing.md },
  sectionTitle: { ...typography.body, fontWeight: "700" as const, color: palette.textPrimary, marginBottom: spacing.sm, marginTop: spacing.xs },
  severityBar: { flexDirection: "row", height: 12, borderRadius: radius.input, overflow: "hidden", backgroundColor: palette.border },
  severitySegment: { height: 12 },
  severityLegend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xxs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.caption, fontSize: 11, color: palette.textMuted },

  tagRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: palette.card,
    borderRadius: radius.button,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  tagInfo: { flex: 1 },
  tagName: { ...typography.bodySmall, fontWeight: "600" as const, color: palette.textSecondary },
  severityBadge: { flexDirection: "row", alignItems: "center", gap: spacing.xxs, marginTop: 3 },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  tagSeverity: { ...typography.caption, color: palette.textMuted },
  tagCount: { ...typography.body, fontWeight: "700" as const, color: palette.primary, marginLeft: spacing.sm },

  temporalRow: { backgroundColor: palette.card, borderRadius: radius.button, padding: spacing.sm, marginBottom: spacing.xs },
  temporalHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  temporalTitle: { ...typography.bodySmall, fontWeight: "600" as const, color: palette.textSecondary, flex: 1 },
  temporalDate: { ...typography.caption, color: palette.textMuted, marginLeft: spacing.xs },
  temporalBarBg: { height: 8, backgroundColor: palette.border, borderRadius: spacing.xxs, marginBottom: spacing.xs },
  temporalBarFill: { height: 8, backgroundColor: palette.primary, borderRadius: spacing.xxs },
  temporalCount: { ...typography.bodySmall, color: palette.primary, fontWeight: "600" as const },
  temporalTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  temporalTagChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: palette.surface, borderRadius: spacing.xxs, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  temporalTagDot: { width: 6, height: 6, borderRadius: 3 },
  temporalTagText: { ...typography.caption, fontSize: 11, color: palette.textMuted },
});
