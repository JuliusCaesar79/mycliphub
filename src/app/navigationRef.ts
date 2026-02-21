import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "./navigation";

export const navigationRef =
  createNavigationContainerRef<RootStackParamList>();

export function navToCardDetail(cardId: string) {
  if (navigationRef.isReady()) {
    navigationRef.navigate("CardDetail", { cardId });
  }
}
