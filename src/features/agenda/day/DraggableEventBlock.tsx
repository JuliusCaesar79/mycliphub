import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

export default function DraggableEventBlock({
  id,
  title,
  statusLabel,
  left,
  width,
  minuteHeight,
  startMin,
  endMin,
  colorBorder,
  colorBg,
  textColor,
  subColor,
  onPress,
  onLongPress,
  onSetDragging,
  onCommit,
}: {
  id: string;
  title: string;
  statusLabel: string;

  left: number;
  width: number;
  minuteHeight: number;

  startMin: number;
  endMin: number;

  colorBorder: string;
  colorBg: string;
  textColor: string;
  subColor: string;

  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
  onSetDragging: (dragging: boolean) => void;
  onCommit: (id: string, nextStartMin: number, nextEndMin: number) => void;
}) {
  // ✅ Worklet-safe snapping (must be callable on UI thread)
  const snap15 = (min: number) => {
    "worklet";
    return Math.round(min / 15) * 15;
  };

  const durMin = useMemo(() => Math.max(15, endMin - startMin), [startMin, endMin]);

  // shared values
  const y = useSharedValue(startMin * minuteHeight);
  const h = useSharedValue(Math.max(15, durMin) * minuteHeight);
  const active = useSharedValue(0);

  // ✅ separate flag: dragging in progress (to block press/menu)
  const isDragging = useSharedValue(false);

  // anchor per drag (stabile)
  const startTop = useSharedValue(startMin * minuteHeight);

  // keep in sync when props change (e.g. store update)
  useEffect(() => {
    y.value = startMin * minuteHeight;
    h.value = Math.max(15, durMin) * minuteHeight;
    startTop.value = startMin * minuteHeight;
  }, [startMin, durMin, minuteHeight, y, h, startTop]);

  const boxStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: y.value }],
      height: h.value,
      shadowOpacity: withTiming(active.value ? 0.18 : 0),
      elevation: active.value ? 8 : 0,
    };
  });

  // ---- MOVE: long press to activate + pan ----
  // ✅ IMPORTANT: long press for drag must NOT open the quick menu
  const longPress = Gesture.LongPress()
    .minDuration(180)
    .onStart(() => {
      active.value = 1;
      isDragging.value = true;
      runOnJS(onSetDragging)(true);
    });

  const panMove = Gesture.Pan()
    .onBegin(() => {
      // fissiamo l'ancora al momento in cui inizia il pan
      startTop.value = y.value;
    })
    .onUpdate((e) => {
      if (!active.value) return;

      const rawTop = startTop.value + e.translationY;
      const rawMin = rawTop / minuteHeight;

      const nextStart = Math.max(0, Math.min(24 * 60 - durMin, snap15(rawMin)));
      y.value = nextStart * minuteHeight;
      // keep height stable while moving
      h.value = Math.max(15, durMin) * minuteHeight;
    })
    .onEnd(() => {
      if (!active.value) return;

      const nextStartMin = Math.round(y.value / minuteHeight);
      const snappedStart = Math.max(0, Math.min(24 * 60 - durMin, snap15(nextStartMin)));
      const snappedEnd = snappedStart + durMin;

      y.value = withTiming(snappedStart * minuteHeight);
      active.value = 0;
      isDragging.value = false;

      runOnJS(onSetDragging)(false);
      runOnJS(onCommit)(id, snappedStart, snappedEnd);
    })
    .onFinalize(() => {
      // safety
      if (active.value) {
        active.value = 0;
      }
      if (isDragging.value) {
        isDragging.value = false;
      }
      runOnJS(onSetDragging)(false);
    });

  const moveGesture = Gesture.Simultaneous(longPress, panMove);

  // ---- RESIZE: separate handle pan (no long press) ----
  const resizePan = Gesture.Pan()
    .onBegin(() => {
      active.value = 1;
      isDragging.value = true;
      runOnJS(onSetDragging)(true);
    })
    .onUpdate((e) => {
      const rawH = Math.max(15 * minuteHeight, Math.min(24 * 60 * minuteHeight, h.value + e.changeY));
      const rawDurMin = rawH / minuteHeight;

      const nextDur = Math.max(15, snap15(rawDurMin));
      const maxDur = 24 * 60 - startMin;
      const clampedDur = Math.min(maxDur, nextDur);

      h.value = clampedDur * minuteHeight;
    })
    .onEnd(() => {
      const nextDurMin = Math.round(h.value / minuteHeight);
      const snappedDur = Math.max(15, snap15(nextDurMin));
      const maxDur = 24 * 60 - startMin;
      const finalDur = Math.min(maxDur, snappedDur);

      h.value = withTiming(finalDur * minuteHeight);
      active.value = 0;
      isDragging.value = false;

      runOnJS(onSetDragging)(false);
      runOnJS(onCommit)(id, startMin, startMin + finalDur);
    })
    .onFinalize(() => {
      if (active.value) active.value = 0;
      if (isDragging.value) isDragging.value = false;
      runOnJS(onSetDragging)(false);
    });

  // ✅ JS handlers: block press/menu if drag is active
  const handlePress = () => {
    if (isDragging.value) return;
    onPress(id);
  };

  const handleLongPressMenu = () => {
    if (isDragging.value) return;
    onLongPress(id);
  };

  return (
    <Animated.View
      style={[
        styles.box,
        {
          left,
          width,
          borderColor: colorBorder,
          backgroundColor: colorBg,
        },
        boxStyle,
      ]}
    >
      <GestureDetector gesture={moveGesture}>
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPressMenu}
          delayLongPress={420} // ✅ menu più "intenzionale", non interferisce col drag (180ms)
          android_ripple={{ color: "#00000010" }}
          style={{ flex: 1 }}
        >
          <Text numberOfLines={1} style={[styles.title, { color: textColor }]}>
            {title}
          </Text>
          <Text style={[styles.sub, { color: subColor }]}>{statusLabel}</Text>
        </Pressable>
      </GestureDetector>

      <GestureDetector gesture={resizePan}>
        <View style={styles.resizeHandle}>
          <View style={styles.resizeBar} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: "absolute",
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    overflow: "hidden",
    shadowColor: "#000",
    shadowRadius: 10,
  },
  title: { fontSize: 12, fontWeight: "900" },
  sub: { marginTop: 2, fontSize: 10, fontWeight: "800" },
  resizeHandle: {
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  resizeBar: {
    width: 34,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#00000033",
  },
});