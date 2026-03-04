import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { clamp, minutesSinceStartOfDay, isSameDay, formatTime } from "../utils/timeMath";

export default function NowIndicator({
  dayStart,
  hourHeight,
  baseLeft,
  color = "#EF4444",
  textColor = "#EF4444",
}: {
  dayStart: number;
  hourHeight: number;
  baseLeft: number;
  color?: string;
  textColor?: string;
}) {
  const minuteHeight = hourHeight / 60;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const visible = useMemo(() => isSameDay(now, dayStart), [now, dayStart]);
  const top = useMemo(() => {
    const m = clamp(minutesSinceStartOfDay(now, dayStart), 0, 24 * 60);
    return m * minuteHeight;
  }, [now, dayStart, minuteHeight]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { top, left: baseLeft }]}>
      <View style={[styles.line, { backgroundColor: color }]} />
      <View style={[styles.pill, { borderColor: color }]}>
        <Text style={[styles.pillText, { color: textColor }]}>{formatTime(now)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 8, height: 1, justifyContent: "center" },
  line: { height: 2, width: "100%", borderRadius: 999 },
  pill: {
    position: "absolute",
    left: 0,
    top: -12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
  },
  pillText: { fontWeight: "900", fontSize: 10 },
});