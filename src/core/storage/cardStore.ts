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

  /**
   * STEP 16 — Search Globale Perfetta
   * Index in-memory: titolo + clip text (lowercased)
   * Così Inbox Search può filtrare senza roundtrip su SQLite.
   */
  searchBlobByCardId: Record<string, string>;

  loadFromDB: () => Promise<void>;
  loadClips: (cardId: string) => Promise<void>; // resta compatibile (detail), ma ora spesso è no-op

  createCard: (title?: string) => Promise<string>;

  togglePin: (id: string) => Promise<void>;
  archiveCard: (id: string) => Promise<void>;
  restoreCard: (id: string) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  renameCard: (id: string, newTitle: string) => Promise<void>;

  addClipItem: (cardId: string, text: string) => Promise<void>;
  removeClipItem: (cardId: string, clipId: string) => Promise<void>;

  getClipItems: (cardId: string) => ClipItem[];

  /**
   * Utility per UI Search: match rapido su indice.
   * (Non rompe nulla se non la usi subito)
   */
  matchesQuery: (cardId: string, query: string) => boolean;
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

const normForSearch = (value: string) =>
  (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const buildSearchBlob = (title: string, clips: ClipItem[]) => {
  const parts: string[] = [];
  const t = normForSearch(title);
  if (t) parts.push(t);

  for (const c of clips) {
    const tx = normForSearch(c.text);
    if (tx) parts.push(tx);
  }

  // Unico stringone: veloce da "includes"
  return parts.join(" • ");
};

export const useCardStore = create<CardState>((set, get) => ({
  cards: [],
  clipItemsByCardId: {},
  searchBlobByCardId: {},

  /**
   * STEP 16:
   * - carica cards
   * - carica TUTTI i clip al boot (anche per card mai aperte)
   * - costruisce indice searchBlobByCardId
   *
   * Nota: qui facciamo N query (una per card) usando getByCardId,
   * perché non assumiamo l’esistenza di ClipRepository.getAll().
   * STEP 19 potrà ottimizzare con una query unica.
   */
  loadFromDB: async () => {
    const cards = await CardRepository.getAll();
    sortCards(cards);

    // Prepara map vuote per stabilità
    const baseClipMap: Record<string, ClipItem[]> = {};
    const baseSearchMap: Record<string, string> = {};
    for (const c of cards) {
      baseClipMap[c.id] = [];
      baseSearchMap[c.id] = buildSearchBlob(c.title, []);
    }

    // Caricamento globale clip (best-effort, anche se una card fallisce)
    const results = await Promise.all(
      cards.map(async (c) => {
        try {
          const clips = await ClipRepository.getByCardId(c.id);
          return { cardId: c.id, clips };
        } catch {
          return { cardId: c.id, clips: [] as ClipItem[] };
        }
      })
    );

    for (const r of results) {
      baseClipMap[r.cardId] = r.clips;
      const card = cards.find((x) => x.id === r.cardId);
      baseSearchMap[r.cardId] = buildSearchBlob(card?.title ?? "", r.clips);
    }

    set(() => ({
      cards,
      clipItemsByCardId: baseClipMap,
      searchBlobByCardId: baseSearchMap,
    }));
  },

  /**
   * Compatibilità: CardDetail può chiamarlo sempre.
   * Se già abbiamo i clip (boot globale), evitiamo roundtrip.
   * Se per qualsiasi motivo manca la card, facciamo fetch.
   */
  loadClips: async (cardId: string) => {
    const existing = get().clipItemsByCardId[cardId];
    if (existing && existing.length > 0) return;

    const clips = await ClipRepository.getByCardId(cardId);

    set((state) => {
      const card = state.cards.find((c) => c.id === cardId);
      const nextSearch = buildSearchBlob(card?.title ?? "", clips);

      return {
        clipItemsByCardId: {
          ...state.clipItemsByCardId,
          [cardId]: clips,
        },
        searchBlobByCardId: {
          ...state.searchBlobByCardId,
          [cardId]: nextSearch,
        },
      };
    });
  },

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
      searchBlobByCardId: {
        ...state.searchBlobByCardId,
        [id]: buildSearchBlob(card.title, state.clipItemsByCardId[id] ?? []),
      },
    }));

    return id;
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
    const state = get();
    const card = state.cards.find((c) => c.id === id);
    if (!card) return;
    if (card.archived) return;

    const now = Date.now();

    await CardRepository.updateFields(id, {
      archived: true,
      updatedAt: now,
    });

    set((s) => {
      const nextCards = s.cards.map((c) =>
        c.id === id ? { ...c, archived: true, updatedAt: now } : c
      );
      sortCards(nextCards);
      return { cards: nextCards };
    });
  },

  restoreCard: async (id) => {
    const state = get();
    const card = state.cards.find((c) => c.id === id);
    if (!card) return;
    if (!card.archived) return;

    const now = Date.now();

    await CardRepository.updateFields(id, {
      archived: false,
      updatedAt: now,
    });

    set((s) => {
      const nextCards = s.cards.map((c) =>
        c.id === id ? { ...c, archived: false, updatedAt: now } : c
      );
      sortCards(nextCards);
      return { cards: nextCards };
    });
  },

  deleteCard: async (id) => {
    const state = get();
    const card = state.cards.find((c) => c.id === id);
    if (!card) return;

    // DB: delete children first (avoid orphans)
    await ClipRepository.deleteByCardId(id);
    await CardRepository.deleteById(id);

    set((s) => {
      const nextCards = s.cards.filter((c) => c.id !== id);

      const nextClips = { ...s.clipItemsByCardId };
      if (nextClips[id]) delete nextClips[id];

      const nextSearch = { ...s.searchBlobByCardId };
      if (nextSearch[id]) delete nextSearch[id];

      sortCards(nextCards);

      return {
        cards: nextCards,
        clipItemsByCardId: nextClips,
        searchBlobByCardId: nextSearch,
      };
    });
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

      const clips = s.clipItemsByCardId[id] ?? [];
      const nextBlob = buildSearchBlob(nextTitle, clips);

      return {
        cards: nextCards,
        searchBlobByCardId: {
          ...s.searchBlobByCardId,
          [id]: nextBlob,
        },
      };
    });
  },

  addClipItem: async (cardId, text) => {
    const trimmed = (text ?? "").trim();
    if (!trimmed) return;

    const isLink = looksLikeUrl(trimmed);
    const normalizedText = isLink ? normalizeUrl(trimmed) : trimmed;
    const nextType: ClipItemType = isLink ? "link" : "text";

    // ✅ Dedup identico nella stessa card (no DB write)
    const existing = get().clipItemsByCardId[cardId] ?? [];
    const alreadyThere = existing.some(
      (c) => c.type === nextType && c.text === normalizedText
    );
    if (alreadyThere) return;

    const now = Date.now();

    const clip: ClipItem = {
      id: uuid(),
      cardId,
      type: nextType,
      text: normalizedText,
      createdAt: now,
    };

    await ClipRepository.create(clip);
    await CardRepository.updateFields(cardId, { updatedAt: now });

    set((state) => {
      const current = state.clipItemsByCardId[cardId] ?? [];
      const nextClips = [clip, ...current];

      const nextCards = state.cards.map((c) =>
        c.id === cardId ? { ...c, updatedAt: now } : c
      );
      sortCards(nextCards);

      const card = nextCards.find((c) => c.id === cardId);
      const nextBlob = buildSearchBlob(card?.title ?? "", nextClips);

      return {
        clipItemsByCardId: {
          ...state.clipItemsByCardId,
          [cardId]: nextClips,
        },
        searchBlobByCardId: {
          ...state.searchBlobByCardId,
          [cardId]: nextBlob,
        },
        cards: nextCards,
      };
    });
  },

  removeClipItem: async (cardId, clipId) => {
    await ClipRepository.deleteById(clipId);

    set((state) => {
      const current = state.clipItemsByCardId[cardId] ?? [];
      const next = current.filter((x) => x.id !== clipId);

      const card = state.cards.find((c) => c.id === cardId);
      const nextBlob = buildSearchBlob(card?.title ?? "", next);

      return {
        clipItemsByCardId: {
          ...state.clipItemsByCardId,
          [cardId]: next,
        },
        searchBlobByCardId: {
          ...state.searchBlobByCardId,
          [cardId]: nextBlob,
        },
      };
    });
  },

  getClipItems: (cardId) => {
    const map = get().clipItemsByCardId;
    return map[cardId] ?? [];
  },

  matchesQuery: (cardId, query) => {
    const q = normForSearch(query);
    if (!q) return true;

    const blob = get().searchBlobByCardId[cardId] ?? "";
    return blob.includes(q);
  },
}));