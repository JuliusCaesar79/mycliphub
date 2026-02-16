import { create } from "zustand";
import { Card } from "../types/models";
import { uuid } from "../utils/uuid";
import { CardRepository } from "../db/cardRepository";
import { ClipRepository } from "../db/clipRepository";

export type ClipItemType = "text" | "link" | "qr" | "ocr";

export type ClipItem = {
  id: string;
  cardId: string;
  type: ClipItemType;
  text: string;
  createdAt: number;
};

type CardState = {
  cards: Card[];

  // ClipItems separati, DB-backed
  clipItemsByCardId: Record<string, ClipItem[]>;

  // DB bootstrap
  loadFromDB: () => Promise<void>;

  // Clips DB
  loadClips: (cardId: string) => Promise<void>;

  createCard: (title?: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  archiveCard: (id: string) => Promise<void>;

  addClipItem: (cardId: string, text: string) => Promise<void>;
  removeClipItem: (cardId: string, clipId: string) => Promise<void>;

  getClipItems: (cardId: string) => ClipItem[];
};

/* -----------------------------
   Helpers (STEP 8.3)
------------------------------ */

const looksLikeUrl = (value: string) => {
  const v = value.trim();
  return /^https?:\/\/\S+$/i.test(v);
};

const normalizeUrl = (value: string) => value.trim();

/* -----------------------------
   Store (DB-first)
------------------------------ */

export const useCardStore = create<CardState>((set, get) => ({
  cards: [],
  clipItemsByCardId: {},

  loadFromDB: async () => {
    const cards = await CardRepository.getAll();

    // pinned sopra, poi updatedAt desc
    cards.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });

    // prepara bucket vuoti per clips
    set((state) => {
      const nextMap = { ...state.clipItemsByCardId };
      for (const c of cards) {
        if (!nextMap[c.id]) nextMap[c.id] = [];
      }
      return { cards, clipItemsByCardId: nextMap };
    });
  },

  loadClips: async (cardId: string) => {
    const clips = await ClipRepository.getByCardId(cardId);
    set((state) => ({
      clipItemsByCardId: {
        ...state.clipItemsByCardId,
        [cardId]: clips,
      },
    }));
  },

  createCard: async (title) => {
    const now = Date.now();
    const id = uuid();

    const card: Card = {
      id,
      title: title?.trim() ? title.trim() : "Untitled",
      pinned: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };

    await CardRepository.create(card);

    set((state) => ({
      cards: [card, ...state.cards],
      clipItemsByCardId: {
        ...state.clipItemsByCardId,
        [id]: state.clipItemsByCardId[id] ?? [],
      },
    }));
  },

  togglePin: async (id) => {
    const state = get();
    const card = state.cards.find((c) => c.id === id);
    if (!card) return;

    const nextPinned = !card.pinned;
    const now = Date.now();

    await CardRepository.updateFields(id, {
      pinned: nextPinned,
      updatedAt: now,
    });

    set((s) => {
      const nextCards = s.cards.map((c) =>
        c.id === id ? { ...c, pinned: nextPinned, updatedAt: now } : c
      );

      nextCards.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      });

      return { cards: nextCards };
    });
  },

  archiveCard: async (id) => {
    const state = get();
    const card = state.cards.find((c) => c.id === id);
    if (!card) return;

    const now = Date.now();

    await CardRepository.updateFields(id, {
      archived: true,
      updatedAt: now,
    });

    set((s) => ({
      cards: s.cards.map((c) =>
        c.id === id ? { ...c, archived: true, updatedAt: now } : c
      ),
    }));
  },

  addClipItem: async (cardId, text) => {
    const trimmed = (text ?? "").trim();
    if (!trimmed) return;

    const now = Date.now();
    const isLink = looksLikeUrl(trimmed);

    const clip: ClipItem = {
      id: uuid(),
      cardId,
      type: isLink ? "link" : "text",
      text: isLink ? normalizeUrl(trimmed) : trimmed,
      createdAt: now,
    };

    // 1) DB
    await ClipRepository.create(clip);

    // 2) aggiorna updatedAt card (DB + UI)
    await CardRepository.updateFields(cardId, { updatedAt: now });

    // 3) UI
    set((state) => {
      const current = state.clipItemsByCardId[cardId] ?? [];
      return {
        clipItemsByCardId: {
          ...state.clipItemsByCardId,
          [cardId]: [clip, ...current],
        },
        cards: state.cards.map((c) =>
          c.id === cardId ? { ...c, updatedAt: now } : c
        ),
      };
    });
  },

  removeClipItem: async (cardId, clipId) => {
    // 1) DB
    await ClipRepository.deleteById(clipId);

    // 2) UI
    set((state) => {
      const current = state.clipItemsByCardId[cardId] ?? [];
      const next = current.filter((x) => x.id !== clipId);

      return {
        clipItemsByCardId: {
          ...state.clipItemsByCardId,
          [cardId]: next,
        },
      };
    });
  },

  getClipItems: (cardId) => {
    const map = get().clipItemsByCardId;
    return map[cardId] ?? [];
  },
}));
