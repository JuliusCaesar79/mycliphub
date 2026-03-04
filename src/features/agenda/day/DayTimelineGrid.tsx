import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import Icon from "../../../ui/Icon";
import NowIndicator from "../components/NowIndicator";
import DraggableEventBlock from "./DraggableEventBlock";
import { addDaysStart, clamp, minutesSinceStartOfDay, roundToStep } from "../utils/timeMath";

type PositionedEvent = {
  id: string;
  title: string;
  status: "todo" | "doing" | "done";
  startMin: number;
  endMin: number;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
};

function statusColors(status: "todo" | "doing" | "done", accent: string) {
  return {
    borderColor: status === "done" ? "#16A34A" : status === "doing" ? accent : "#F59E0B",
    backgroundColor: status === "done" ? "#ECFDF5" : status === "doing" ? "#EFF6FF" : "#FFFBEB",
  };
}

export default function DayTimelineGrid({
  C,
  dayStart,
  events,
  onPressEvent,
  onLongPressEvent,
  onTapCreateAtMinutes,
  onCommitMoveResize,
}: {
  C: { deep: string; muted: string; white: string; accent: string; background: string };
  dayStart: number;
  events: any[];
  onPressEvent: (id: string) => void;
  onLongPressEvent: (id: string) => void;
  onTapCreateAtMinutes: (min: number) => void;
  onCommitMoveResize: (id: string, startMin: number, endMin: number) => void;
}) {
  const { height: winH } = useWindowDimensions();

  const HOUR_HEIGHT = 72;
  const MINUTE_HEIGHT = HOUR_HEIGHT / 60;

  const hours = useMemo(() => Array.from({ length: 24 }).map((_, i) => i), []);
  const dayEndExclusive = useMemo(() => addDaysStart(dayStart, 1), [dayStart]);

  const scrollRef = useRef<ScrollView>(null);

  const scrollHeight = useMemo(() => {
    const fullDayPx = 24 * HOUR_HEIGHT;
    const target = Math.floor(winH * 0.55);
    return clamp(target, 360, fullDayPx);
  }, [winH]);

  const [innerWidth, setInnerWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const allDayEvents = useMemo(() => (events ?? []).filter((e) => !!e?.allDay), [events]);

  const positioned: PositionedEvent[] = useMemo(() => {
    const raw = (events ?? [])
      .filter((e) => !e?.allDay)
      .map((e) => {
        const startAt = Number(e.startAt ?? 0);
        const endAtRaw = e.endAt == null ? startAt + 60 * 60 * 1000 : Number(e.endAt);

        const clampedStartMin = clamp(
          minutesSinceStartOfDay(Math.max(startAt, dayStart), dayStart),
          0,
          24 * 60
        );
        const clampedEndMin = clamp(
          minutesSinceStartOfDay(Math.min(endAtRaw, dayEndExclusive), dayStart),
          0,
          24 * 60
        );

        const durMin = Math.max(15, clampedEndMin - clampedStartMin);
        const status = String(e.status ?? "todo") as "todo" | "doing" | "done";

        return {
          id: String(e.id),
          title: String(e.title ?? ""),
          status,
          startMin: clampedStartMin,
          endMin: clampedStartMin + durMin,
          top: clampedStartMin * MINUTE_HEIGHT,
          height: durMin * MINUTE_HEIGHT,
        };
      })
      .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

    // greedy columns
    const colEnd: number[] = [];
    const withCol = raw.map((ev) => {
      let col = 0;
      while (col < colEnd.length && ev.startMin < colEnd[col]) col++;
      if (col === colEnd.length) colEnd.push(ev.endMin);
      else colEnd[col] = ev.endMin;
      return { ...ev, column: col, totalColumns: 1 } as PositionedEvent;
    });

    // totalColumns per overlap cluster
    return withCol.map((ev) => {
      const overlapping = withCol.filter((o) => !(ev.endMin <= o.startMin || ev.startMin >= o.endMin));
      const maxCol = Math.max(...overlapping.map((o) => o.column));
      return { ...ev, totalColumns: maxCol + 1 };
    });
  }, [events, dayStart, dayEndExclusive, MINUTE_HEIGHT]);

  // Auto-scroll
  useEffect(() => {
    const y = positioned.length > 0 ? Math.max(0, positioned[0].top - 2 * HOUR_HEIGHT) : 8 * HOUR_HEIGHT;
    const id = requestAnimationFrame(() => scrollRef.current?.scrollTo({ y, animated: true }));
    return () => cancelAnimationFrame(id);
  }, [dayStart, positioned.length]);

  const baseLeft = 56 + 10;
  const rightPad = 8;
  const gutter = 6;

  return (
    <View style={s.timelineCard}>
      <View style={s.timelineHeaderRow}>
        <Text style={[s.timelineTitle, { color: C.deep }]}>Timeline • 00–24</Text>

        {allDayEvents.length ? (
          <View style={s.allDayBadge}>
            <Icon name="sunny-outline" size={14} color={C.deep} />
            <Text style={[s.allDayBadgeText, { color: C.deep }]}>{`All-day: ${allDayEvents.length}`}</Text>
          </View>
        ) : null}
      </View>

      {allDayEvents.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.allDayRow}>
          {allDayEvents.map((e: any) => {
            const st = String(e.status ?? "todo") as "todo" | "doing" | "done";
            const col = statusColors(st, C.accent);

            return (
              <Pressable
                key={String(e.id)}
                onPress={() => onPressEvent(String(e.id))}
                onLongPress={() => onLongPressEvent(String(e.id))}
                android_ripple={{ color: "#00000010" }}
                style={[s.allDayPill, { borderColor: col.borderColor, backgroundColor: col.backgroundColor }]}
              >
                <Text numberOfLines={1} style={[s.allDayPillTitle, { color: C.deep }]}>
                  {String(e.title ?? "")}
                </Text>
                <Text style={[s.allDayPillSub, { color: C.muted }]}>{String(st).toUpperCase()} • 24H</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={[s.timelineScroll, { height: scrollHeight }]}
        contentContainerStyle={{ paddingBottom: 8 }}
        showsVerticalScrollIndicator
        nestedScrollEnabled
        scrollEnabled={!isDragging}
      >
        <View
          style={{ position: "relative", height: 24 * HOUR_HEIGHT }}
          onLayout={(e) => setInnerWidth(e.nativeEvent.layout.width)}
        >
          {/* Tap layer */}
          <Pressable
            style={StyleSheet.absoluteFill}
            android_ripple={{ color: "#00000008" }}
            onPress={(e) => {
              const y = e.nativeEvent.locationY;
              const rawMin = clamp(Math.floor(y / MINUTE_HEIGHT), 0, 24 * 60 - 15);
              const snapped = clamp(roundToStep(rawMin, 15), 0, 24 * 60 - 15);
              onTapCreateAtMinutes(snapped);
            }}
          />

          {hours.map((h) => (
            <View key={h} style={[s.hourRow, { height: HOUR_HEIGHT }]}>
              <Text style={[s.hourLabel, { color: C.muted }]}>{String(h).padStart(2, "0")}:00</Text>
              <View style={s.hourLineWrap}>
                <View style={[s.hourLine, { backgroundColor: "#00000012" }]} />
              </View>
            </View>
          ))}

          <NowIndicator dayStart={dayStart} hourHeight={HOUR_HEIGHT} baseLeft={baseLeft} />

          {/* Events (Reanimated/Gesture Handler) */}
          {positioned.map((p) => {
            const cols = Math.max(1, p.totalColumns || 1);
            const avail = Math.max(0, innerWidth - baseLeft - rightPad);
            const w = cols === 1 ? avail : Math.max(60, Math.floor((avail - gutter * (cols - 1)) / cols));
            const left = baseLeft + p.column * (w + gutter);

            const col = statusColors(p.status, C.accent);

            return (
              <DraggableEventBlock
                key={p.id}
                id={p.id}
                title={p.title}
                statusLabel={String(p.status).toUpperCase()}
                left={left}
                width={w}
                minuteHeight={MINUTE_HEIGHT}
                startMin={p.startMin}
                endMin={p.endMin}
                colorBorder={col.borderColor}
                colorBg={col.backgroundColor}
                textColor={C.deep}
                subColor={C.muted}
                onPress={(id) => onPressEvent(id)}
                onLongPress={(id) => onLongPressEvent(id)}
                onSetDragging={(v) => setIsDragging(v)}
                onCommit={(id, sMin, eMin) => onCommitMoveResize(id, sMin, eMin)}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  timelineCard: {
    padding: 12,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#00000010",
    backgroundColor: "#FFFFFF",
  },
  timelineHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timelineTitle: { fontSize: 13, fontWeight: "900" },

  allDayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#00000006",
    borderWidth: 1,
    borderColor: "#00000010",
  },
  allDayBadgeText: { fontSize: 12, fontWeight: "900" },

  allDayRow: { paddingTop: 10, paddingBottom: 2, gap: 10 },
  allDayPill: {
    minWidth: 160,
    maxWidth: 240,
    borderRadius: 999,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: "hidden",
  },
  allDayPillTitle: { fontSize: 12, fontWeight: "900" },
  allDayPillSub: { marginTop: 2, fontSize: 10, fontWeight: "800" },

  timelineScroll: { marginTop: 10 },

  hourRow: { flexDirection: "row", alignItems: "center" },
  hourLabel: { width: 56, fontSize: 12, fontWeight: "800" },
  hourLineWrap: { flex: 1, paddingLeft: 10 },
  hourLine: { height: 1, width: "100%" },
});