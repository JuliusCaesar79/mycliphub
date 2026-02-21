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

  clipItemsByCardId: Record<string, ClipItem[]>;

  loadFromDB: () => Promise<void>;
  loadClips: (cardId: string) => Promise<void>;

  // 🔥 FIX: ora ritorna string (cardId)
  createCard: (title?: string) => Promise<string>;

  togglePin: (id: string) => Promise<void>;
  archiveCard: (id: string) => Promise<void>;
  renameCard: (id: string, newTitle: string) => Promise<void>;

  addClipItem: (cardId: string, text: string) => Promise<void>;
  removeClipItem: (cardId: string, clipId: string) => Promise<void>;

  getClipItems: (cardId: string) => ClipItem[];
};

const looksLikeUrl = (value: string) => {
  const v = value.trim();
  return /^https?:\/\/\S+$/i.test(v);
};

const normalizeUrl = (value: string) => value.trim();

const normalizeTitle = (value: string) => {
  const t = (value ?? "").trim();
  return t.length ? t : "Untitled";
};

const sortCards = (cards: Card[]) => {
  cards.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
};

export const useCardStore = create<CardState>((set, get) => ({
  cards: [],
  clipItemsByCardId: {},

  loadFromDB: async () => {
    const cards = await CardRepository.getAll();
    sortCards(cards);

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

  // 🔥 FIX CRITICO QUI
  createCard: async (title) => {
    const now = Date.now();
    const id = uuid();

    const card: Card = {
      id,
      title: normalizeTitle(title ?? ""),
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

    return id; // ✅ QUESTO ERA IL PROBLEMA
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

      sortCards(nextCards);
      return { cards: nextCards };
    });
  },

  archiveCard: async (id) => {
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

  renameCard: async (id, newTitle) => {
    const state = get();
    const card = state.cards.find((c) => c.id === id);
    if (!card) return;

    const nextTitle = normalizeTitle(newTitle);
    const currentTitle = normalizeTitle(card.title);
    if (nextTitle === currentTitle) return;

    const now = Date.now();

    await CardRepository.updateFields(id, {
      title: nextTitle,
      updatedAt: now,
    });

    set((s) => {
      const nextCards = s.cards.map((c) =>
        c.id === id ? { ...c, title: nextTitle, updatedAt: now } : c
      );

      sortCards(nextCards);
      return { cards: nextCards };
    });
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

    await ClipRepository.create(clip);
    await CardRepository.updateFields(cardId, { updatedAt: now });

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
    await ClipRepository.deleteById(clipId);

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
