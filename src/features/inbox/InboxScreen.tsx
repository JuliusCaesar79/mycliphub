import React from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Colors } from "../../app/theme";
import { useCardStore } from "../../core/storage/cardStore";
import { RootStackParamList } from "../../app/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Inbox">;

export default function InboxScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const cards = useCardStore((s) => s.cards);
  const createCard = useCardStore((s) => s.createCard);
  const togglePin = useCardStore((s) => s.togglePin);
  const archiveCard = useCardStore((s) => s.archiveCard);

  const visible = cards.filter((c) => !c.archived);

  const pinned = visible.filter((c) => c.pinned);
  const normal = visible.filter((c) => !c.pinned);

  const data = [...pinned, ...normal];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        data={data}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={{ marginTop: 48, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: Colors.deep,
              }}
            >
              Inbox
            </Text>
            <Text style={{ marginTop: 10, color: Colors.primary }}>
              No cards yet. Tap + to create one.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
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
            <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.deep }}>
              {item.title} {item.pinned ? "📌" : ""}
            </Text>

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
                <Text style={{ color: Colors.deep, fontWeight: "600" }}>
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
                <Text style={{ color: Colors.deep, fontWeight: "600" }}>
                  Archive
                </Text>
              </Pressable>
            </View>
          </Pressable>
        )}
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
        <Text style={{ color: Colors.white, fontSize: 28, fontWeight: "800" }}>
          +
        </Text>
      </Pressable>
    </View>
  );
}
