import React from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
} from "react-native";
import { Problem } from "../types";

interface Props {
  problems: Problem[];
  onChange: (problems: Problem[]) => void;
}

export function ProblemEditor({ problems, onChange }: Props) {
  const addProblem = () => {
    const existingNums = new Set(problems.map((p) => p.num));
    let nextNum = 1;
    while (existingNums.has(nextNum)) nextNum++;
    onChange([...problems, { num: nextNum, statement_tex: "" }]);
  };

  const updateTex = (index: number, tex: string) => {
    const updated = problems.map((p, i) => (i === index ? { ...p, statement_tex: tex } : p));
    onChange(updated);
  };

  const removeProblem = (index: number) => {
    onChange(problems.filter((_, i) => i !== index));
  };

  return (
    <View>
      {problems.map((problem, index) => (
        <View key={problem.num} style={styles.row}>
          <Text style={styles.numLabel}>#{problem.num}</Text>
          <TextInput
            style={styles.texInput}
            placeholder="LaTeX statement (e.g. 2x + 5 = 13)"
            value={problem.statement_tex}
            onChangeText={(tex) => updateTex(index, tex)}
            multiline
          />
          <TouchableOpacity style={styles.removeBtn} onPress={() => removeProblem(index)}>
            <Text style={styles.removeBtnText}>X</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.addBtn} onPress={addProblem}>
        <Text style={styles.addBtnText}>+ Add Problem</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 8,
  },
  numLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginTop: 14,
    minWidth: 28,
  },
  texInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 44,
    fontFamily: "monospace",
  },
  removeBtn: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  removeBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EF4444",
  },
  addBtn: {
    paddingVertical: 12,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4F46E5",
  },
});
