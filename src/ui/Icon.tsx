import React from "react";
import Ionicons from "react-native-vector-icons/Ionicons";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  style?: any;
};

export default function Icon({ name, size = 20, color = "#111827", style }: Props) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}