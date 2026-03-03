import { getDB } from "./sqlite";

export const initSchema = async () => {
  const db = await getDB();

  // --- CORE TABLES ---

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      pinned INTEGER NOT NULL,
      archived INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS clip_items (
      id TEXT PRIMARY KEY NOT NULL,
      card_id TEXT NOT NULL,
      type TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );
  `);

  // --- AGENDA (STEP 18) ---

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY NOT NULL,

      -- titolo breve dell'impegno
      title TEXT NOT NULL,

      -- testo libero / note (opzionale)
      notes TEXT,

      -- timestamp in ms (come già usiamo altrove)
      start_at INTEGER NOT NULL,
      end_at INTEGER,

      -- 1 = all day, 0 = no
      all_day INTEGER NOT NULL DEFAULT 0,

      -- stato tipo badge: "todo" | "doing" | "done"
      status TEXT NOT NULL DEFAULT 'todo',

      -- categoria libera (es. lavoro, tour, personale)
      category TEXT,

      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Link evento -> una o più card (richiamo card dal calendario)
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS event_cards (
      event_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      PRIMARY KEY (event_id, card_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );
  `);

  // --- INDEXES (performance) ---

  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_clip_items_card_id_created_at
    ON clip_items(card_id, created_at);
  `);

  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_events_start_at
    ON events(start_at);
  `);

  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_events_status
    ON events(status);
  `);

  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_events_category
    ON events(category);
  `);

  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_event_cards_card_id
    ON event_cards(card_id);
  `);

  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_event_cards_event_id
    ON event_cards(event_id);
  `);
};