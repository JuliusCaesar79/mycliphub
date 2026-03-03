import { getDB } from "./sqlite";

export type EventStatus = "todo" | "doing" | "done";

export type AgendaEvent = {
  id: string;
  title: string;
  notes?: string | null;

  startAt: number;
  endAt?: number | null;

  allDay: boolean;

  status: EventStatus;
  category?: string | null;

  createdAt: number;
  updatedAt: number;
};

export type AgendaEventWithCards = AgendaEvent & {
  cardIds: string[];
};

function toBool01(v: unknown): boolean {
  return Number(v ?? 0) === 1;
}

function normalizeStatus(v: unknown): EventStatus {
  const s = String(v ?? "todo");
  if (s === "doing" || s === "done" || s === "todo") return s;
  return "todo";
}

export const EventRepository = {
  async create(event: AgendaEvent) {
    const db = await getDB();

    await db.executeSql(
      `
      INSERT INTO events (
        id, title, notes,
        start_at, end_at,
        all_day, status, category,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        event.id,
        event.title,
        event.notes ?? null,
        event.startAt,
        event.endAt ?? null,
        event.allDay ? 1 : 0,
        event.status,
        event.category ?? null,
        event.createdAt,
        event.updatedAt,
      ]
    );
  },

  async update(event: AgendaEvent) {
    const db = await getDB();

    await db.executeSql(
      `
      UPDATE events
      SET
        title = ?,
        notes = ?,
        start_at = ?,
        end_at = ?,
        all_day = ?,
        status = ?,
        category = ?,
        updated_at = ?
      WHERE id = ?;
      `,
      [
        event.title,
        event.notes ?? null,
        event.startAt,
        event.endAt ?? null,
        event.allDay ? 1 : 0,
        event.status,
        event.category ?? null,
        event.updatedAt,
        event.id,
      ]
    );
  },

  async getById(id: string): Promise<AgendaEvent | null> {
    const db = await getDB();

    const [result] = await db.executeSql(
      `
      SELECT
        id, title, notes,
        start_at, end_at,
        all_day, status, category,
        created_at, updated_at
      FROM events
      WHERE id = ?
      LIMIT 1;
      `,
      [id]
    );

    if (result.rows.length === 0) return null;

    const item = result.rows.item(0);

    return {
      id: String(item.id),
      title: String(item.title ?? ""),
      notes: item.notes == null ? null : String(item.notes),

      startAt: Number(item.start_at ?? 0),
      endAt: item.end_at == null ? null : Number(item.end_at),

      allDay: toBool01(item.all_day),

      status: normalizeStatus(item.status),
      category: item.category == null ? null : String(item.category),

      createdAt: Number(item.created_at ?? 0),
      updatedAt: Number(item.updated_at ?? 0),
    };
  },

  async deleteById(id: string) {
    const db = await getDB();
    // event_cards verrà pulita da ON DELETE CASCADE
    await db.executeSql(`DELETE FROM events WHERE id = ?;`, [id]);
  },

  // Range query: utile per giorno/settimana/mese (passi start/end in ms)
  async getByRange(startAtInclusive: number, endAtExclusive: number): Promise<AgendaEvent[]> {
    const db = await getDB();

    const [result] = await db.executeSql(
      `
      SELECT
        id, title, notes,
        start_at, end_at,
        all_day, status, category,
        created_at, updated_at
      FROM events
      WHERE start_at >= ? AND start_at < ?
      ORDER BY start_at ASC;
      `,
      [startAtInclusive, endAtExclusive]
    );

    const rows = result.rows;
    const events: AgendaEvent[] = [];

    for (let i = 0; i < rows.length; i++) {
      const item = rows.item(i);

      events.push({
        id: String(item.id),
        title: String(item.title ?? ""),
        notes: item.notes == null ? null : String(item.notes),

        startAt: Number(item.start_at ?? 0),
        endAt: item.end_at == null ? null : Number(item.end_at),

        allDay: toBool01(item.all_day),

        status: normalizeStatus(item.status),
        category: item.category == null ? null : String(item.category),

        createdAt: Number(item.created_at ?? 0),
        updatedAt: Number(item.updated_at ?? 0),
      });
    }

    return events;
  },

  // --- LINK CARDS ---

  async setLinkedCards(eventId: string, cardIds: string[]) {
    const db = await getDB();

    await db.executeSql("BEGIN TRANSACTION;");

    try {
      await db.executeSql(`DELETE FROM event_cards WHERE event_id = ?;`, [eventId]);

      for (const cardId of cardIds) {
        await db.executeSql(
          `
          INSERT OR IGNORE INTO event_cards (event_id, card_id)
          VALUES (?, ?);
          `,
          [eventId, cardId]
        );
      }

      await db.executeSql("COMMIT;");
    } catch (e) {
      await db.executeSql("ROLLBACK;");
      throw e;
    }
  },

  async addLinkedCard(eventId: string, cardId: string) {
    const db = await getDB();
    await db.executeSql(
      `
      INSERT OR IGNORE INTO event_cards (event_id, card_id)
      VALUES (?, ?);
      `,
      [eventId, cardId]
    );
  },

  async removeLinkedCard(eventId: string, cardId: string) {
    const db = await getDB();
    await db.executeSql(
      `
      DELETE FROM event_cards
      WHERE event_id = ? AND card_id = ?;
      `,
      [eventId, cardId]
    );
  },

  async getLinkedCardIds(eventId: string): Promise<string[]> {
    const db = await getDB();

    const [result] = await db.executeSql(
      `
      SELECT card_id
      FROM event_cards
      WHERE event_id = ?;
      `,
      [eventId]
    );

    const rows = result.rows;
    const ids: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const item = rows.item(i);
      ids.push(String(item.card_id));
    }

    return ids;
  },

  async getByRangeWithCards(
    startAtInclusive: number,
    endAtExclusive: number
  ): Promise<AgendaEventWithCards[]> {
    const events = await this.getByRange(startAtInclusive, endAtExclusive);

    if (events.length === 0) return [];

    // Fetch links in one shot for performance
    const db = await getDB();

    // Build IN (?, ?, ...) safely
    const placeholders = events.map(() => "?").join(",");
    const ids = events.map((e) => e.id);

    const [linksResult] = await db.executeSql(
      `
      SELECT event_id, card_id
      FROM event_cards
      WHERE event_id IN (${placeholders});
      `,
      ids
    );

    const linkRows = linksResult.rows;

    const map: Record<string, string[]> = {};
    for (let i = 0; i < linkRows.length; i++) {
      const r = linkRows.item(i);
      const eid = String(r.event_id);
      const cid = String(r.card_id);
      if (!map[eid]) map[eid] = [];
      map[eid].push(cid);
    }

    return events.map((e) => ({
      ...e,
      cardIds: map[e.id] ?? [],
    }));
  },
};