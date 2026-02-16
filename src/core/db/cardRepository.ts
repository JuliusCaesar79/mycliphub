import { getDB } from "./sqlite";
import { Card } from "../types/models";

export const CardRepository = {
  async create(card: Card) {
    const db = await getDB();

    await db.executeSql(
      `
      INSERT INTO cards (id, title, pinned, archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?);
      `,
      [
        card.id,
        card.title,
        card.pinned ? 1 : 0,
        card.archived ? 1 : 0,
        card.createdAt,
        card.updatedAt,
      ]
    );
  },

  async getAll(): Promise<Card[]> {
    const db = await getDB();

    const [result] = await db.executeSql(
      `SELECT * FROM cards ORDER BY updated_at DESC;`
    );

    const rows = result.rows;
    const cards: Card[] = [];

    for (let i = 0; i < rows.length; i++) {
      const item = rows.item(i);

      cards.push({
        id: item.id,
        title: item.title,
        pinned: item.pinned === 1,
        archived: item.archived === 1,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      });
    }

    return cards;
  },

  async getById(id: string): Promise<Card | null> {
    const db = await getDB();

    const [result] = await db.executeSql(`SELECT * FROM cards WHERE id = ?;`, [
      id,
    ]);

    if (result.rows.length === 0) return null;

    const item = result.rows.item(0);
    return {
      id: item.id,
      title: item.title,
      pinned: item.pinned === 1,
      archived: item.archived === 1,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
  },

  async updateFields(
    id: string,
    fields: Partial<Pick<Card, "title" | "pinned" | "archived" | "updatedAt">>
  ) {
    const db = await getDB();

    const sets: string[] = [];
    const values: any[] = [];

    if (fields.title !== undefined) {
      sets.push("title = ?");
      values.push(fields.title);
    }
    if (fields.pinned !== undefined) {
      sets.push("pinned = ?");
      values.push(fields.pinned ? 1 : 0);
    }
    if (fields.archived !== undefined) {
      sets.push("archived = ?");
      values.push(fields.archived ? 1 : 0);
    }
    if (fields.updatedAt !== undefined) {
      sets.push("updated_at = ?");
      values.push(fields.updatedAt);
    }

    if (!sets.length) return;

    values.push(id);

    await db.executeSql(`UPDATE cards SET ${sets.join(", ")} WHERE id = ?;`, values);
  },

  async deleteById(id: string) {
    const db = await getDB();
    await db.executeSql(`DELETE FROM cards WHERE id = ?;`, [id]);
  },
};

