import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { api } from "../../lib/api";
import { StudentMistakeProfile } from "../../types";

export function StudentMistakeDetailScreen({ route }: { route: any }) {
  const { classroomId, studentId, displayName } = route.params as {
    classroomId: string;
    studentId: string;
    displayName: string;
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

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile.total_mistakes}</Text>
          <Text style={styles.statLabel}>Total Mistakes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile.problems_attempted}</Text>
          <Text style={styles.statLabel}>Problems Attempted</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Top Mistake Types</Text>
      {profile.top_tags.length === 0 ? (
        <Text style={styles.emptyText}>No mistakes recorded</Text>
      ) : (
        profile.top_tags.map((t) => (
          <View key={t.tag} style={styles.tagRow}>
            <View style={styles.tagInfo}>
              <Text style={styles.tagName}>{t.tag}</Text>
              <Text style={styles.tagSeverity}>{t.severity}</Text>
            </View>
            <Text style={styles.tagCount}>{t.count}</Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Progress Over Time</Text>
      {profile.temporal.length === 0 ? (
        <Text style={styles.emptyText}>No assignment history</Text>
      ) : (
        profile.temporal.map((entry) => (
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
            <Text style={styles.temporalCount}>
              {entry.mistake_count} mistake{entry.mistake_count !== 1 ? "s" : ""}
            </Text>
            {Object.entries(entry.tags).length > 0 && (
              <Text style={styles.temporalTags}>
                {Object.entries(entry.tags).map(([tag, count]) => `${tag} (${count})`).join(", ")}
              </Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f9fafb" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "bold", color: "#111827", marginBottom: 16 },
  errorText: { textAlign: "center", color: "#EF4444", marginTop: 40, fontSize: 15 },
  emptyText: { textAlign: "center", color: "#9CA3AF", marginTop: 12 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 16,
    alignItems: "center",
  },
  statValue: { fontSize: 28, fontWeight: "bold", color: "#4F46E5" },
  statLabel: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 10, marginTop: 8 },
  tagRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 8, padding: 12, marginBottom: 6,
  },
  tagInfo: { flex: 1 },
  tagName: { fontSize: 14, fontWeight: "600", color: "#374151" },
  tagSeverity: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  tagCount: { fontSize: 18, fontWeight: "bold", color: "#4F46E5", marginLeft: 12 },
  temporalRow: { backgroundColor: "#fff", borderRadius: 8, padding: 12, marginBottom: 8 },
  temporalHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  temporalTitle: { fontSize: 14, fontWeight: "600", color: "#374151", flex: 1 },
  temporalDate: { fontSize: 12, color: "#9CA3AF", marginLeft: 8 },
  temporalCount: { fontSize: 13, color: "#4F46E5", fontWeight: "600" },
  temporalTags: { fontSize: 11, color: "#6B7280", marginTop: 4 },
});
