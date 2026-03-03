import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import Icon from "./Icon";
import { Colors } from "../app/theme";

type Variant = "soft" | "solid";

type Tone =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "muted";

type Props = {
  label: string;
  tone?: Tone;
  variant?: Variant;
  icon?: React.ComponentProps<typeof Icon>["name"];
  style?: ViewStyle;
  textStyle?: TextStyle;
};

function toneColors(tone: Tone) {
  switch (tone) {
    case "primary":
      return { bg: Colors.primary, softBg: "#E8F0FF", fg: "#FFFFFF", softFg: Colors.primary };
    case "success":
      return { bg: "#16A34A", softBg: "#DCFCE7", fg: "#FFFFFF", softFg: "#166534" };
    case "warning":
      return { bg: "#F59E0B", softBg: "#FEF3C7", fg: "#111827", softFg: "#92400E" };
    case "danger":
      return { bg: "#DC2626", softBg: "#FEE2E2", fg: "#FFFFFF", softFg: "#991B1B" };
    case "muted":
      return { bg: "#6B7280", softBg: "#F3F4F6", fg: "#FFFFFF", softFg: "#374151" };
    case "default":
    default:
      return { bg: "#111827", softBg: "#E5E7EB", fg: "#FFFFFF", softFg: "#111827" };
  }
}

export default function Badge({
  label,
  tone = "default",
  variant = "soft",
  icon,
  style,
  textStyle,
}: Props) {
  const c = toneColors(tone);
  const isSoft = variant === "soft";

  const bg = isSoft ? c.softBg : c.bg;
  const fg = isSoft ? c.softFg : c.fg;

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {icon && <Icon name={icon} size={14} color={fg} style={styles.icon} />}
      <Text style={[styles.text, { color: fg }, textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  text: {
    fontSize: 12,
    fontWeight: "800",
  },
  icon: {
    marginRight: 6,
  },
});