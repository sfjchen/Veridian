import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from "react-native";

const CLASS_CODE_LENGTH = 6;
const CLASS_CODE_PATTERN = /^[A-Z0-9]{6}$/;

interface Props {
  onSubmit: (code: string) => Promise<void>;
}

export function ClassCodeInput({ onSubmit }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== CLASS_CODE_LENGTH) {
      Alert.alert("Invalid Code", `Class code must be ${CLASS_CODE_LENGTH} characters`);
      return;
    }
    if (!CLASS_CODE_PATTERN.test(trimmed)) {
      Alert.alert("Invalid Code", "Class code must contain only letters and numbers");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(trimmed);
      setCode("");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Enter class code"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        maxLength={CLASS_CODE_LENGTH}
      />
      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Joining..." : "Join"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", gap: 12, marginVertical: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 8,
    padding: 14, fontSize: 18, letterSpacing: 4, textAlign: "center",
  },
  button: {
    backgroundColor: "#4F46E5", borderRadius: 8, paddingHorizontal: 24,
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
