import React, { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "../../constants/spacing";

interface RowProps {
  children: ReactNode;
  gap?: number;
  style?: object;
}

export function Row({ children, gap = spacing.sm, style }: RowProps) {
  return <View style={[styles.row, { gap }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});
