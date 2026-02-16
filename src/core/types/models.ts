export type UUID = string;

export type ClipType = "text" | "link" | "qr" | "ocr" | "file" | "image";

export type ClipItem = {
  id: UUID;
  cardId: UUID;
  type: ClipType;
  payload: string; // for MVP we keep it simple
  createdAt: number;
};

export type Card = {
  id: UUID;
  title: string;
  note?: string;
  pinned: boolean;
  archived: boolean;
  dueDate?: number; // timestamp (ms)
  createdAt: number;
  updatedAt: number;
};
