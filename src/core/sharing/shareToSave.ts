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

      // Titolo automatico: primi 40 caratteri (senza andare a capo)
      const compact = raw.replace(/\s+/g, " ").trim();
      const title = compact.length > 40 ? `${compact.substring(0, 40)}…` : compact;

      const createdId = await createCard(title);

      // Fallback robusto: se per qualsiasi motivo non torna l'id, prendi la prima card (appena creata)
      const fallbackId = useCardStore.getState().cards[0]?.id;
      const cardId = (createdId as unknown as string | undefined) || fallbackId;

      if (!cardId || typeof cardId !== "string") {
        throw new Error("missing cardId after createCard()");
      }

      await addClipItem(cardId, raw);
      navToCardDetail(cardId);

      // ✅ Feedback utente: toast nativo Android (zero dipendenze)
      if (Platform.OS === "android") {
        ToastAndroid.show("Saved to MyClipHub", ToastAndroid.SHORT);
      }

      logDebug("[share-to-save] saved:", { cardId, title });
    } catch (err) {
      logError("[share-to-save] failed to save clip", err);
    }
  };

  // Evita doppie subscriptions se in futuro richiami per sbaglio (extra hardening)
  subscription?.remove?.();
  subscription = emitter.addListener("share_to_save", handleShare);

  ShareToSaveModule.getInitialShare?.()
    .then(handleShare)
    .catch(() => {
      // no-op
    });
}