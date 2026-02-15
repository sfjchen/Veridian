import React, { useState } from "react";
import { StyleSheet } from "react-native";
import { alert } from "../lib/alert";
import { Button, Input, Row } from "./ui";
import { spacing } from "../constants/spacing";

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
      alert("Invalid Code", `Class code must be ${CLASS_CODE_LENGTH} characters`);
      return;
    }
    if (!CLASS_CODE_PATTERN.test(trimmed)) {
      alert("Invalid Code", "Class code must contain only letters and numbers");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(trimmed);
      setCode("");
    } catch (e: unknown) {
      alert("Error", e instanceof Error ? e.message : "Failed to join");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Row gap={spacing.sm} style={styles.row}>
      <Input
        placeholder="Enter class code"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        maxLength={CLASS_CODE_LENGTH}
        containerStyle={styles.inputWrap}
        style={styles.inputText}
      />
      <Button onPress={handleSubmit} disabled={loading} loading={loading}>
        Join
      </Button>
    </Row>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: spacing.xs },
  inputWrap: { flex: 1, marginBottom: 0 },
  inputText: { textAlign: "center", letterSpacing: 4, fontSize: 18 },
});
