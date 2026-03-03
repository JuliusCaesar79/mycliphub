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

export default function ButtonSecondary({
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
      {icon && (
        <Icon
          name={icon}
          size={18}
          color={disabled ? "#9CA3AF" : Colors.primary}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.text,
          disabled && styles.textDisabled,
          textStyle,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    borderColor: "#D1D5DB",
  },
  text: {
    color: Colors.primary,
    fontWeight: "700",
    fontSize: 15,
  },
  textDisabled: {
    color: "#9CA3AF",
  },
  icon: {
    marginRight: 8,
  },
});