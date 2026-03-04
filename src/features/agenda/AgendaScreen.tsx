import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  StyleSheet,
  SectionList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Calendar, DateData } from "react-native-calendars";

import { Colors } from "../../app/theme";
import { RootStackParamList } from "../../app/navigation";
import { useEventStore } from "../../core/storage/eventStore";
import { useCardStore } from "../../core/storage/cardStore";

import Icon from "../../ui/Icon";
import ButtonPrimary from "../../ui/ButtonPrimary";
import ButtonSecondary from "../../ui/ButtonSecondary";
import Badge from "../../ui/Badge";
import CardContainer from "../../ui/CardContainer";

import DayTimelineGrid from "./day/DayTimelineGrid";
import WeekGrid from "./week/WeekGrid";

import {
  addDaysStart,
  clamp,
  formatDayTitle,
  formatTime,
  startOfDayMs,
  startOfMonthMs,
  startOfWeekMonday,
  ymdKeyFromStart,
  ymKeyFromStart,
  shortDowLabel,
} from "./utils/timeMath";

type Props = NativeStackScreenProps<RootStackParamList, "Agenda">;

type ViewMode = "day" | "week" | "month";

function statusToBadge(status: "todo" | "doing" | "done") {
  switch (status) {
    case "done":
      return { label: "DONE", tone: "success" as const, icon: "checkmark-circle-outline" as const };
    case "doing":
      return { label: "DOING", tone: "primary" as const, icon: "refresh-outline" as const };
    case "todo":
    default:
      return { label: "TO-DO", tone: "warning" as const, icon: "ellipse-outline" as const };
  }
}

export default function AgendaScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const C = useMemo(() => {
    const anyColors = Colors as any;
    return {
      background: anyColors.background ?? "#F3F4F6",
      white: anyColors.white ?? "#FFFFFF",
      deep: anyColors.deep ?? "#0F172A",
      primary: anyColors.primary ?? "#2563EB",
      accent: anyColors.accent ?? (anyColors.primary ?? "#2563EB"),
      muted: anyColors.muted ?? "#7A7A7A",
      lightAccent: anyColors.lightAccent ?? "#DBEAFE",
    };
  }, []);

  const loadEventsForDay = useEventStore((s) => s.loadEventsForDay);
  const loadEventsForMonth = useEventStore((s) => s.loadEventsForMonth);
  const loadEventsForRange = useEventStore((s) => s.loadEventsForRange);

  const statusFilter = useEventStore((s) => s.statusFilter);
  const categoryFilter = useEventStore((s) => s.categoryFilter);
  const setStatusFilter = useEventStore((s) => s.setStatusFilter);
  const setCategoryFilter = useEventStore((s) => s.setCategoryFilter);
  const clearFilters = useEventStore((s) => s.clearFilters);

  const createEvent = useEventStore((s) => s.createEvent);
  const updateEvent = useEventStore((s) => s.updateEvent);
  const deleteEvent = useEventStore((s) => s.deleteEvent);
  const setLinkedCards = useEventStore((s) => s.setLinkedCards);

  const rev = useEventStore((s) => s.rev);
  const cards = useCardStore((s) => s.cards);

  const todayStart = useMemo(() => startOfDayMs(Date.now()), []);
  const [selectedDayStart, setSelectedDayStart] = useState<number>(todayStart);

  const selectedDateKey = useMemo(() => ymdKeyFromStart(selectedDayStart), [selectedDayStart]);
  const isTodaySelected = selectedDayStart === todayStart;

  const [viewMode, setViewMode] = useState<ViewMode>("day");

  const [visibleMonthStart, setVisibleMonthStart] = useState<number>(() => startOfMonthMs(todayStart));
  const visibleMonthKey = useMemo(() => ymKeyFromStart(visibleMonthStart), [visibleMonthStart]);

  const weekStart = useMemo(() => startOfWeekMonday(selectedDayStart), [selectedDayStart]);
  const weekEndExclusive = useMemo(() => addDaysStart(weekStart, 7), [weekStart]);

  const onCalendarDayPress = useCallback((day: DateData) => {
    const ms = startOfDayMs(new Date(day.dateString + "T00:00:00").getTime());
    setSelectedDayStart(ms);
  }, []);

  const onCalendarMonthChange = useCallback((m: DateData) => {
    const ms = startOfMonthMs(new Date(m.dateString + "T00:00:00").getTime());
    setVisibleMonthStart(ms);
  }, []);

  useEffect(() => {
    loadEventsForDay(selectedDayStart);
  }, [loadEventsForDay, selectedDayStart]);

  useEffect(() => {
    if (viewMode !== "week") return;
    loadEventsForRange(weekStart, weekEndExclusive);
  }, [viewMode, loadEventsForRange, weekStart, weekEndExclusive]);

  useEffect(() => {
    loadEventsForMonth(visibleMonthStart);
  }, [loadEventsForMonth, visibleMonthStart]);

  const events = useMemo(() => {
    void rev;
    const state = useEventStore.getState();
    return state.getEventsForDay(selectedDayStart);
  }, [rev, selectedDayStart, statusFilter, categoryFilter]);

  const eventsForDayStart = useCallback(
    (msStart: number) => {
      void rev;
      const state = useEventStore.getState();
      return state.getEventsForDay(msStart);
    },
    [rev]
  );

  const monthCounts = useMemo(() => {
    void rev;
    const state = useEventStore.getState();
    return state.getDaysWithEventsForMonth(visibleMonthStart);
  }, [rev, visibleMonthStart]);

  // ✅ Month: marker densità con multi-dot + “+N”
  const markedDates = useMemo(() => {
    const out: Record<string, any> = {};

    for (const dk of Object.keys(monthCounts)) {
      const count = Number((monthCounts as any)[dk] ?? 0);
      const dotsCount = clamp(count, 0, 3);
      const dots = Array.from({ length: dotsCount }).map(() => ({ color: C.accent }));

      out[dk] = {
        marked: count > 0,
        dots,
      };
    }

    const prev = out[selectedDateKey] ?? {};
    out[selectedDateKey] = {
      ...prev,
      selected: true,
      selectedColor: C.accent,
      marked: prev.marked ?? (monthCounts as any)[selectedDateKey] ? true : false,
      dots: prev.dots ?? [],
    };

    return out;
  }, [monthCounts, selectedDateKey, C.accent]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRightRow}>
          <Pressable
            onPress={() => navigation.navigate("Inbox")}
            android_ripple={{ color: "#00000010", borderless: true }}
            style={styles.headerChip}
            accessibilityRole="button"
            accessibilityLabel="Go to Inbox"
          >
            <Icon name="mail-outline" size={18} color={C.deep} />
            <Text style={[styles.headerChipText, { color: C.deep }]}>Inbox</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("Settings")}
            android_ripple={{ color: "#00000010", borderless: true }}
            style={styles.headerChip}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <Icon name="settings-outline" size={18} color={C.deep} />
            <Text style={[styles.headerChipText, { color: C.deep }]}>Settings</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation, C.deep]);

  const goPrevDay = useCallback(() => setSelectedDayStart((s) => addDaysStart(s, -1)), []);
  const goNextDay = useCallback(() => setSelectedDayStart((s) => addDaysStart(s, 1)), []);
  const goToday = useCallback(() => {
    setSelectedDayStart(todayStart);
    setVisibleMonthStart(startOfMonthMs(todayStart));
  }, [todayStart]);

  // ---- Create / Detail ----
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newAllDay, setNewAllDay] = useState(false);

  // ✅ minuti (STEP 2G tap-to-create serio)
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);

  const [endsNextDay, setEndsNextDay] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const openCreate = useCallback(() => {
    setNewTitle("");
    setNewNotes("");
    setNewCategory("");
    setNewAllDay(false);
    setStartHour(9);
    setStartMinute(0);
    setEndHour(10);
    setEndMinute(0);
    setEndsNextDay(false);
    setCreateOpen(true);
  }, []);

  const openCreateAt = useCallback(
    (dayStart: number, minuteOfDay: number) => {
      setNewTitle("");
      setNewNotes("");
      setNewCategory("");
      setNewAllDay(false);

      const sh = Math.floor(minuteOfDay / 60);
      const sm = minuteOfDay % 60;

      const defaultDur = 60;
      const endMin = clamp(minuteOfDay + defaultDur, 0, 24 * 60);

      const eh = Math.floor(endMin / 60);
      const em = endMin % 60;

      setSelectedDayStart(dayStart);
      setStartHour(sh);
      setStartMinute(sm);
      setEndHour(eh);
      setEndMinute(em);
      setEndsNextDay(false);

      setCreateOpen(true);
    },
    []
  );

  const doCreate = useCallback(async () => {
    const t = (newTitle ?? "").trim();
    if (!t.length) {
      Alert.alert("Missing title", "Please enter a title for the event.");
      return;
    }

    let startAt: number;
    let endAt: number;

    if (newAllDay) {
      startAt = selectedDayStart;
      endAt = addDaysStart(selectedDayStart, 1);
    } else {
      startAt = selectedDayStart + (startHour * 60 + startMinute) * 60 * 1000;
      const baseEnd = selectedDayStart + (endHour * 60 + endMinute) * 60 * 1000;
      endAt = endsNextDay ? baseEnd + 24 * 60 * 60 * 1000 : baseEnd;
    }

    const id = await createEvent({
      title: t,
      notes: (newNotes ?? "").trim() ? newNotes.trim() : null,
      startAt,
      endAt,
      allDay: newAllDay,
      status: "todo",
      category: (newCategory ?? "").trim() ? newCategory.trim() : null,
      linkedCardIds: [],
    });

    setCreateOpen(false);
    setDetailId(id);
    setDetailOpen(true);
  }, [
    createEvent,
    newTitle,
    newNotes,
    newCategory,
    selectedDayStart,
    startHour,
    startMinute,
    endHour,
    endMinute,
    endsNextDay,
    newAllDay,
  ]);

  const confirmDelete = useCallback(
    (id: string, title: string) => {
      Alert.alert("Delete event?", `This will permanently delete "${title}".`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteEvent(id);
            setDetailOpen(false);
            setDetailId(null);
          },
        },
      ]);
    },
    [deleteEvent]
  );

  const detail = useMemo(() => {
    void rev;
    if (!detailId) return null;
    const state = useEventStore.getState();
    return state.getEvent(detailId);
  }, [rev, detailId]);

  const linkedCardTitles = useMemo(() => {
    if (!detail?.cardIds?.length) return [];
    const map = new Map(cards.map((c) => [c.id, c.title]));
    return detail.cardIds.map((id: string) => ({ id, title: map.get(id) ?? "Untitled" }));
  }, [detail?.cardIds, cards]);

  const toggleDone = useCallback(async () => {
    if (!detail) return;
    const next = detail.status === "done" ? "todo" : "done";
    await updateEvent(detail.id, { status: next });
  }, [detail, updateEvent]);

  const quickLinkFirstCard = useCallback(async () => {
    if (!detail) return;
    const available = cards.filter((c) => !c.archived);
    if (!available.length) {
      Alert.alert("No cards", "Create a card first in Inbox.");
      return;
    }
    const firstId = available[0].id;
    const nextIds = detail.cardIds.includes(firstId) ? detail.cardIds : [...detail.cardIds, firstId];
    await setLinkedCards(detail.id, nextIds);
  }, [detail, cards, setLinkedCards]);

  // ✅ STEP 2G: menu rapido long press (MVP con Alert)
  const openQuickMenu = useCallback(
    (eventId: string) => {
      const state = useEventStore.getState();
      const ev = state.getEvent(eventId);
      if (!ev) return;

      Alert.alert("Quick actions", String(ev.title ?? ""), [
        {
          text: ev.status === "done" ? "Mark To-do" : "Mark Done",
          onPress: async () => {
            const next = ev.status === "done" ? "todo" : "done";
            await updateEvent(eventId, { status: next });
          },
        },
        {
          text: "Duplicate",
          onPress: async () => {
            const startAt = Number(ev.startAt ?? selectedDayStart);
            const endAt = ev.endAt == null ? null : Number(ev.endAt);
            const id = await createEvent({
              title: String(ev.title ?? "Untitled") + " (copy)",
              notes: ev.notes ?? null,
              startAt,
              endAt: endAt ?? (startAt + 60 * 60 * 1000),
              allDay: !!ev.allDay,
              status: "todo",
              category: ev.category ?? null,
              linkedCardIds: ev.cardIds ?? [],
            });
            setDetailId(id);
            setDetailOpen(true);
          },
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => confirmDelete(eventId, String(ev.title ?? "")),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [confirmDelete, createEvent, selectedDayStart, updateEvent]
  );

  const dayTitle = useMemo(() => formatDayTitle(selectedDayStart), [selectedDayStart]);
  const showClear = statusFilter !== "all" || (categoryFilter ?? "").trim().length > 0;

  // Week data for WeekGrid
  const eventsForDayIndex = useCallback(
    (i: number) => eventsForDayStart(addDaysStart(weekStart, i)),
    [eventsForDayStart, weekStart]
  );

  // ✅ STEP 2G FIX — Guard rails per commit drag/resize (evita start_at NULL / NaN)
  const commitMoveResize = useCallback(
    (id: string, startMinRaw: any, endMinRaw: any) => {
      const startMinN = Number(startMinRaw);
      const endMinN = Number(endMinRaw);

      if (!Number.isFinite(startMinN) || !Number.isFinite(endMinN)) {
        console.warn("[Agenda] commitMoveResize invalid minutes:", { id, startMinRaw, endMinRaw });
        return;
      }

      // clamp safe range
      const startMin = clamp(Math.round(startMinN), 0, 24 * 60 - 1);
      const endMinClamped = clamp(Math.round(endMinN), 0, 24 * 60);

      // ensure end > start (minimum 15 minutes)
      const endMin = Math.max(endMinClamped, startMin + 15);

      const startAt = selectedDayStart + startMin * 60 * 1000;
      const endAt = selectedDayStart + endMin * 60 * 1000;

      if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
        console.warn("[Agenda] commitMoveResize invalid timestamps:", { id, startAt, endAt, startMin, endMin });
        return;
      }

      updateEvent(String(id), { startAt, endAt });
    },
    [selectedDayStart, updateEvent]
  );

  const Header = useMemo(() => {
    const showCalendar = viewMode === "month";
    const showWeek = viewMode === "week";

    return (
      <View style={styles.headerWrap}>
        <View style={styles.dayHeaderRow}>
          <Pressable onPress={goPrevDay} android_ripple={{ color: "#00000010", borderless: true }} style={styles.dayNavBtn}>
            <Icon name="chevron-back" size={20} color={C.deep} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={[styles.pageTitle, { color: C.deep }]}>
              {(isTodaySelected ? "Today" : "Selected") + " • " + dayTitle}
            </Text>
            <Text style={[styles.dayKeyText, { color: C.muted }]}>{selectedDateKey}</Text>
          </View>

          <Pressable onPress={goNextDay} android_ripple={{ color: "#00000010", borderless: true }} style={styles.dayNavBtn}>
            <Icon name="chevron-forward" size={20} color={C.deep} />
          </Pressable>
        </View>

        <View style={styles.quickRow}>
          <ButtonSecondary title="Today" icon="today-outline" onPress={goToday} style={styles.quickBtn} />
          <ButtonPrimary title="New event" icon="add-outline" onPress={openCreate} style={styles.quickBtn} />
        </View>

        <View style={{ marginTop: 12 }}>
          <View style={styles.segmentedWrap}>
            {(["day", "week", "month"] as ViewMode[]).map((m) => {
              const active = viewMode === m;
              const icon = m === "day" ? "today-outline" : m === "week" ? "calendar-outline" : "grid-outline";
              return (
                <Pressable
                  key={m}
                  onPress={() => setViewMode(m)}
                  android_ripple={{ color: "#00000010" }}
                  style={[
                    styles.segmentItem,
                    active && { backgroundColor: C.white, borderWidth: 1, borderColor: "#00000010" },
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Icon name={icon} size={16} color={C.deep} />
                    <Text style={[styles.segmentText, { color: C.deep }]}>{m[0].toUpperCase() + m.slice(1)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          <View style={styles.segmentedWrap}>
            {(["all", "todo", "doing", "done"] as const).map((k) => {
              const active = statusFilter === k;
              const label = k === "all" ? "All" : k === "todo" ? "To-do" : k === "doing" ? "Doing" : "Done";
              return (
                <Pressable
                  key={k}
                  onPress={() => setStatusFilter(k)}
                  android_ripple={{ color: "#00000010" }}
                  style={[
                    styles.segmentItem,
                    active && { backgroundColor: C.white, borderWidth: 1, borderColor: "#00000010" },
                  ]}
                >
                  <Text style={[styles.segmentText, { color: C.deep }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <CardContainer style={styles.filterCard}>
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: C.deep }]}>Tag</Text>

            <TextInput
              value={categoryFilter ?? ""}
              onChangeText={(t) => setCategoryFilter(t.trim().length ? t : null)}
              placeholder="Filter by category (optional) ..."
              placeholderTextColor={C.muted}
              style={[styles.filterInput, { color: C.deep }]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
            />

            {showClear ? (
              <ButtonSecondary title="Clear" icon="close-circle-outline" onPress={clearFilters} style={styles.clearBtn} />
            ) : null}
          </View>
        </CardContainer>

        {viewMode === "day" ? (
          <DayTimelineGrid
            C={C}
            dayStart={selectedDayStart}
            events={events as any}
            onPressEvent={(id) => {
              setDetailId(id);
              setDetailOpen(true);
            }}
            onLongPressEvent={(id) => openQuickMenu(id)}
            onTapCreateAtMinutes={(min) => openCreateAt(selectedDayStart, min)}
            onCommitMoveResize={(id, startMin, endMin) => commitMoveResize(String(id), startMin, endMin)}
          />
        ) : null}

        {showWeek ? (
          <WeekGrid
            C={C}
            weekStart={weekStart}
            eventsForDayIndex={eventsForDayIndex}
            onPressEvent={(id) => {
              setDetailId(id);
              setDetailOpen(true);
            }}
            onLongPressEvent={(id) => openQuickMenu(id)}
            onTapCreate={(dayIndex, min) => openCreateAt(addDaysStart(weekStart, dayIndex), min)}

            onCommitMoveEvent={(id, nextDayIndex, nextStartMin, nextEndMin) => {
              const dayStart = addDaysStart(weekStart, nextDayIndex);

              const startAt = dayStart + nextStartMin * 60000;
              const endAt = dayStart + nextEndMin * 60000;

              updateEvent(id, {
                startAt,
                endAt,
              });
            }}
          />
        ) : null}

        {showCalendar ? (
          <CardContainer style={styles.calendarCard}>
            <Calendar
              current={ymdKeyFromStart(visibleMonthStart)}
              markedDates={markedDates}
              markingType="multi-dot"
              onDayPress={onCalendarDayPress}
              onMonthChange={onCalendarMonthChange}
              enableSwipeMonths
              hideExtraDays={false}
              firstDay={1}
              theme={{
                selectedDayBackgroundColor: C.accent,
                todayTextColor: C.accent,
                arrowColor: C.deep,
                monthTextColor: C.deep,
                textDayFontWeight: "700",
                textMonthFontWeight: "900",
                textDayHeaderFontWeight: "800",
              }}
            />
            <Text style={[styles.calendarHint, { color: C.muted }]}>
              Month loaded: {visibleMonthKey} • 1–3 dots show density (more = more events).
            </Text>
          </CardContainer>
        ) : null}

        <View style={{ height: 8 }} />
      </View>
    );
  }, [
    C,
    categoryFilter,
    clearFilters,
    dayTitle,
    events,
    eventsForDayIndex,
    goNextDay,
    goPrevDay,
    goToday,
    isTodaySelected,
    markedDates,
    onCalendarDayPress,
    onCalendarMonthChange,
    openCreate,
    openCreateAt,
    openQuickMenu,
    selectedDateKey,
    selectedDayStart,
    setCategoryFilter,
    setStatusFilter,
    showClear,
    statusFilter,
    viewMode,
    visibleMonthKey,
    visibleMonthStart,
    weekStart,
    commitMoveResize,
  ]);

  const renderEventItem = useCallback(
    (item: any, dayStartOverride?: number) => {
      const dayStart = startOfDayMs(dayStartOverride ?? selectedDayStart);
      const dayEndExclusive = addDaysStart(dayStart, 1);

      const startAt = Number(item.startAt ?? 0);
      const endAt = item.endAt == null ? null : Number(item.endAt);

      let timeLabel = item.allDay ? "All day" : formatTime(startAt);

      if (!item.allDay && endAt && endAt > startAt) {
        const startDay = startOfDayMs(startAt);
        if (startDay !== dayStart) {
          const clampedEnd = Math.min(endAt, dayEndExclusive);
          timeLabel = "Until " + formatTime(clampedEnd - 1);
        }
      }

      const metaLine = "Time: " + timeLabel + (item.category ? "  |  Category: " + String(item.category) : "");
      const b = statusToBadge(item.status);

      return (
        <View style={styles.rowOuter}>
          <CardContainer style={styles.eventCard}>
            <Pressable
              onPress={() => {
                setDetailId(item.id);
                setDetailOpen(true);
              }}
              onLongPress={() => openQuickMenu(String(item.id))}
              android_ripple={{ color: "#00000008" }}
              style={styles.eventPressable}
            >
              <View style={styles.eventTitleRow}>
                <Text style={[styles.eventTitle, { color: C.deep }]}>{String(item.title ?? "")}</Text>
                <Badge label={b.label} tone={b.tone} variant="soft" icon={b.icon} />
              </View>

              <Text style={[styles.metaLine, { color: C.muted }]}>{metaLine}</Text>

              {!!item.notes?.trim?.().length ? (
                <Text style={[styles.notes, { color: C.primary }]}>{String(item.notes).trim()}</Text>
              ) : null}

              {!!item.cardIds?.length ? (
                <Text style={[styles.linkedCount, { color: C.primary }]}>{"Linked cards: " + String(item.cardIds.length)}</Text>
              ) : null}
            </Pressable>
          </CardContainer>
        </View>
      );
    },
    [selectedDayStart, C.deep, C.muted, C.primary, openQuickMenu]
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {/* Lista solo per Month (e volendo day/month future). Week ormai è griglia */}
      {viewMode === "month" ? (
        <FlatList
          data={events}
          keyExtractor={(item: any) => item.id}
          ListHeaderComponent={Header}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyTitle, { color: C.deep }]}>No events for this day</Text>
              <Text style={[styles.emptyText, { color: C.primary }]}>
                {"Create an event to start using Agenda.\nOffline-first, fast, and linked to your cards."}
              </Text>
              <View style={{ marginTop: 16 }}>
                <ButtonPrimary title="Create event" icon="add-outline" onPress={openCreate} />
              </View>
            </View>
          }
          renderItem={({ item }: any) => renderEventItem(item)}
        />
      ) : (
        <SectionList
          sections={[{ title: "", data: [] }]}
          keyExtractor={(_, idx) => String(idx)}
          ListHeaderComponent={Header}
          contentContainerStyle={styles.listContent}
          renderItem={null as any}
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={openCreate}
        android_ripple={{ color: "#ffffff33" }}
        style={[styles.fab, { bottom: 18 + insets.bottom, backgroundColor: C.accent }]}
      >
        <Icon name="add" size={28} color={C.white} />
      </Pressable>

      {/* Create Modal */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: C.white }]}>
            <Text style={[styles.modalTitle, { color: C.deep }]}>New event</Text>
            <Text style={styles.modalSub}>{dayTitle}</Text>

            <View style={{ marginTop: 12 }}>
              <Pressable
                onPress={() => setNewAllDay((v) => !v)}
                android_ripple={{ color: "#00000010" }}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: newAllDay ? "#DBEAFE" : "#00000006",
                  borderWidth: 1,
                  borderColor: "#00000010",
                  overflow: "hidden",
                }}
              >
                <Text style={{ fontWeight: "900", color: C.deep }}>{newAllDay ? "All day: YES" : "All day: NO"}</Text>
              </Pressable>
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={[styles.fieldLabel, { color: C.deep }]}>Title</Text>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="e.g. Call with client"
                placeholderTextColor={C.muted}
                style={[styles.fieldInput, { color: C.deep }]}
              />
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={[styles.fieldLabel, { color: C.deep }]}>Notes (optional)</Text>
              <TextInput
                value={newNotes}
                onChangeText={setNewNotes}
                placeholder="Add details..."
                placeholderTextColor={C.muted}
                multiline
                style={[styles.fieldInput, styles.notesInput, { color: C.deep }]}
              />
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={[styles.fieldLabel, { color: C.deep }]}>Category (optional)</Text>
              <TextInput
                value={newCategory}
                onChangeText={setNewCategory}
                placeholder="e.g. work, tour, personal"
                placeholderTextColor={C.muted}
                style={[styles.fieldInput, { color: C.deep }]}
              />
            </View>

            {!newAllDay ? (
              <>
                {/* Start */}
                <View style={{ marginTop: 14 }}>
                  <Text style={[styles.fieldLabel, { color: C.deep }]}>Start (HH / MM)</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TextInput
                      value={String(startHour)}
                      onChangeText={(v) => setStartHour(clamp(Number(v) || 0, 0, 23))}
                      keyboardType="numeric"
                      style={[styles.fieldInput, { flex: 1, color: C.deep }]}
                    />
                    <TextInput
                      value={String(startMinute)}
                      onChangeText={(v) => setStartMinute(clamp(Number(v) || 0, 0, 59))}
                      keyboardType="numeric"
                      style={[styles.fieldInput, { flex: 1, color: C.deep }]}
                    />
                  </View>
                </View>

                {/* End */}
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.fieldLabel, { color: C.deep }]}>End (HH / MM)</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TextInput
                      value={String(endHour)}
                      onChangeText={(v) => setEndHour(clamp(Number(v) || 0, 0, 23))}
                      keyboardType="numeric"
                      style={[styles.fieldInput, { flex: 1, color: C.deep }]}
                    />
                    <TextInput
                      value={String(endMinute)}
                      onChangeText={(v) => setEndMinute(clamp(Number(v) || 0, 0, 59))}
                      keyboardType="numeric"
                      style={[styles.fieldInput, { flex: 1, color: C.deep }]}
                    />
                  </View>
                </View>

                <View style={{ marginTop: 12 }}>
                  <Pressable
                    onPress={() => setEndsNextDay((v) => !v)}
                    android_ripple={{ color: "#00000010" }}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      backgroundColor: endsNextDay ? "#DBEAFE" : "#00000006",
                      borderWidth: 1,
                      borderColor: "#00000010",
                      overflow: "hidden",
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: C.deep }}>
                      {endsNextDay ? "Ends next day: YES" : "Ends next day: NO"}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={[styles.modalSub, { marginTop: 10 }]}>All-day event • covers the full day</Text>
            )}

            <View style={styles.modalButtonsRow}>
              <ButtonSecondary title="Cancel" icon="close-circle-outline" onPress={() => setCreateOpen(false)} style={styles.modalBtn} />
              <ButtonPrimary title="Create" icon="checkmark-circle-outline" onPress={doCreate} style={styles.modalBtn} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Detail Modal (identico al tuo, invariato) */}
      <Modal visible={detailOpen} transparent animationType="fade" onRequestClose={() => setDetailOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: C.white }]}>
            {!detail ? (
              <Text style={[styles.loadingText, { color: C.deep }]}>Loading...</Text>
            ) : (
              <View>
                <Text style={[styles.modalTitle, { color: C.deep }]}>{String(detail.title ?? "")}</Text>

                <Text style={styles.modalSub}>
                  {"Time: " +
                    (detail.allDay ? "All day" : formatTime(detail.startAt)) +
                    (detail.category ? "  |  Category: " + String(detail.category) : "") +
                    "  |  " +
                    String(detail.status ?? "").toUpperCase()}
                </Text>

                {!!detail.notes?.trim?.().length ? (
                  <Text style={[styles.detailNotes, { color: C.primary }]}>{String(detail.notes).trim()}</Text>
                ) : null}

                <View style={styles.linkedWrap}>
                  {!!detail.cardIds.length ? (
                    linkedCardTitles.map((c) => (
                      <Pressable
                        key={c.id}
                        onPress={() => {
                          setDetailOpen(false);
                          navigation.navigate("CardDetail", { cardId: c.id });
                        }}
                        android_ripple={{ color: "#00000010" }}
                        style={styles.linkPill}
                      >
                        <Icon name="link-outline" size={16} color="#1D4ED8" />
                        <Text style={styles.linkPillText}>{String(c.title ?? "")}</Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.noLinkedText}>No linked cards yet.</Text>
                  )}
                </View>

                <View style={{ marginTop: 12 }}>
                  <ButtonSecondary title="Link latest Inbox card (MVP)" icon="link-outline" onPress={quickLinkFirstCard} />
                </View>

                <View style={styles.modalButtonsRow}>
                  <ButtonSecondary title="Close" icon="close-circle-outline" onPress={() => setDetailOpen(false)} style={styles.modalBtn} />
                  <ButtonPrimary
                    title={detail.status === "done" ? "Mark To-do" : "Mark Done"}
                    icon={detail.status === "done" ? "refresh-outline" : "checkmark-circle-outline"}
                    onPress={toggleDone}
                    style={styles.modalBtn}
                  />
                </View>

                <Pressable
                  onPress={() => confirmDelete(detail.id, detail.title)}
                  android_ripple={{ color: "#00000010" }}
                  style={styles.deleteBtn}
                >
                  <Icon name="trash-outline" size={18} color="#7F1D1D" />
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRightRow: { flexDirection: "row" },
  headerChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#00000008",
    marginRight: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerChipText: { fontWeight: "900", fontSize: 13 },

  headerWrap: { paddingHorizontal: 16, paddingTop: 12 },

  dayHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dayNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00000008",
    overflow: "hidden",
  },
  pageTitle: { fontSize: 18, fontWeight: "900" },
  dayKeyText: { marginTop: 4, fontSize: 12, fontWeight: "700" },

  quickRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  quickBtn: { flex: 1 },

  segmentedWrap: {
    flexDirection: "row",
    backgroundColor: "#00000008",
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#00000010",
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    alignItems: "center",
  },
  segmentText: { fontWeight: "800", fontSize: 12 },

  filterCard: { padding: 12, marginTop: 12 },
  filterRow: { flexDirection: "row", alignItems: "center" },
  filterLabel: { fontSize: 13, fontWeight: "900" },
  filterInput: { flex: 1, paddingVertical: 0, marginLeft: 10 },
  clearBtn: { marginLeft: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12 },

  calendarCard: { padding: 12, marginTop: 12 },
  calendarHint: { marginTop: 8, fontSize: 12, fontWeight: "700" },

  listContent: { paddingBottom: 120 },

  emptyWrap: { marginTop: 24, alignItems: "center", paddingHorizontal: 18, paddingBottom: 40 },
  emptyTitle: { fontSize: 20, fontWeight: "800" },
  emptyText: { marginTop: 10, textAlign: "center", lineHeight: 20 },

  rowOuter: { marginBottom: 12, paddingHorizontal: 16 },
  eventCard: { padding: 0, overflow: "hidden" },
  eventPressable: { padding: 14 },
  eventTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  eventTitle: { fontSize: 16, fontWeight: "900", flex: 1 },
  metaLine: { marginTop: 6, fontSize: 12 },
  notes: { marginTop: 10, lineHeight: 20 },
  linkedCount: { marginTop: 10, fontSize: 12, fontWeight: "800" },

  fab: {
    position: "absolute",
    right: 18,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    overflow: "hidden",
  },

  modalOverlay: { flex: 1, backgroundColor: "#00000066", justifyContent: "center", padding: 16 },
  modalCard: { borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#00000010" },
  modalTitle: { fontSize: 18, fontWeight: "900" },
  modalSub: { marginTop: 10, fontSize: 12, color: "#00000066" },

  fieldLabel: { fontSize: 12, fontWeight: "800", marginBottom: 6 },
  fieldInput: {
    backgroundColor: "#00000006",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#00000010",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notesInput: { minHeight: 90, textAlignVertical: "top" },

  modalButtonsRow: { flexDirection: "row", marginTop: 16, gap: 10 },
  modalBtn: { flex: 1 },

  loadingText: { fontWeight: "900" },
  detailNotes: { marginTop: 12, lineHeight: 20 },

  linkedWrap: { marginTop: 14, flexDirection: "row", flexWrap: "wrap" },
  linkPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#E6F0FF",
    borderWidth: 1,
    borderColor: "#D0E2FF",
    overflow: "hidden",
    marginRight: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  linkPillText: { fontSize: 12, fontWeight: "900", color: "#1D4ED8" },
  noLinkedText: { fontSize: 12, color: "#00000066" },

  deleteBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FFE4E6",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#FFCDD2",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  deleteText: { color: "#7F1D1D", fontWeight: "900" },
});