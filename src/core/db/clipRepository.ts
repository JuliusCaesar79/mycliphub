import { getDB } from "./sqlite";
import { ClipItem } from "../storage/cardStore";

export const ClipRepository = {
  async create(clip: ClipItem) {
    const db = await getDB();

    await db.executeSql(
      `
      INSERT INTO clip_items (id, card_id, type, text, created_at)
      VALUES (?, ?, ?, ?, ?);
      `,
      [
        clip.id,
        clip.cardId,
        clip.type,
        clip.text,
        clip.createdAt,
      ]
    );
  },

  async getByCardId(cardId: string): Promise<ClipItem[]> {
    const db = await getDB();

    const [result] = await db.executeSql(
      `
      SELECT * FROM clip_items
      WHERE card_id = ?
      ORDER BY created_at DESC;
      `,
      [cardId]
    );

    const rows = result.rows;
    const clips: ClipItem[] = [];

    for (let i = 0; i < rows.length; i++) {
      const item = rows.item(i);

      clips.push({
        id: item.id,
        cardId: item.card_id,
        type: item.type,
        text: item.text,
        createdAt: item.created_at,
      });
    }

    return clips;
  },

  async deleteById(id: string) {
    const db = await getDB();
    await db.executeSql(`DELETE FROM clip_items WHERE id = ?;`, [id]);
  },
};
