import { create } from "zustand";
import { uuid } from "../utils/uuid";
import {
  AgendaEvent,
  AgendaEventWithCards,
  EventRepository,
  EventStatus,
} from "../db/eventRepository";

type StatusFilter = "all" | EventStatus;

type EventState = {
  // normalized cache
  eventsById: Record<string, AgendaEventWithCards>;

  // dayKey => [eventId...]
  eventIdsByDayKey: Record<string, string[]>;

  // bump to force re-renders safely
  rev: number;

  statusFilter: StatusFilter;
  categoryFilter: string | null;

  setStatusFilter: (v: StatusFilter) => void;
  setCategoryFilter: (v: string | null) => void;
  clearFilters: () => void;

  loadEventsForRange: (startAtInclusive: number, endAtExclusive: number) => Promise<void>;
  loadEventsForDay: (dayStartMs: number) => Promise<void>;

  // ✅ new: month fetch for markers
  loadEventsForMonth: (monthStartMs: number) => Promise<void>;

  createEvent: (input: {
    title?: string;
    notes?: string | null;
    startAt: number;
    endAt?: number | null;
    allDay?: boolean;
    status?: EventStatus;
    category?: string | null;
    linkedCardIds?: string[];
  }) => Promise<string>;

  updateEvent: (id: string, patch: Partial<Omit<AgendaEvent, "id" | "createdAt">>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;

  setLinkedCards: (eventId: string, cardIds: string[]) => Promise<void>;
  addLinkedCard: (eventId: string, cardId: string) => Promise<void>;
  removeLinkedCard: (eventId: string, cardId: string) => Promise<void>;

  // selectors
  getEvent: (id: string) => AgendaEventWithCards | null;
  getEventsForDay: (dayStartMs: number) => AgendaEventWithCards[];

  // ✅ new: markers helper
  getDaysWithEventsForMonth: (monthStartMs: number) => Record<string, number>;
};

// ---- tiny date helpers (safe, no Intl dependency) ----
function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function dayKeyFromMs(ms: number) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function startOfDayMs(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDayExclusiveMs(dayStart: number) {
  return dayStart + 24 * 60 * 60 * 1000;
}

function startOfMonthMs(ms: number) {
  const d = new Date(ms);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfMonthExclusiveMs(monthStart: number) {
  const d = new Date(monthStart);
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function normalizeTitle(value: string) {
  const t = (value ?? "").trim();
  return t.length ? t : "Untitled";
}

function sortEventsAsc(a: AgendaEventWithCards, b: AgendaEventWithCards) {
  // allDay first, then startAt
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.startAt !== b.startAt) return a.startAt - b.startAt;
  return (a.title ?? "").localeCompare(b.title ?? "");
}

function applyFilters(
  list: AgendaEventWithCards[],
  statusFilter: StatusFilter,
  categoryFilter: string | null
) {
  let out = list;

  if (statusFilter !== "all") {
    out = out.filter((e) => e.status === statusFilter);
  }

  if (categoryFilter && categoryFilter.trim().length) {
    const c = categoryFilter.trim().toLowerCase();
    out = out.filter((e) => (e.category ?? "").toLowerCase() === c);
  }

  return out;
}

export const useEventStore = create<EventState>((set, get) => ({
  eventsById: {},
  eventIdsByDayKey: {},
  rev: 0,

  statusFilter: "all",
  categoryFilter: null,

  setStatusFilter: (v) => set(() => ({ statusFilter: v })),
  setCategoryFilter: (v) => set(() => ({ categoryFilter: v })),
  clearFilters: () => set(() => ({ statusFilter: "all", categoryFilter: null })),

  loadEventsForRange: async (startAtInclusive, endAtExclusive) => {
    const rows = await EventRepository.getByRangeWithCards(startAtInclusive, endAtExclusive);

    set((state) => {
      const nextById = { ...state.eventsById };
      const nextByDay = { ...state.eventIdsByDayKey };

      for (const e of rows) {
        nextById[e.id] = e;

        const dk = dayKeyFromMs(e.startAt);
        const existing = nextByDay[dk] ?? [];
        if (!existing.includes(e.id)) {
          nextByDay[dk] = [...existing, e.id];
        }
      }

      // Keep ids in each day sorted by event ordering
      for (const dk of Object.keys(nextByDay)) {
        const ids = nextByDay[dk];
        const sorted = [...ids].sort((aId, bId) => {
          const a = nextById[aId];
          const b = nextById[bId];
          if (!a && !b) return 0;
          if (!a) return 1;
          if (!b) return -1;
          return sortEventsAsc(a, b);
        });
        nextByDay[dk] = sorted;
      }

      return { eventsById: nextById, eventIdsByDayKey: nextByDay, rev: state.rev + 1 };
    });
  },

  loadEventsForDay: async (dayStartMs) => {
    const start = startOfDayMs(dayStartMs);
    const end = endOfDayExclusiveMs(start);

    const rows = await EventRepository.getByRangeWithCards(start, end);
    const dk = dayKeyFromMs(start);

    set((state) => {
      const nextById = { ...state.eventsById };
      for (const e of rows) nextById[e.id] = e;

      const ids = rows.map((e) => e.id).sort((aId, bId) => {
        const a = nextById[aId];
        const b = nextById[bId];
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        return sortEventsAsc(a, b);
      });

      return {
        eventsById: nextById,
        eventIdsByDayKey: {
          ...state.eventIdsByDayKey,
          [dk]: ids, // overwrite that day (accurate, no stale ids)
        },
        rev: state.rev + 1,
      };
    });
  },

  // ✅ month fetch: overwrite buckets for the whole month (perfect for markers)
  loadEventsForMonth: async (monthStartMs) => {
    const start = startOfMonthMs(monthStartMs);
    const end = endOfMonthExclusiveMs(start);

    const rows = await EventRepository.getByRangeWithCards(start, end);

    set((state) => {
      const nextById = { ...state.eventsById };
      for (const e of rows) nextById[e.id] = e;

      // group ids by dayKey
      const grouped: Record<string, string[]> = {};
      for (const e of rows) {
        const dk = dayKeyFromMs(e.startAt);
        if (!grouped[dk]) grouped[dk] = [];
        grouped[dk].push(e.id);
      }

      // overwrite only the keys of this month range (clean markers / no stale)
      const nextByDay = { ...state.eventIdsByDayKey };

      // remove existing keys belonging to this month (they might be stale)
      const cursor = new Date(start);
      while (cursor.getTime() < end) {
        const dk = dayKeyFromMs(cursor.getTime());
        nextByDay[dk] = []; // default empty
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(0, 0, 0, 0);
      }

      // set grouped (sorted)
      for (const dk of Object.keys(grouped)) {
        const ids = grouped[dk];
        nextByDay[dk] = [...ids].sort((aId, bId) => {
          const a = nextById[aId];
          const b = nextById[bId];
          if (!a && !b) return 0;
          if (!a) return 1;
          if (!b) return -1;
          return sortEventsAsc(a, b);
        });
      }

      return { eventsById: nextById, eventIdsByDayKey: nextByDay, rev: state.rev + 1 };
    });
  },

  createEvent: async (input) => {
    const now = Date.now();
    const id = uuid();

    const event: AgendaEvent = {
      id,
      title: normalizeTitle(input.title ?? ""),
      notes: input.notes ?? null,

      startAt: input.startAt,
      endAt: input.endAt ?? null,

      allDay: Boolean(input.allDay ?? false),

      status: input.status ?? "todo",
      category: input.category ?? null,

      createdAt: now,
      updatedAt: now,
    };

    await EventRepository.create(event);

    const linked = input.linkedCardIds ?? [];
    if (linked.length) {
      await EventRepository.setLinkedCards(id, linked);
    }

    const withCards: AgendaEventWithCards = { ...event, cardIds: linked };

    set((state) => {
      const dk = dayKeyFromMs(withCards.startAt);
      const existing = state.eventIdsByDayKey[dk] ?? [];
      const nextIds = existing.includes(id) ? existing : [...existing, id];

      const nextById = { ...state.eventsById, [id]: withCards };
      const sortedIds = [...nextIds].sort((aId, bId) => {
        const a = nextById[aId];
        const b = nextById[bId];
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        return sortEventsAsc(a, b);
      });

      return {
        eventsById: nextById,
        eventIdsByDayKey: {
          ...state.eventIdsByDayKey,
          [dk]: sortedIds,
        },
        rev: state.rev + 1,
      };
    });

    return id;
  },

  updateEvent: async (id, patch) => {
    const current = get().eventsById[id];
    if (!current) return;

    const now = Date.now();

    const next: AgendaEventWithCards = {
      ...current,
      ...patch,
      notes: patch.notes === undefined ? current.notes : patch.notes ?? null,
      endAt: patch.endAt === undefined ? current.endAt : patch.endAt ?? null,
      category: patch.category === undefined ? current.category : patch.category ?? null,
      allDay: patch.allDay === undefined ? current.allDay : Boolean(patch.allDay),
      status: (patch.status as EventStatus | undefined) ?? current.status,
      title: patch.title === undefined ? current.title : normalizeTitle(String(patch.title)),
      updatedAt: now,
    };

    await EventRepository.update({
      id: next.id,
      title: next.title,
      notes: next.notes,
      startAt: next.startAt,
      endAt: next.endAt,
      allDay: next.allDay,
      status: next.status,
      category: next.category,
      createdAt: next.createdAt,
      updatedAt: next.updatedAt,
    });

    const prevKey = dayKeyFromMs(current.startAt);
    const nextKey = dayKeyFromMs(next.startAt);

    set((state) => {
      const nextById = { ...state.eventsById, [id]: next };
      const nextByDay = { ...state.eventIdsByDayKey };

      if (prevKey !== nextKey) {
        nextByDay[prevKey] = (nextByDay[prevKey] ?? []).filter((x) => x !== id);
        const target = nextByDay[nextKey] ?? [];
        nextByDay[nextKey] = target.includes(id) ? target : [...target, id];
      }

      const keysToSort = prevKey === nextKey ? [nextKey] : [prevKey, nextKey];
      for (const k of keysToSort) {
        const ids = nextByDay[k] ?? [];
        nextByDay[k] = [...ids].sort((aId, bId) => {
          const a = nextById[aId];
          const b = nextById[bId];
          if (!a && !b) return 0;
          if (!a) return 1;
          if (!b) return -1;
          return sortEventsAsc(a, b);
        });
      }

      return { eventsById: nextById, eventIdsByDayKey: nextByDay, rev: state.rev + 1 };
    });
  },

  deleteEvent: async (id) => {
    const current = get().eventsById[id];
    if (!current) return;

    await EventRepository.deleteById(id);

    set((state) => {
      const nextById = { ...state.eventsById };
      delete nextById[id];

      const dk = dayKeyFromMs(current.startAt);
      const nextByDay = { ...state.eventIdsByDayKey };
      if (nextByDay[dk]) {
        nextByDay[dk] = nextByDay[dk].filter((x) => x !== id);
      }

      return { eventsById: nextById, eventIdsByDayKey: nextByDay, rev: state.rev + 1 };
    });
  },

  setLinkedCards: async (eventId, cardIds) => {
    await EventRepository.setLinkedCards(eventId, cardIds);

    set((state) => {
      const current = state.eventsById[eventId];
      if (!current) return state;

      return {
        eventsById: {
          ...state.eventsById,
          [eventId]: { ...current, cardIds: [...cardIds] },
        },
        rev: state.rev + 1,
      };
    });
  },

  addLinkedCard: async (eventId, cardId) => {
    await EventRepository.addLinkedCard(eventId, cardId);

    set((state) => {
      const current = state.eventsById[eventId];
      if (!current) return state;

      if (current.cardIds.includes(cardId)) return state;

      return {
        eventsById: {
          ...state.eventsById,
          [eventId]: { ...current, cardIds: [...current.cardIds, cardId] },
        },
        rev: state.rev + 1,
      };
    });
  },

  removeLinkedCard: async (eventId, cardId) => {
    await EventRepository.removeLinkedCard(eventId, cardId);

    set((state) => {
      const current = state.eventsById[eventId];
      if (!current) return state;

      return {
        eventsById: {
          ...state.eventsById,
          [eventId]: {
            ...current,
            cardIds: current.cardIds.filter((x) => x !== cardId),
          },
        },
        rev: state.rev + 1,
      };
    });
  },

  getEvent: (id) => {
    return get().eventsById[id] ?? null;
  },

  getEventsForDay: (dayStartMs) => {
    const state = get();
    const dk = dayKeyFromMs(startOfDayMs(dayStartMs));
    const ids = state.eventIdsByDayKey[dk] ?? [];
    const list = ids.map((id) => state.eventsById[id]).filter(Boolean) as AgendaEventWithCards[];
    const filtered = applyFilters(list, state.statusFilter, state.categoryFilter);
    return [...filtered].sort(sortEventsAsc);
  },

  // ✅ markers helper: count events per day for month
  getDaysWithEventsForMonth: (monthStartMs) => {
    const state = get();
    const start = startOfMonthMs(monthStartMs);
    const end = endOfMonthExclusiveMs(start);

    const out: Record<string, number> = {};

    const cursor = new Date(start);
    while (cursor.getTime() < end) {
      const dk = dayKeyFromMs(cursor.getTime());
      const ids = state.eventIdsByDayKey[dk] ?? [];
      if (ids.length) out[dk] = ids.length;
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
    }

    return out;
  },
}));