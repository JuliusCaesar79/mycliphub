import {
  NativeEventEmitter,
  NativeModules,
  Platform,
  ToastAndroid,
} from "react-native";
import { useCardStore } from "../storage/cardStore";
import { getActiveCardDetailId, navToCardDetail } from "../../app/navigationRef";

const { ShareToSaveModule } = NativeModules;

const emitter =
  Platform.OS === "android" && ShareToSaveModule
    ? new NativeEventEmitter(ShareToSaveModule)
    : null;

let wired = false;

// Dedup window: evita il doppio handling immediato (initial intent + runtime emit)
let lastRaw: string | null = null;
let lastAt = 0;
const DEDUP_WINDOW_MS = 1200;

let subscription: { remove: () => void } | null = null;

function logDebug(...args: any[]) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

function logError(message: string, err?: unknown) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.error(message, err);
  } else {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}

function looksLikeUrl(input: string) {
  const s = input.trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  return /^[a-z0-9.-]+\.[a-z]{2,}(\/|$|\?)/i.test(s);
}

function normalizeToUrl(input: string) {
  const s = input.trim();
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function clamp(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function makeAutoTitle(raw: string) {
  const compact = raw.replace(/\s+/g, " ").trim();
  if (!compact) return "New clip";

  if (looksLikeUrl(compact)) {
    try {
      const u = new URL(normalizeToUrl(compact));
      const host = u.host.replace(/^www\./i, "");

      let path = u.pathname || "";
      if (path === "/") path = "";

      const prettyPath = path ? clamp(path, 36) : "";
      const title = prettyPath ? `${host} — ${prettyPath}` : host;

      return clamp(title, 60);
    } catch {
      return clamp(compact, 40);
    }
  }

  return clamp(compact, 40);
}

export function wireShareToSaveOnce() {
  if (wired) return;
  wired = true;

  if (!emitter || !ShareToSaveModule) return;

  const handleShare = async (payload: { text?: string } | null | undefined) => {
    const raw = (payload?.text ?? "").trim();
    if (!raw) return;

    const now = Date.now();

    // Dedup robusto: blocca SOLO se stesso contenuto arriva entro una finestra breve
    if (raw === lastRaw && now - lastAt < DEDUP_WINDOW_MS) return;
    lastRaw = raw;
    lastAt = now;

    try {
      const { createCard, addClipItem } = useCardStore.getState();

      // ✅ STEP 14.1: se siamo già in CardDetail → append alla card aperta
      const activeCardId = getActiveCardDetailId();
      if (activeCardId) {
        await addClipItem(activeCardId, raw);
        navToCardDetail(activeCardId);

        if (Platform.OS === "android") {
          ToastAndroid.show("Added to current card", ToastAndroid.SHORT);
        }

        logDebug("[share-to-save] appended:", { cardId: activeCardId });
        return;
      }

      // altrimenti: comportamento classico → nuova card
      const title = makeAutoTitle(raw);
      const createdId = await createCard(title);

      const fallbackId = useCardStore.getState().cards[0]?.id;
      const cardId = (createdId as unknown as string | undefined) || fallbackId;

      if (!cardId || typeof cardId !== "string") {
        throw new Error("missing cardId after createCard()");
      }

      await addClipItem(cardId, raw);
      navToCardDetail(cardId);

      if (Platform.OS === "android") {
        ToastAndroid.show("Saved to MyClipHub", ToastAndroid.SHORT);
      }

      logDebug("[share-to-save] saved:", { cardId, title });
    } catch (err) {
      logError("[share-to-save] failed to save clip", err);
    }
  };

  subscription?.remove?.();
  subscription = emitter.addListener("share_to_save", handleShare);

  ShareToSaveModule.getInitialShare?.()
    .then(handleShare)
    .catch(() => {
      // no-op
    });
}