import React, { useEffect } from "react";
import AppNavigator from "./src/app/navigation";
import { initSchema } from "./src/core/db/schema";
import { useCardStore } from "./src/core/storage/cardStore";

export default function App() {
  useEffect(() => {
    (async () => {
      try {
        await initSchema();
        await useCardStore.getState().loadFromDB();
      } catch (err) {
        console.error("DB bootstrap failed:", err);
      }
    })();
  }, []);

  return <AppNavigator />;
}
