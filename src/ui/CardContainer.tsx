import React, { ReactNode } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  variant?: "elevated" | "flat";
  noMargin?: boolean;
};

export default function CardContainer({
  children,
  style,
  variant = "elevated",
  noMargin = false,
}: Props) {
  return (
    <View
      style={[
        styles.base,
        variant === "elevated" && styles.elevated,
        noMargin && styles.noMargin,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },

  elevated: {
    // iOS shadow
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },

    // Android shadow
    elevation: 3,
  },

  noMargin: {
    marginBottom: 0,
  },
});