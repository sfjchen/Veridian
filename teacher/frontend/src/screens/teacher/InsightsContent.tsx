import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useClassroomFaq } from "../../hooks/useClassroomFaq";
import { useMistakeHeatmap } from "../../hooks/useMistakeHeatmap";
import type { MistakeHeatmapResponse } from "../../types";

type SubTab = "faq" | "mistakes";

const TAG_ABBREV: Record<string, string> = {
  "wrong-theorem": "WThm", "misunderstood-definition": "MDef",
  "domain-error": "Dom", "incorrect-assumption": "IAsm", "flawed-logic": "FLog",
  "wrong-method": "WMth", "skipped-step": "Skip",
  "incorrect-application": "IApp", "order-of-operations": "OoO",
  "sign-error": "Sign", "arithmetic-error": "Arth",
  "algebra-error": "Algb", "lost-term": "Lost",
  "ambiguous-notation": "ANot", "missing-quantifier": "MQnt",
  "inconsistent-variables": "IVar",
};

function cellColor(count: number, maxCount: number): string {
  if (count === 0 || maxCount === 0) return "#F9FAFB";
  const t = Math.min(count / maxCount, 1);
  const channel = Math.round(68 + 182 * (1 - t));
  return `rgb(239,${channel},${channel})`;
}

export function InsightsContent({ classroomId, navigation }: { classroomId: string; navigation: any }) {
  const [subTab, setSubTab] = useState<SubTab>("faq");
  const { faq, loading: faqLoading, error: faqError, refresh: refreshFaq } = useClassroomFaq(classroomId);
  const { heatmap, loading: heatmapLoading, error: heatmapError, refresh: refreshHeatmap } = useMistakeHeatmap(classroomId);

  return (
    <View style={styles.container}>
      <SubTabBar subTab={subTab} setSubTab={setSubTab} onRefresh={subTab === "faq" ? refreshFaq : refreshHeatmap} />
      {subTab === "faq" && <FaqPanel faq={faq} loading={faqLoading} error={faqError} />}
      {subTab === "mistakes" && (
        <MistakesPanel heatmap={heatmap} loading={heatmapLoading} error={heatmapError}
          navigation={navigation} classroomId={classroomId} />
      )}
    </View>
  );
}

function SubTabBar({ subTab, setSubTab, onRefresh }: { subTab: SubTab; setSubTab: (t: SubTab) => void; onRefresh: () => void }) {
  return (
    <View style={styles.subTabs}>
      {(["faq", "mistakes"] as SubTab[]).map((tab) => (
        <TouchableOpacity key={tab} style={[styles.subTab, subTab === tab && styles.subTabActive]} onPress={() => setSubTab(tab)}>
          <Text style={[styles.subTabText, subTab === tab && styles.subTabTextActive]}>{tab === "faq" ? "FAQ" : "Mistakes"}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
        <Text style={styles.refreshBtnText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );
}

function FaqPanel({ faq, loading, error }: {
  faq: { topic: string; message_count: number; student_percentage: number }[];
  loading: boolean; error: string | null;
}) {
  if (loading) return <ActivityIndicator style={styles.centered} />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (faq.length === 0) return <Text style={styles.emptyText}>No chat data yet</Text>;
  const maxPct = Math.max(...faq.map((t) => t.student_percentage), 1);
  return (
    <ScrollView style={styles.panel}>
      {faq.map((topic) => (
        <View key={topic.topic} style={styles.faqRow}>
          <View style={styles.faqHeader}>
            <Text style={styles.faqTopic}>{topic.topic}</Text>
            <Text style={styles.faqStat}>{topic.student_percentage}% of students</Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${(topic.student_percentage / maxPct) * 100}%` }]} />
          </View>
          <Text style={styles.faqCount}>{topic.message_count} message{topic.message_count !== 1 ? "s" : ""}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function MistakesPanel({ heatmap, loading, error, navigation, classroomId }: {
  heatmap: MistakeHeatmapResponse | null; loading: boolean; error: string | null;
  navigation: any; classroomId: string;
}) {
  if (loading) return <ActivityIndicator style={styles.centered} />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (!heatmap || heatmap.students.length === 0) return <Text style={styles.emptyText}>No mistake data yet</Text>;
  const maxCount = Math.max(...heatmap.students.flatMap((s) => heatmap.tags.map((t) => s.tag_counts[t] ?? 0)), 1);
  return (
    <ScrollView style={styles.panel}>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <HeatmapHeader tags={heatmap.tags} />
          {heatmap.students.map((student) => (
            <HeatmapRow key={student.student_id} student={student} tags={heatmap.tags}
              maxCount={maxCount} classroomId={classroomId} navigation={navigation} />
          ))}
          <HeatmapTotalRow tags={heatmap.tags} tagTotals={heatmap.tag_totals} />
        </View>
      </ScrollView>
    </ScrollView>
  );
}

function HeatmapHeader({ tags }: { tags: string[] }) {
  return (
    <View style={styles.heatmapRow}>
      <View style={styles.nameCell}><Text style={styles.headerText}>Student</Text></View>
      {tags.map((tag) => (
        <View key={tag} style={styles.tagCell}><Text style={styles.tagHeader}>{TAG_ABBREV[tag] ?? tag.slice(0, 4)}</Text></View>
      ))}
      <View style={styles.tagCell}><Text style={styles.tagHeader}>Total</Text></View>
    </View>
  );
}

function HeatmapRow({ student, tags, maxCount, classroomId, navigation }: {
  student: { student_id: string; display_name: string; tag_counts: Record<string, number>; total: number };
  tags: string[]; maxCount: number; classroomId: string; navigation: any;
}) {
  return (
    <TouchableOpacity style={styles.heatmapRow} onPress={() => navigation.navigate("StudentMistakeDetail", {
      classroomId, studentId: student.student_id, displayName: student.display_name || "Student",
    })}>
      <View style={styles.nameCell}>
        <Text style={styles.nameText} numberOfLines={1}>{student.display_name || "Unnamed"}</Text>
      </View>
      {tags.map((tag) => {
        const count = student.tag_counts[tag] ?? 0;
        return (
          <View key={tag} style={[styles.tagCell, { backgroundColor: cellColor(count, maxCount) }]}>
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
  return (
    <View style={[styles.heatmapRow, styles.totalRow]}>
      <View style={styles.nameCell}><Text style={styles.totalLabel}>Class Total</Text></View>
      {tags.map((tag) => (
        <View key={tag} style={styles.tagCell}><Text style={styles.totalText}>{tagTotals[tag] ?? 0}</Text></View>
      ))}
      <View style={styles.tagCell}><Text style={styles.totalText}>{grandTotal}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  subTabs: { flexDirection: "row", gap: 8, marginBottom: 12, alignItems: "center" },
  subTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: "#E5E7EB" },
  subTabActive: { backgroundColor: "#4F46E5" },
  subTabText: { fontWeight: "600", color: "#374151", fontSize: 14 },
  subTabTextActive: { color: "#fff" },
  refreshBtn: { marginLeft: "auto", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#10B981" },
  refreshBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  panel: { flex: 1 },
  centered: { marginTop: 40 },
  errorText: { textAlign: "center", color: "#EF4444", marginTop: 20 },
  emptyText: { textAlign: "center", color: "#9CA3AF", marginTop: 20 },
  faqRow: { backgroundColor: "#fff", borderRadius: 8, padding: 12, marginBottom: 8 },
  faqHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  faqTopic: { fontSize: 15, fontWeight: "600", color: "#111827" },
  faqStat: { fontSize: 13, color: "#6B7280" },
  barBg: { height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, marginBottom: 4 },
  barFill: { height: 8, backgroundColor: "#4F46E5", borderRadius: 4 },
  faqCount: { fontSize: 12, color: "#9CA3AF" },
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
});
