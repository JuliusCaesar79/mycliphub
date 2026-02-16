import { getDB } from "./sqlite";

export const initSchema = async () => {
  const db = await getDB();

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
};
