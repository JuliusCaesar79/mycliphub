import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import {
  addDaysStart,
  clamp,
  minutesSinceStartOfDay,
  roundToStep,
  shortDowLabel,
  startOfDayMs,
} from "../utils/timeMath";
import NowIndicator from "../components/NowIndicator";
import DraggableWeekEventBlock from "./DraggableWeekEventBlock"; // ✅ path da confermare (vedi nota sotto)

type RawEv = {
  id: string;
  title: string;
  status: "todo" | "doing" | "done";
  startMin: number;
  endMin: number;
  top: number;
  height: number;
};

type Positioned = {
  id: string;
  title: string;
  status: "todo" | "doing" | "done";
  dayIndex: number; // 0..6
  top: number;
  height: number;
  column: number;
  totalColumns: number;

  // ✅ needed for commit (keep duration stable)
  startMin: number;
  endMin: number;
};

function statusColors(status: "todo" | "doing" | "done", accent: string) {
  return {
    borderColor: status === "done" ? "#16A34A" : status === "doing" ? accent : "#F59E0B",
    backgroundColor: status === "done" ? "#ECFDF5" : status === "doing" ? "#EFF6FF" : "#FFFBEB",
  };
}

/**
 * ✅ Overlap layout "per gruppi":
 * - crea gruppi di eventi che si sovrappongono (anche a catena)
 * - dentro ogni gruppo assegna colonne con greedy (interval graph coloring)
 * - totalColumns = numero colonne realmente usate nel gruppo
 */
function layoutDay(raw: RawEv[], dayIndex: number): Positioned[] {
  if (!raw.length) return [];

  const out: Positioned[] = [];

  const groups: RawEv[][] = [];
  let current: RawEv[] = [];
  let currentMaxEnd = -1;

  for (const ev of raw) {
    if (!current.length) {
      current = [ev];
      currentMaxEnd = ev.endMin;
      continue;
    }

    if (ev.startMin < currentMaxEnd) {
      current.push(ev);
      currentMaxEnd = Math.max(currentMaxEnd, ev.endMin);
    } else {
      groups.push(current);
      current = [ev];
      currentMaxEnd = ev.endMin;
    }
  }
  if (current.length) groups.push(current);

  for (const g of groups) {
    const colEnd: number[] = [];
    const placed = g.map((ev) => {
      let col = 0;
      while (col < colEnd.length && ev.startMin < colEnd[col]) col++;
      if (col === colEnd.length) colEnd.push(ev.endMin);
      else colEnd[col] = ev.endMin;

      return { ev, column: col };
    });

    const totalColumns = Math.max(1, colEnd.length);

    for (const p of placed) {
      out.push({
        id: p.ev.id,
        title: p.ev.title,
        status: p.ev.status,
        dayIndex,
        top: p.ev.top,
        height: p.ev.height,
        column: p.column,
        totalColumns,
        startMin: p.ev.startMin,
        endMin: p.ev.endMin,
      });
    }
  }

  return out;
}

export default function WeekGrid({
  C,
  weekStart,
  eventsForDayIndex,
  onPressEvent,
  onLongPressEvent,
  onTapCreate,

  // ✅ NEW: commit move across days
  onCommitMoveEvent,
}: {
  C: { deep: string; muted: string; white: string; accent: string };
  weekStart: number;
  eventsForDayIndex: (i: number) => any[];
  onPressEvent: (id: string) => void;
  onLongPressEvent: (id: string) => void;
  onTapCreate: (dayIndex: number, minute: number) => void;

  onCommitMoveEvent: (id: string, nextDayIndex: number, nextStartMin: number, nextEndMin: number) => void;
}) {
  const HOUR_HEIGHT = 56;
  const MINUTE_HEIGHT = HOUR_HEIGHT / 60;

  const baseLeft = 48;
  const gutter = 4;

  // UX readability guards
  const MIN_EVENT_PX = 22;
  const MIN_EVENT_W = 26;

  const [innerW, setInnerW] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const hours = useMemo(() => Array.from({ length: 24 }).map((_, i) => i), []);

  const todayStart = useMemo(() => startOfDayMs(Date.now()), []);
  const todayKey = useMemo(() => String(new Date(todayStart).toDateString()), [todayStart]);

  const dayColW = useMemo(() => {
    const avail = Math.max(0, innerW - baseLeft - 8);
    return avail / 7;
  }, [innerW]);

  const positioned = useMemo((): Positioned[] => {
    const out: Positioned[] = [];

    for (let i = 0; i < 7; i++) {
      const dayStart = addDaysStart(weekStart, i);
      const dayEnd = addDaysStart(dayStart, 1);

      const raw: RawEv[] = (eventsForDayIndex(i) ?? [])
        .filter((e) => !e?.allDay)
        .map((e) => {
          const startAt = Number(e.startAt ?? 0);
          const endAtRaw = e.endAt == null ? startAt + 60 * 60 * 1000 : Number(e.endAt);

          const startMin = clamp(minutesSinceStartOfDay(Math.max(startAt, dayStart), dayStart), 0, 24 * 60);
          const endMin = clamp(minutesSinceStartOfDay(Math.min(endAtRaw, dayEnd), dayStart), 0, 24 * 60);

          const dur = Math.max(15, endMin - startMin);
          const status = String(e.status ?? "todo") as any;

          return {
            id: String(e.id),
            title: String(e.title ?? ""),
            status,
            startMin,
            endMin: startMin + dur,
            top: startMin * MINUTE_HEIGHT,
            height: Math.max(MIN_EVENT_PX, dur * MINUTE_HEIGHT),
          };
        })
        .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

      out.push(...layoutDay(raw, i));
    }

    return out;
  }, [weekStart, eventsForDayIndex, MINUTE_HEIGHT]);

  return (
    <View style={s.card}>
      <Text style={[s.title, { color: C.deep }]}>Week grid</Text>

      {/* Header giorni */}
      <View style={s.weekHeaderRow}>
        <View style={{ width: baseLeft }} />
        {Array.from({ length: 7 }).map((_, i) => {
          const d0 = addDaysStart(weekStart, i);
          const isToday = String(new Date(d0).toDateString()) === todayKey;

          return (
            <View
              key={i}
              style={[
                s.dayHead,
                { width: dayColW || 44 },
                isToday && { backgroundColor: "#00000008", borderRadius: 12, paddingVertical: 6 },
              ]}
            >
              <Text style={[s.dow, { color: isToday ? C.deep : C.muted }]}>{shortDowLabel(d0).toUpperCase()}</Text>
              <Text style={[s.dom, { color: C.deep }]}>{String(new Date(d0).getDate()).padStart(2, "0")}</Text>
            </View>
          );
        })}
      </View>

      <ScrollView
        style={{ marginTop: 10, height: 24 * HOUR_HEIGHT }}
        contentContainerStyle={{ paddingBottom: 10 }}
        showsVerticalScrollIndicator
        nestedScrollEnabled
      >
        <View style={{ height: 24 * HOUR_HEIGHT, position: "relative" }} onLayout={(e) => setInnerW(e.nativeEvent.layout.width)}>
          {/* Tap layer: crea evento su giorno + ora */}
          {!isDragging ? (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={(e) => {
                const x = e.nativeEvent.locationX;
                const y = e.nativeEvent.locationY;

                const safeW = Math.max(1, dayColW);
                const dayIndex = clamp(Math.floor((x - baseLeft) / safeW), 0, 6);

                const rawMin = clamp(Math.floor(y / MINUTE_HEIGHT), 0, 24 * 60 - 15);
                const snapped = clamp(roundToStep(rawMin, 15), 0, 24 * 60 - 15);

                onTapCreate(dayIndex, snapped);
              }}
            />
          ) : null}

          {/* righe ore */}
          {hours.map((h) => (
            <View key={h} style={[s.hourRow, { height: HOUR_HEIGHT }]}>
              <Text style={[s.hourLabel, { color: C.muted }]}>{String(h).padStart(2, "0")}</Text>
              <View style={s.hourLineWrap}>
                <View style={[s.hourLine, { backgroundColor: "#00000012" }]} />
              </View>
            </View>
          ))}

          {/* Now indicator */}
          <NowIndicator dayStart={weekStart} hourHeight={HOUR_HEIGHT} baseLeft={baseLeft} />

          {/* eventi (draggable) */}
          {positioned.map((p) => {
            const cols = Math.max(1, p.totalColumns || 1);
            const usableW = Math.max(0, dayColW - gutter * (cols - 1));
            const w = Math.max(MIN_EVENT_W, usableW / cols);

            const dayLeft = baseLeft + p.dayIndex * dayColW;
            const left = dayLeft + p.column * (w + gutter);

            const col = statusColors(p.status, C.accent);

            return (
              <DraggableWeekEventBlock
                key={`${p.dayIndex}-${p.id}-${p.top}`}
                id={p.id}
                title={p.title}
                status={p.status}
                dayIndex={p.dayIndex}
                totalColumns={p.totalColumns}
                top={p.top}
                height={p.height}
                left={left}
                width={w}
                baseLeft={baseLeft}
                dayColW={dayColW || 44}
                minuteHeight={MINUTE_HEIGHT}
                gutter={gutter}
                startMin={p.startMin}
                endMin={p.endMin}
                borderColor={col.borderColor}
                backgroundColor={col.backgroundColor}
                textColor={C.deep}
                onPress={onPressEvent}
                onLongPressMenu={onLongPressEvent}
                onSetDragging={setIsDragging}
                onCommitMove={(id, nextDayIndex, nextStartMin, nextEndMin) => {
                  onCommitMoveEvent(id, nextDayIndex, nextStartMin, nextEndMin);
                }}
              />
            );
          })}
        </View>
      </ScrollView>

      <Text style={[s.hint, { color: C.muted }]}>Tap to create • Drag to move across days • Long press for quick actions.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    padding: 12,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#00000010",
    backgroundColor: "#FFFFFF",
  },
  title: { fontSize: 13, fontWeight: "900" },

  weekHeaderRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  dayHead: { alignItems: "center", justifyContent: "center", minHeight: 38 },
  dow: { fontSize: 11, fontWeight: "900" },
  dom: { fontSize: 12, fontWeight: "900" },

  hourRow: { flexDirection: "row", alignItems: "center" },
  hourLabel: { width: 48, fontSize: 11, fontWeight: "800" },
  hourLineWrap: { flex: 1 },
  hourLine: { height: 1, width: "100%" },

  hint: { marginTop: 10, fontSize: 12, fontWeight: "700" },
});