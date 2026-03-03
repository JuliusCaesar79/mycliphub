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

  loadEventsForRange: (
    startAtInclusive: number,
    endAtExclusive: number
  ) => Promise<void>;
  loadEventsForDay: (dayStartMs: number) => Promise<void>;

  // ✅ month fetch for markers
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

  updateEvent: (
    id: string,
    patch: Partial<Omit<AgendaEvent, "id" | "createdAt">>
  ) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;

  setLinkedCards: (eventId: string, cardIds: string[]) => Promise<void>;
  addLinkedCard: (eventId: string, cardId: string) => Promise<void>;
  removeLinkedCard: (eventId: string, cardId: string) => Promise<void>;

  // selectors
  getEvent: (id: string) => AgendaEventWithCards | null;
  getEventsForDay: (dayStartMs: number) => AgendaEventWithCards[];

  // ✅ markers helper
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

// --- STEP 2E helpers (multi-day expansion) ---

/**
 * Returns the list of dayKeys covered by the event.
 * Coverage rule: any day that intersects [startAt, endAt) (endAt exclusive).
 * If endAt is null or invalid (<= startAt), we treat it as single-day (start day).
 *
 * Important: if endAt lands exactly at 00:00 of a day, that day is NOT included.
 * (hence using endAt - 1 for day computation)
 */
function getCoveredDayKeys(e: Pick<AgendaEvent, "startAt" | "endAt">): string[] {
  const start = Number(e.startAt ?? 0);
  const end = e.endAt == null ? null : Number(e.endAt);

  if (!end || end <= start) {
    return [dayKeyFromMs(start)];
  }

  const startDay = startOfDayMs(start);
  const endInclusiveDay = startOfDayMs(end - 1); // end is exclusive

  const out: string[] = [];
  const cursor = new Date(startDay);
  while (cursor.getTime() <= endInclusiveDay) {
    out.push(dayKeyFromMs(cursor.getTime()));
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }
  return out;
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

function sortBucketIds(
  ids: string[],
  byId: Record<string, AgendaEventWithCards>
): string[] {
  return [...ids].sort((aId, bId) => {
    const a = byId[aId];
    const b = byId[bId];
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return sortEventsAsc(a, b);
  });
}

export const useEventStore = create<EventState>((set, get) => ({
  eventsById: {},
  eventIdsByDayKey: {},
  rev: 0,

  statusFilter: "all",
  categoryFilter: null,

  setStatusFilter: (v) => set(() => ({ statusFilter: v })),
  setCategoryFilter: (v) => set(() => ({ categoryFilter: v })),
  clearFilters: () =>
    set(() => ({ statusFilter: "all", categoryFilter: null })),

  loadEventsForRange: async (startAtInclusive, endAtExclusive) => {
    // Repository (STEP 2E) ritorna eventi che INTERSECANO il range.
    const rows = await EventRepository.getByRangeWithCards(
      startAtInclusive,
      endAtExclusive
    );

    set((state) => {
      const nextById = { ...state.eventsById };
      const nextByDay = { ...state.eventIdsByDayKey };

      const touchedKeys: string[] = [];

      for (const e of rows) {
        nextById[e.id] = e;

        // 🔥 Multi-day expansion: bucket su tutti i giorni coperti
        const keys = getCoveredDayKeys(e);
        for (const dk of keys) {
          const existing = nextByDay[dk] ?? [];
          if (!existing.includes(e.id)) {
            nextByDay[dk] = [...existing, e.id];
            touchedKeys.push(dk);
          }
        }
      }

      // sort only touched keys (performance)
      for (const dk of uniq(touchedKeys)) {
        nextByDay[dk] = sortBucketIds(nextByDay[dk] ?? [], nextById);
      }

      return {
        eventsById: nextById,
        eventIdsByDayKey: nextByDay,
        rev: state.rev + 1,
      };
    });
  },

  loadEventsForDay: async (dayStartMs) => {
    const start = startOfDayMs(dayStartMs);
    const end = endOfDayExclusiveMs(start);
    const dk = dayKeyFromMs(start);

    // Repository (STEP 2E) includerà anche multi-day che attraversano questo giorno
    const rows = await EventRepository.getByRangeWithCards(start, end);

    set((state) => {
      const nextById = { ...state.eventsById };
      for (const e of rows) nextById[e.id] = e;

      // Bucket accurato per quel giorno: includi solo eventi che coprono quel dk
      const idsForThisDay = rows
        .filter((e) => getCoveredDayKeys(e).includes(dk))
        .map((e) => e.id);

      const sortedIds = sortBucketIds(idsForThisDay, nextById);

      return {
        eventsById: nextById,
        eventIdsByDayKey: {
          ...state.eventIdsByDayKey,
          [dk]: sortedIds, // overwrite that day (accurate, no stale ids)
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

      // group ids by dayKey (🔥 multi-day aware)
      const grouped: Record<string, string[]> = {};

      for (const e of rows) {
        const keys = getCoveredDayKeys(e);

        for (const dk of keys) {
          // limita al mese caricato (evita bucket fuori range)
          // dk è "YYYY-MM-DD" -> confrontiamo via ms del giorno
          // (safe: usiamo startOfDayMs del "start" e poi iteriamo il mese nel reset sotto)
          if (!grouped[dk]) grouped[dk] = [];
          if (!grouped[dk].includes(e.id)) grouped[dk].push(e.id);
        }
      }

      // overwrite only the keys of this month range (clean markers / no stale)
      const nextByDay = { ...state.eventIdsByDayKey };

      // reset all days in month to empty
      const cursor = new Date(start);
      while (cursor.getTime() < end) {
        const dk = dayKeyFromMs(cursor.getTime());
        nextByDay[dk] = [];
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(0, 0, 0, 0);
      }

      // set grouped for month days only (sorted)
      const monthCursor = new Date(start);
      while (monthCursor.getTime() < end) {
        const dk = dayKeyFromMs(monthCursor.getTime());
        const ids = grouped[dk] ?? [];
        nextByDay[dk] = sortBucketIds(ids, nextById);
        monthCursor.setDate(monthCursor.getDate() + 1);
        monthCursor.setHours(0, 0, 0, 0);
      }

      return {
        eventsById: nextById,
        eventIdsByDayKey: nextByDay,
        rev: state.rev + 1,
      };
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
      const nextById = { ...state.eventsById, [id]: withCards };
      const nextByDay = { ...state.eventIdsByDayKey };

      const keys = getCoveredDayKeys(withCards);
      for (const dk of keys) {
        const existing = nextByDay[dk] ?? [];
        const nextIds = existing.includes(id) ? existing : [...existing, id];
        nextByDay[dk] = sortBucketIds(nextIds, nextById);
      }

      return {
        eventsById: nextById,
        eventIdsByDayKey: nextByDay,
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
      category:
        patch.category === undefined ? current.category : patch.category ?? null,
      allDay: patch.allDay === undefined ? current.allDay : Boolean(patch.allDay),
      status: (patch.status as EventStatus | undefined) ?? current.status,
      title:
        patch.title === undefined
          ? current.title
          : normalizeTitle(String(patch.title)),
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

    // 🔥 Multi-day rebucket: rimuovi da tutti i giorni vecchi, aggiungi a tutti i nuovi
    const prevKeys = getCoveredDayKeys(current);
    const nextKeys = getCoveredDayKeys(next);
    const affectedKeys = uniq([...prevKeys, ...nextKeys]);

    set((state) => {
      const nextById = { ...state.eventsById, [id]: next };
      const nextByDay = { ...state.eventIdsByDayKey };

      // remove from prev keys
      for (const k of prevKeys) {
        if (!nextByDay[k]) continue;
        nextByDay[k] = (nextByDay[k] ?? []).filter((x) => x !== id);
      }

      // add to new keys
      for (const k of nextKeys) {
        const bucket = nextByDay[k] ?? [];
        nextByDay[k] = bucket.includes(id) ? bucket : [...bucket, id];
      }

      // sort affected keys
      for (const k of affectedKeys) {
        nextByDay[k] = sortBucketIds(nextByDay[k] ?? [], nextById);
      }

      return {
        eventsById: nextById,
        eventIdsByDayKey: nextByDay,
        rev: state.rev + 1,
      };
    });
  },

  deleteEvent: async (id) => {
    const current = get().eventsById[id];
    if (!current) return;

    await EventRepository.deleteById(id);

    const keys = getCoveredDayKeys(current);

    set((state) => {
      const nextById = { ...state.eventsById };
      delete nextById[id];

      const nextByDay = { ...state.eventIdsByDayKey };
      for (const dk of keys) {
        if (nextByDay[dk]) {
          nextByDay[dk] = nextByDay[dk].filter((x) => x !== id);
        }
      }

      return {
        eventsById: nextById,
        eventIdsByDayKey: nextByDay,
        rev: state.rev + 1,
      };
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
    const list = ids
      .map((id) => state.eventsById[id])
      .filter(Boolean) as AgendaEventWithCards[];
    const filtered = applyFilters(list, state.statusFilter, state.categoryFilter);
    return [...filtered].sort(sortEventsAsc);
  },

  // ✅ markers helper: count events per day for month
  // NOTE: con STEP 2E ora conteggia anche i giorni intermedi dei multi-day (bene!)
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