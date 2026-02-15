import React from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
} from "react-native";
import { Solution } from "../types";

interface Props {
  solutions: Solution[];
  onChange: (solutions: Solution[]) => void;
}

export function SolutionEditor({ solutions, onChange }: Props) {
  const addSolution = () => {
    const existingNums = new Set(solutions.map((s) => s.num));
    let nextNum = 1;
    while (existingNums.has(nextNum)) nextNum++;
    onChange([...solutions, { num: nextNum, solution_tex: "" }]);
  };

  const updateTex = (index: number, tex: string) => {
    const updated = solutions.map((s, i) => (i === index ? { ...s, solution_tex: tex } : s));
    onChange(updated);
  };

  const removeSolution = (index: number) => {
    onChange(solutions.filter((_, i) => i !== index));
  };

  return (
    <View>
      {solutions.map((solution, index) => (
        <View key={solution.num} style={styles.row}>
          <Text style={styles.numLabel}>#{solution.num}</Text>
          <TextInput
            style={styles.texInput}
            placeholder="LaTeX solution (e.g. x = 4)"
            value={solution.solution_tex}
            onChangeText={(tex) => updateTex(index, tex)}
            multiline
          />
          <TouchableOpacity style={styles.removeBtn} onPress={() => removeSolution(index)}>
            <Text style={styles.removeBtnText}>X</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.addBtn} onPress={addSolution}>
        <Text style={styles.addBtnText}>+ Add Solution</Text>
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
