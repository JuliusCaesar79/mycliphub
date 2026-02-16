import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../app/navigation";
import { useCardStore } from "../../core/storage/cardStore";
import { Colors } from "../../app/theme";

type Props = NativeStackScreenProps<RootStackParamList, "CardDetail">;

export default function CardDetailScreen({ route, navigation }: Props) {
  const { cardId } = route.params;

  const card = useCardStore((s) => s.cards.find((c) => c.id === cardId));
  const loadClips = useCardStore((s) => s.loadClips);

  const addClipItem = useCardStore((s) => s.addClipItem);
  const removeClipItem = useCardStore((s) => s.removeClipItem);
  const clipItemsByCardId = useCardStore((s) => s.clipItemsByCardId);

  const clips = useMemo(
    () => clipItemsByCardId[cardId] ?? [],
    [clipItemsByCardId, cardId]
  );

  const [text, setText] = useState("");

  useEffect(() => {
    if (!card) {
      navigation.setOptions({ title: "Card" });
      return;
    }
    const title = `${card.title}${card.pinned ? " 📌" : ""}`;
    navigation.setOptions({ title });
  }, [card?.title, card?.pinned, navigation, card]);

  // Load clips from SQLite when opening this screen
  useEffect(() => {
    loadClips(cardId).catch((err) => {
      console.error("Failed to load clips:", err);
    });
  }, [cardId, loadClips]);

  if (!card) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
        }}
      >
        <Text style={{ color: Colors.deep, fontWeight: "700", fontSize: 16 }}>
          Card not found
        </Text>
        <Text style={{ marginTop: 8, color: Colors.muted, textAlign: "center" }}>
          This card may have been archived or deleted.
        </Text>
      </View>
    );
  }

  const onAdd = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    try {
      await addClipItem(cardId, trimmed);
      setText("");
    } catch (err) {
      console.error("Failed to add clip:", err);
      Alert.alert("Error", "Couldn't save this clip. Please try again.");
    }
  };

  // Android can be overly strict with canOpenURL for http/https.
  // For web links it's safe to try openURL directly.
  const onOpenLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Can't open link", "Something went wrong while opening the URL.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <View style={{ flex: 1, padding: 16 }}>
        {/* Header content (in-page) */}
        <Text style={{ fontSize: 24, fontWeight: "700", color: Colors.deep }}>
          {card.title}
        </Text>
        <Text style={{ marginTop: 6, color: Colors.muted }}>
          {card.pinned ? "📌 Pinned" : "Not pinned"}
        </Text>

        {/* Add Clip (inline) */}
        <View
          style={{
            marginTop: 16,
            backgroundColor: Colors.white,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#00000010",
            padding: 12,
          }}
        >
          <Text style={{ color: Colors.deep, fontWeight: "700", marginBottom: 8 }}>
            Add a clip
          </Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type something to save… (or paste a link)"
              placeholderTextColor={Colors.muted}
              style={{
                flex: 1,
                backgroundColor: "#00000006",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: Colors.deep,
              }}
              returnKeyType="done"
              onSubmitEditing={onAdd}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Pressable
              onPress={onAdd}
              style={{
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: Colors.accent,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: Colors.white, fontWeight: "800" }}>Add</Text>
            </Pressable>
          </View>
        </View>

        {/* Clips list */}
        <View style={{ marginTop: 16, flex: 1 }}>
          <Text style={{ color: Colors.deep, fontWeight: "800", marginBottom: 10 }}>
            Clips
          </Text>

          <FlatList
            data={clips}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View
                style={{
                  marginTop: 18,
                  alignItems: "center",
                  padding: 16,
                  backgroundColor: "#00000004",
                  borderRadius: 16,
                }}
              >
                <Text style={{ color: Colors.deep, fontWeight: "700" }}>
                  No clips yet
                </Text>
                <Text style={{ marginTop: 6, color: Colors.muted, textAlign: "center" }}>
                  Add your first clip above. This is your lightweight vault.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isLink = item.type === "link";

              return (
                <Pressable
                  onPress={() => {
                    if (isLink) onOpenLink(item.text);
                  }}
                  android_ripple={isLink ? { color: "#00000008" } : undefined}
                  style={{
                    backgroundColor: Colors.white,
                    borderRadius: 16,
                    padding: 12,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: "#00000010",
                  }}
                >
                  <Text style={{ color: Colors.deep, fontWeight: "800" }}>
                    {isLink ? "🔗 LINK" : "TEXT"}
                  </Text>

                  <Text
                    style={{
                      marginTop: 6,
                      color: Colors.deep,
                      textDecorationLine: isLink ? "underline" : "none",
                    }}
                    numberOfLines={isLink ? 2 : undefined}
                  >
                    {item.text}
                  </Text>

                  {isLink ? (
                    <Text style={{ marginTop: 6, color: Colors.muted }}>
                      Tap to open
                    </Text>
                  ) : null}

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "flex-end",
                      marginTop: 10,
                    }}
                  >
                    <Pressable
                      onPress={async () => {
                        try {
                          await removeClipItem(cardId, item.id);
                        } catch (err) {
                          console.error("Failed to remove clip:", err);
                          Alert.alert("Error", "Couldn't remove this clip.");
                        }
                      }}
                      android_ripple={{ color: "#00000010" }}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        backgroundColor: "#00000008",
                        overflow: "hidden",
                      }}
                    >
                      <Text style={{ color: Colors.deep, fontWeight: "700" }}>
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
