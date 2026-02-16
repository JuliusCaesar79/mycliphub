import SQLite from "react-native-sqlite-storage";

SQLite.enablePromise(true);

const DB_NAME = "mycliphub.db";
const DB_LOCATION = "default";

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDB = async () => {
  if (dbInstance) return dbInstance;

  dbInstance = await SQLite.openDatabase({
    name: DB_NAME,
    location: DB_LOCATION,
  });

  return dbInstance;
};
