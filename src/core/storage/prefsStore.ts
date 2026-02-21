import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ShareBehavior = "new" | "append_current" | "append_last";

type PrefsState = {
  shareBehavior: ShareBehavior;
  setShareBehavior: (v: ShareBehavior) => void;

  lastOpenedCardId: string | null;
  setLastOpenedCardId: (id: string | null) => void;
};

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      shareBehavior: "append_current", // ✅ default “smart” ma safe
      setShareBehavior: (v) => set({ shareBehavior: v }),

      lastOpenedCardId: null,
      setLastOpenedCardId: (id) => set({ lastOpenedCardId: id }),
    }),
    {
      name: "mycliphub_prefs_v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        shareBehavior: s.shareBehavior,
        lastOpenedCardId: s.lastOpenedCardId,
      }),
    }
  )
);