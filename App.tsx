import React, { useEffect } from "react";
import AppNavigator from "./src/app/navigation";
import { initSchema } from "./src/core/db/schema";
import { useCardStore } from "./src/core/storage/cardStore";
import { wireShareToSaveOnce } from "./src/core/sharing/shareToSave";

export default function App() {
  useEffect(() => {
    (async () => {
      try {
        await initSchema();
        await useCardStore.getState().loadFromDB();

        // STEP 11 — Share-to-Save (Android)
        wireShareToSaveOnce();
      } catch (err) {
        console.error("DB bootstrap failed:", err);
      }
    })();
  }, []);

  return <AppNavigator />;
}
