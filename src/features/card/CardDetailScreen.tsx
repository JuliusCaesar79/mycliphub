import React, { useEffect, useMemo, useRef, useState } from "react";
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

  // STEP 10.2: rename action (may not exist yet -> safe selector)
  const renameCard = useCardStore(
    (s: any) =>
      s.renameCard as
        | ((id: string, newTitle: string) => Promise<void> | void)
        | undefined
  );

  const clips = useMemo(
    () => clipItemsByCardId[cardId] ?? [],
    [clipItemsByCardId, cardId]
  );

  const [text, setText] = useState("");

  // --- STEP 10.2: inline title editing state ---
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const titleInputRef = useRef<TextInput>(null);

  // Keep draftTitle in sync when card changes (e.g., store refresh)
  useEffect(() => {
    if (!card) return;
    if (!isEditingTitle) setDraftTitle(card.title ?? "");
  }, [card?.title, card, isEditingTitle]);

  // Dynamic header title (also reflects draft while editing)
  useEffect(() => {
    if (!card) {
      navigation.setOptions({ title: "Card" });
      return;
    }

    const baseTitle = isEditingTitle
      ? (draftTitle || card.title || "Card")
      : card.title;

    const title = `${baseTitle}${card.pinned ? " 📌" : ""}`;
    navigation.setOptions({ title });
  }, [card?.title, card?.pinned, navigation, card, isEditingTitle, draftTitle]);

  // Load clips from SQLite when opening this screen
  useEffect(() => {
    loadClips(cardId).catch((err) => {
      console.error("Failed to load clips:", err);
    });
  }, [cardId, loadClips]);

  // Focus input after entering edit mode
  useEffect(() => {
    if (isEditingTitle) {
      const t = setTimeout(() => titleInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isEditingTitle]);

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

  const beginEditTitle = () => {
    setDraftTitle(card.title ?? "");
    setIsEditingTitle(true);
  };

  const cancelEditTitle = () => {
    setDraftTitle(card.title ?? "");
    setIsEditingTitle(false);
  };

  const commitTitle = async () => {
    const trimmed = draftTitle.trim();
    const nextTitle = trimmed.length ? trimmed : "Untitled";
    const current = (card.title ?? "").trim();

    // No-op if unchanged
    if (nextTitle === current) {
      setIsEditingTitle(false);
      setDraftTitle(card.title ?? "");
      return;
    }

    try {
      if (!renameCard) {
        Alert.alert(
          "Rename not wired yet",
          "The UI is ready, but 'renameCard' is missing in the store.\n\nAdd a renameCard(cardId, title) action that persists to SQLite and updates updatedAt."
        );
        // keep user in edit mode so they don't lose text
        return;
      }

      await renameCard(cardId, nextTitle);
      setIsEditingTitle(false);
    } catch (err) {
      console.error("Failed to rename card:", err);
      Alert.alert("Error", "Couldn't rename this card. Please try again.");
    }
  };

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
        <View style={{ marginBottom: 6 }}>
          {!isEditingTitle ? (
            <Pressable
              onPress={beginEditTitle}
              android_ripple={{ color: "#00000008" }}
              style={{ borderRadius: 12, paddingVertical: 4, overflow: "hidden" }}
            >
              <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.deep }}>
                {card.title}
              </Text>
              <Text style={{ marginTop: 4, color: Colors.muted }}>
                Tap to rename
              </Text>
            </Pressable>
          ) : (
            <View
              style={{
                backgroundColor: Colors.white,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "#00000010",
                padding: 10,
              }}
            >
              <Text style={{ color: Colors.deep, fontWeight: "800", marginBottom: 6 }}>
                Rename card
              </Text>

              <TextInput
                ref={titleInputRef}
                value={draftTitle}
                onChangeText={setDraftTitle}
                placeholder="Card title…"
                placeholderTextColor={Colors.muted}
                style={{
                  backgroundColor: "#00000006",
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: Colors.deep,
                  fontWeight: "700",
                }}
                returnKeyType="done"
                onSubmitEditing={commitTitle}
                onBlur={commitTitle}
                autoCapitalize="sentences"
                autoCorrect={false}
              />

              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <Pressable
                  onPress={cancelEditTitle}
                  android_ripple={{ color: "#00000010" }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: "#00000008",
                    overflow: "hidden",
                  }}
                >
                  <Text style={{ color: Colors.deep, fontWeight: "800" }}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={commitTitle}
                  android_ripple={{ color: "#ffffff33" }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: Colors.accent,
                    overflow: "hidden",
                  }}
                >
                  <Text style={{ color: Colors.white, fontWeight: "900" }}>Save</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

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
