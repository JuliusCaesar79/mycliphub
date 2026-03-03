import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import AppNavigator from "./src/app/navigation";
import { initSchema } from "./src/core/db/schema";
import { useCardStore } from "./src/core/storage/cardStore";
import { wireShareToSaveOnce } from "./src/core/sharing/shareToSave";

// STEP 18 — Agenda
import { useEventStore } from "./src/core/storage/eventStore";

export default function App() {
  useEffect(() => {
    (async () => {
      try {
        await initSchema();

        // Cards boot
        await useCardStore.getState().loadFromDB();

        // STEP 18 (safe prefetch): load today's events so Agenda feels instant
        // Non blocca nulla se fallisce.
        try {
          const today = Date.now();
          const d = new Date(today);
          d.setHours(0, 0, 0, 0);
          await useEventStore.getState().loadEventsForDay(d.getTime());
        } catch {}

        // STEP 11 — Share-to-Save (Android)
        wireShareToSaveOnce();
      } catch (err) {
        console.error("DB bootstrap failed:", err);
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppNavigator />
    </GestureHandlerRootView>
  );
}