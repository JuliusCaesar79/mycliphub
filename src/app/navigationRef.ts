import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "./navigation";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navToCardDetail(cardId: string) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate("CardDetail", { cardId });
}

export function getActiveCardDetailId(): string | null {
  if (!navigationRef.isReady()) return null;

  const route = navigationRef.getCurrentRoute();
  if (!route) return null;

  if (route.name !== "CardDetail") return null;

  const params: any = route.params;
  const cardId = params?.cardId;

  return typeof cardId === "string" && cardId.length > 0 ? cardId : null;
}