import React, { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

type Status = "todo" | "doing" | "done";

type Props = {
  id: string;
  title: string;
  status: Status;

  // layout from WeekGrid
  top: number; // px (minuteHeight * startMin)
  height: number; // px (duration * minuteHeight) with min
  left: number; // px (baseLeft + dayIndex * dayColW + ...)

  width: number; // px
  dayIndex: number; // 0..6
  totalColumns: number; // overlap cols in that day (for width calc in parent)

  // grid metrics
  baseLeft: number;
  dayColW: number;
  minuteHeight: number; // px per minute
  gutter: number;

  // minutes
  startMin: number;
  endMin: number;

  // colors
  borderColor: string;
  backgroundColor: string;
  textColor: string;

  // interactions
  onPress: (id: string) => void;
  onLongPressMenu: (id: string) => void;

  onSetDragging: (dragging: boolean) => void;
  onCommitMove: (id: string, nextDayIndex: number, nextStartMin: number, nextEndMin: number) => void;
};

export default function DraggableWeekEventBlock({
  id,
  title,
  status,

  top,
  height,
  left,
  width,
  dayIndex,

  baseLeft,
  dayColW,
  minuteHeight,
  gutter,

  startMin,
  endMin,

  borderColor,
  backgroundColor,
  textColor,

  onPress,
  onLongPressMenu,
  onSetDragging,
  onCommitMove,
}: Props) {
  // ✅ Worklet-safe snapping
  const snap15 = (min: number) => {
    "worklet";
    return Math.round(min / 15) * 15;
  };

  const durMin = useMemo(() => Math.max(15, endMin - startMin), [startMin, endMin]);

  // shared
  const x = useSharedValue(left);
  const y = useSharedValue(top);
  const w = useSharedValue(width);
  const h = useSharedValue(height);

  const active = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // anchors
  const startX = useSharedValue(left);
  const startY = useSharedValue(top);

  // keep in sync from parent updates (store refresh, filters, etc.)
  useEffect(() => {
    x.value = left;
    y.value = top;
    w.value = width;
    h.value = height;
    startX.value = left;
    startY.value = top;
  }, [left, top, width, height, x, y, w, h, startX, startY]);

  const boxStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: x.value }, { translateY: y.value }],
      width: w.value,
      height: h.value,
      shadowOpacity: withTiming(active.value ? 0.35 : 0),
      elevation: active.value ? 12 : 0,
    };
  });

  // --- gesture: long press to arm + pan 2D ---
  const longPress = Gesture.LongPress()
    .minDuration(180)
    .onStart(() => {
      active.value = 1;
      isDragging.value = true;
      runOnJS(onSetDragging)(true);
    });

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      if (!active.value) return;

      // raw positions
      const rawX = startX.value + e.translationX;
      const rawY = startY.value + e.translationY;

      // clamp X within week columns area
      const minX = baseLeft; // first column start
      const maxX = baseLeft + dayColW * 6; // last column start
      const clampedX = Math.max(minX, Math.min(maxX, rawX));

      // compute dayIndex from X (round to nearest column)
      const idx = Math.round((clampedX - baseLeft) / Math.max(1, dayColW));
      const nextDayIndex = Math.max(0, Math.min(6, idx));

      // snap X to the chosen column start
      const snappedX = baseLeft + nextDayIndex * dayColW;

      // Y => minute
      const rawMin = rawY / Math.max(0.0001, minuteHeight);
      const clampedStartMin = Math.max(0, Math.min(24 * 60 - durMin, snap15(rawMin)));

      y.value = clampedStartMin * minuteHeight;
      x.value = snappedX;

      // keep size stable
      w.value = width;
      h.value = height;
    })
    .onEnd(() => {
      if (!active.value) return;

      // finalize mins
      const nextStartMin = Math.round(y.value / Math.max(0.0001, minuteHeight));
      const snappedStartMin = Math.max(0, Math.min(24 * 60 - durMin, snap15(nextStartMin)));
      const snappedEndMin = snappedStartMin + durMin;

      // finalize dayIndex from X
      const idx = Math.round((x.value - baseLeft) / Math.max(1, dayColW));
      const nextDayIndex = Math.max(0, Math.min(6, idx));

      // animate to final snapped positions
      x.value = withTiming(baseLeft + nextDayIndex * dayColW);
      y.value = withTiming(snappedStartMin * minuteHeight);

      active.value = 0;
      isDragging.value = false;

      runOnJS(onSetDragging)(false);
      runOnJS(onCommitMove)(id, nextDayIndex, snappedStartMin, snappedEndMin);
    })
    .onFinalize(() => {
      if (active.value) active.value = 0;
      if (isDragging.value) isDragging.value = false;
      runOnJS(onSetDragging)(false);
    });

  const gesture = Gesture.Simultaneous(longPress, pan);

  // JS press handlers: block while dragging
  const handlePress = () => {
    if (isDragging.value) return;
    onPress(id);
  };

  const handleLongPressMenu = () => {
    if (isDragging.value) return;
    onLongPressMenu(id);
  };

  return (
    <Animated.View
      style={[
        styles.box,
        { borderColor, backgroundColor },
        boxStyle,
      ]}
    >
      <GestureDetector gesture={gesture}>
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPressMenu}
          delayLongPress={450}
          android_ripple={{ color: "#00000010" }}
          style={{ flex: 1 }}
        >
          <Text numberOfLines={2} style={[styles.title, { color: textColor }]}>
            {title}
          </Text>
        </Pressable>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: "absolute",
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    overflow: "hidden",
    shadowColor: "#000",
    shadowRadius: 10,
  },
  title: {
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 12,
  },
});