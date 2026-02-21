import { NativeEventEmitter, NativeModules, Platform } from "react-native";
import { useCardStore } from "../storage/cardStore";
import { navToCardDetail } from "../../app/navigationRef";

const { ShareToSaveModule } = NativeModules;

const emitter =
  Platform.OS === "android" && ShareToSaveModule
    ? new NativeEventEmitter(ShareToSaveModule)
    : null;

let wired = false;
let lastRaw: string | null = null;

export function wireShareToSaveOnce() {
  if (wired) return;
  wired = true;

  if (!emitter || !ShareToSaveModule) return;

  const handleShare = async (payload: { text?: string } | null | undefined) => {
    const raw = (payload?.text ?? "").trim();
    if (!raw) return;

    // Avoid duplicate handling (initial intent + runtime emit)
    if (raw === lastRaw) return;
    lastRaw = raw;

    try {
      const { createCard, addClipItem, cards } = useCardStore.getState();

      // Titolo automatico: primi 40 caratteri (senza andare a capo)
      const compact = raw.replace(/\s+/g, " ").trim();
      const title = compact.length > 40 ? `${compact.substring(0, 40)}…` : compact;

      const createdId = await createCard(title);

      // Fallback robusto: se per qualsiasi motivo non torna l'id, prendi la prima card (appena creata)
      const fallbackId = useCardStore.getState().cards[0]?.id;
      const cardId = (createdId as unknown as string | undefined) || fallbackId;

      if (!cardId || typeof cardId !== "string") {
        throw new Error("Share-to-save: missing cardId");
      }

      await addClipItem(cardId, raw);
      navToCardDetail(cardId);
    } catch (err) {
      console.error("Share-to-save failed:", err);
    }
  };

  emitter.addListener("share_to_save", handleShare);

  ShareToSaveModule.getInitialShare?.()
    .then(handleShare)
    .catch(() => {});
}
