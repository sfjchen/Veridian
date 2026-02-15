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

const SEVERITY_ORDER = ["conceptual", "procedural", "mechanical", "notational"];
const SEVERITY_COLORS: Record<string, string> = {
  conceptual: "#EF4444", procedural: "#F59E0B", mechanical: "#3B82F6", notational: "#8B5CF6",
};

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

  if (loading) return <ActivityIndicator style={styles.centered} size="large" />;
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
        <Text style={styles.statValue}>{profile.mistake_rate.toFixed(1)}</Text>
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
                <View style={[styles.badgeDot, { backgroundColor: SEVERITY_COLORS[t.severity] ?? "#9CA3AF" }]} />
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
      {entries.map((entry) => (
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
          {Object.entries(entry.tags).length > 0 && (
            <Text style={styles.temporalTags}>
              {Object.entries(entry.tags).map(([tag, count]) => `${tag} (${count})`).join(", ")}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f9fafb" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "bold", color: "#111827", marginBottom: 16 },
  errorText: { textAlign: "center", color: "#EF4444", marginTop: 40, fontSize: 15 },
  emptyText: { textAlign: "center", color: "#9CA3AF", marginTop: 12 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 14, alignItems: "center" },
  statValue: { fontSize: 26, fontWeight: "bold", color: "#4F46E5" },
  statLabel: { fontSize: 12, color: "#6B7280", marginTop: 4, fontWeight: "600" },

  severitySection: { marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 10, marginTop: 8 },
  severityBar: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", backgroundColor: "#E5E7EB" },
  severitySegment: { height: 12 },
  severityLegend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: "#6B7280" },

  tagRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 8, padding: 12, marginBottom: 6,
  },
  tagInfo: { flex: 1 },
  tagName: { fontSize: 14, fontWeight: "600", color: "#374151" },
  severityBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  tagSeverity: { fontSize: 12, color: "#6B7280" },
  tagCount: { fontSize: 18, fontWeight: "bold", color: "#4F46E5", marginLeft: 12 },

  temporalRow: { backgroundColor: "#fff", borderRadius: 8, padding: 12, marginBottom: 8 },
  temporalHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  temporalTitle: { fontSize: 14, fontWeight: "600", color: "#374151", flex: 1 },
  temporalDate: { fontSize: 12, color: "#9CA3AF", marginLeft: 8 },
  temporalBarBg: { height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, marginBottom: 6 },
  temporalBarFill: { height: 8, backgroundColor: "#4F46E5", borderRadius: 4 },
  temporalCount: { fontSize: 13, color: "#4F46E5", fontWeight: "600" },
  temporalTags: { fontSize: 11, color: "#6B7280", marginTop: 4 },
});
