import React, { useLayoutEffect, useMemo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Colors } from "../../app/theme";
import { useCardStore } from "../../core/storage/cardStore";
import { RootStackParamList } from "../../app/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Inbox">;

// ---- tiny date helpers (safe, no Intl dependency) ----
function toMs(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  if (typeof value === "string") {
    const n = Number(value);
    if (!Number.isNaN(n)) return n < 1e12 ? n * 1000 : n;
    const d = new Date(value);
    const t = d.getTime();
    return Number.isFinite(t) ? t : 0;
  }
  if (value instanceof Date) return value.getTime();
  return 0;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDateTime(ms: number) {
  if (!ms) return "";
  const d = new Date(ms);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dd = pad2(d.getDate());
  const mon = months[d.getMonth()] ?? "";
  const yyyy = d.getFullYear();
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${dd} ${mon} ${yyyy}, ${hh}:${mm}`;
}

export default function InboxScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const cards = useCardStore((s) => s.cards);
  const clipItemsByCardId = useCardStore((s) => s.clipItemsByCardId);

  const createCard = useCardStore((s) => s.createCard);
  const togglePin = useCardStore((s) => s.togglePin);
  const archiveCard = useCardStore((s) => s.archiveCard);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate("Settings")}
          android_ripple={{ color: "#00000010", borderless: true }}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 12,
            overflow: "hidden",
            backgroundColor: "#00000008",
          }}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Text style={{ color: Colors.deep, fontWeight: "800", fontSize: 14 }}>
            ⚙️
          </Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  const data = useMemo(() => {
    const visible = cards.filter((c) => !c.archived);

    const getSortKey = (c: any) => toMs(c.updatedAt) || toMs(c.createdAt) || 0;

    return [...visible].sort((a: any, b: any) => {
      const pa = a.pinned ? 1 : 0;
      const pb = b.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;

      const ka = getSortKey(a);
      const kb = getSortKey(b);
      if (ka !== kb) return kb - ka;

      const ta = String(a.title ?? "");
      const tb = String(b.title ?? "");
      if (ta !== tb) return ta.localeCompare(tb);
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });
  }, [cards]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        data={data}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={{ marginTop: 56, alignItems: "center", paddingHorizontal: 18 }}>
            <Text style={{ fontSize: 34, marginBottom: 10 }}>🗂️</Text>

            <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.deep }}>
              Your Inbox is empty
            </Text>

            <Text style={{ marginTop: 10, color: Colors.primary, textAlign: "center", lineHeight: 20 }}>
              Create a card to start collecting notes and links.
              {"\n"}Tip: you can also “Share to MyClipHub”.
            </Text>

            <Pressable
              onPress={() => createCard("New Card")}
              android_ripple={{ color: "#00000010" }}
              style={{
                marginTop: 16,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 14,
                backgroundColor: (Colors as any).lightAccent ?? "#DBEAFE",
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "#00000010",
              }}
            >
              <Text style={{ color: Colors.deep, fontWeight: "800" }}>Create card</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const createdMs = toMs((item as any).createdAt);
          const updatedMs = toMs((item as any).updatedAt);

          const hasMeaningfulUpdate = updatedMs && updatedMs !== createdMs;
          const label = hasMeaningfulUpdate ? "Updated" : "Created";
          const shownMs = hasMeaningfulUpdate ? updatedMs : createdMs;

          const clips = clipItemsByCardId[item.id] ?? [];
          const isShared = clips.length > 0;

          return (
            <Pressable
              onPress={() => navigation.navigate("CardDetail", { cardId: item.id })}
              android_ripple={{ color: "#00000008" }}
              style={{
                backgroundColor: Colors.white,
                borderRadius: 16,
                padding: 14,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#00000010",
              }}
            >
              {/* Title Row */}
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.deep }}>
                  {item.title} {item.pinned ? "📌" : ""}
                </Text>

                {isShared && (
                  <View
                    style={{
                      marginLeft: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 999,
                      backgroundColor: "#E6F0FF",
                      borderWidth: 1,
                      borderColor: "#D0E2FF",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: "#1D4ED8",
                        letterSpacing: 0.3,
                      }}
                    >
                      SHARED
                    </Text>
                  </View>
                )}
              </View>

              {!!shownMs && (
                <Text style={{ marginTop: 6, fontSize: 12, color: "#00000066" }}>
                  {label} {formatDateTime(shownMs)}
                </Text>
              )}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <Pressable
                  onPress={() => togglePin(item.id)}
                  android_ripple={{ color: "#00000010" }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: (Colors as any).lightAccent ?? "#DBEAFE",
                    overflow: "hidden",
                  }}
                >
                  <Text style={{ color: Colors.deep, fontWeight: "700" }}>
                    {item.pinned ? "Unpin" : "Pin"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => archiveCard(item.id)}
                  android_ripple={{ color: "#00000010" }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: "#00000008",
                    overflow: "hidden",
                  }}
                >
                  <Text style={{ color: Colors.deep, fontWeight: "700" }}>Archive</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        }}
      />

      {/* FAB */}
      <Pressable
        onPress={() => createCard("New Card")}
        android_ripple={{ color: "#ffffff33" }}
        style={{
          position: "absolute",
          right: 18,
          bottom: 18 + insets.bottom,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: Colors.accent,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 6,
          overflow: "hidden",
        }}
      >
        <Text style={{ color: Colors.white, fontSize: 28, fontWeight: "900" }}>+</Text>
      </Pressable>
    </View>
  );
}