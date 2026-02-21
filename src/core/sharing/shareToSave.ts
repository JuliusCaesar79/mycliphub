import {
  NativeEventEmitter,
  NativeModules,
  Platform,
  ToastAndroid,
} from "react-native";
import { useCardStore } from "../storage/cardStore";
import { navToCardDetail } from "../../app/navigationRef";

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
  // accetta URL con schema o domini "nudi" tipo example.com/abc
  const s = input.trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  // dominio.tld con opzionale path/query
  return /^[a-z0-9.-]+\.[a-z]{2,}(\/|$|\?)/i.test(s);
}

function normalizeToUrl(input: string) {
  const s = input.trim();
  if (/^https?:\/\//i.test(s)) return s;
  // per domini nudi, aggiungiamo https:// per poter usare URL()
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

      // path “umana”: niente slash finale, niente query lunga
      let path = u.pathname || "";
      if (path === "/") path = "";

      // Preferiamo host + un path corto e leggibile
      const prettyPath = path ? clamp(path, 36) : "";
      const title = prettyPath ? `${host} — ${prettyPath}` : host;

      return clamp(title, 60);
    } catch {
      // fallback se URL() fallisce
      return clamp(compact, 40);
    }
  }

  // fallback testo normale
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

      const title = makeAutoTitle(raw);

      const createdId = await createCard(title);

      // Fallback robusto: se per qualsiasi motivo non torna l'id, prendi la prima card (appena creata)
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