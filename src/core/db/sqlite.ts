import SQLite from "react-native-sqlite-storage";

SQLite.enablePromise(true);

const DB_NAME = "mycliphub.db";
const DB_LOCATION = "default";

let dbInstance: SQLite.SQLiteDatabase | null = null;

async function applyPragmas(db: SQLite.SQLiteDatabase) {
  // IMPORTANT: enable FK constraints (needed for ON DELETE CASCADE)
  await db.executeSql("PRAGMA foreign_keys = ON;");

  // Better concurrency / perf (safe defaults)
  await db.executeSql("PRAGMA journal_mode = WAL;");
  await db.executeSql("PRAGMA synchronous = NORMAL;");

  // Avoid "database is locked" in burst writes
  await db.executeSql("PRAGMA busy_timeout = 3000;");
}

export const getDB = async () => {
  if (dbInstance) return dbInstance;

  dbInstance = await SQLite.openDatabase({
    name: DB_NAME,
    location: DB_LOCATION,
  });

  await applyPragmas(dbInstance);

  return dbInstance;
};