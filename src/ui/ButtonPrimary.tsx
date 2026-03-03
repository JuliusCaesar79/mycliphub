import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import Icon from "./Icon";
import { Colors } from "../app/theme";

type Props = {
  title: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Icon>["name"];
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export default function ButtonPrimary({
  title,
  onPress,
  icon,
  disabled = false,
  style,
  textStyle,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {icon && <Icon name={icon} size={18} color="#fff" style={styles.icon} />}
      <Text style={[styles.text, textStyle]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    backgroundColor: "#9CA3AF",
  },
  text: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  icon: {
    marginRight: 8,
  },
});