import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  Share,
  StyleSheet,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../app/navigation";
import { useCardStore } from "../../core/storage/cardStore";
import { Colors } from "../../app/theme";

import Icon from "../../ui/Icon";
import ButtonPrimary from "../../ui/ButtonPrimary";
import ButtonSecondary from "../../ui/ButtonSecondary";
import Badge from "../../ui/Badge";
import CardContainer from "../../ui/CardContainer";

type Props = NativeStackScreenProps<RootStackParamList, "CardDetail">;

function buildShareMessage(args: {
  title: string;
  pinned?: boolean;
  clips: Array<{ type: string; text: string }>;
}) {
  const title = (args.title ?? "").trim() || "Untitled";
  const pinned = args.pinned ? " [PIN]" : "";
  const header = `${title}${pinned}`;

  const lines =
    args.clips?.length > 0
      ? args.clips.map((c) => {
          const t = (c?.text ?? "").trim();
          const isLink = c?.type === "link";
          const prefix = isLink ? "[LINK]" : "-";
          return `${prefix} ${t}`;
        })
      : ["(No clips yet)"];

  return [header, "-", ...lines].join("\n");
}

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

  const deep = (Colors as any).deep ?? Colors.deep ?? "#0F172A";
  const muted = (Colors as any).muted ?? Colors.muted ?? "#6B7280";
  const lightAccent = (Colors as any).lightAccent ?? "#DBEAFE";

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
      ? draftTitle || card.title || "Card"
      : card.title;

    const title = `${baseTitle}${card.pinned ? " [PIN]" : ""}`;
    navigation.setOptions({ title });
  }, [card?.title, card?.pinned, navigation, card, isEditingTitle, draftTitle]);

  /**
   * STEP 16: clips are usually loaded at boot.
   * Fallback: if we don't have them in memory yet, load them.
   */
  useEffect(() => {
    const hasKey = Object.prototype.hasOwnProperty.call(
      clipItemsByCardId,
      cardId
    );
    if (hasKey) return;

    loadClips(cardId).catch((err) => {
      console.error("Failed to load clips:", err);
    });
  }, [cardId, loadClips, clipItemsByCardId]);

  // Focus input after entering edit mode
  useEffect(() => {
    if (isEditingTitle) {
      const t = setTimeout(() => titleInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isEditingTitle]);

  if (!card) {
    return (
      <View style={[styles.notFoundWrap, { backgroundColor: Colors.background }]}>
        <Text style={[styles.notFoundTitle, { color: deep }]}>Card not found</Text>
        <Text style={[styles.notFoundText, { color: muted }]}>
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

  // For web links it's safe to try openURL directly.
  const onOpenLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Can't open link", "Something went wrong while opening the URL.");
    }
  };

  const onShare = async () => {
    try {
      const message = buildShareMessage({
        title: card.title ?? "Untitled",
        pinned: card.pinned,
        clips: clips.map((c) => ({ type: c.type, text: c.text })),
      });

      await Share.share(
        { message, title: card.title ?? "MyClipHub Card" },
        { dialogTitle: "Share card" }
      );
    } catch (err) {
      console.error("Failed to share card:", err);
      Alert.alert("Error", "Couldn't open the share sheet.");
    }
  };

  const removeClip = useCallback(
    async (clipId: string) => {
      try {
        await removeClipItem(cardId, clipId);
      } catch (err) {
        console.error("Failed to remove clip:", err);
        Alert.alert("Error", "Couldn't remove this clip.");
      }
    },
    [removeClipItem, cardId]
  );

  const pinnedLabel = card.pinned ? "PINNED" : "NOT PINNED";
  const pinnedTone = card.pinned ? ("primary" as const) : ("muted" as const);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <View style={styles.container}>
        {/* Title / Rename */}
        <View style={styles.topBlock}>
          {!isEditingTitle ? (
            <Pressable
              onPress={beginEditTitle}
              android_ripple={{ color: "#00000008" }}
              style={styles.renamePressable}
              accessibilityRole="button"
              accessibilityLabel="Rename card"
            >
              <Text style={[styles.bigTitle, { color: deep }]}>{card.title}</Text>
              <Text style={[styles.subtitle, { color: muted }]}>Tap to rename</Text>
            </Pressable>
          ) : (
            <CardContainer style={styles.renameCard}>
              <Text style={[styles.sectionTitle, { color: deep }]}>Rename card</Text>

              <TextInput
                ref={titleInputRef}
                value={draftTitle}
                onChangeText={setDraftTitle}
                placeholder="Card title..."
                placeholderTextColor={muted}
                style={[styles.input, styles.titleInput, { color: deep }]}
                returnKeyType="done"
                onSubmitEditing={commitTitle}
                onBlur={commitTitle}
                autoCapitalize="sentences"
                autoCorrect={false}
              />

              <View style={styles.rowButtons}>
                <ButtonSecondary
                  title="Cancel"
                  icon="close-circle-outline"
                  onPress={cancelEditTitle}
                  style={styles.halfBtn}
                />
                <ButtonPrimary
                  title="Save"
                  icon="checkmark-circle-outline"
                  onPress={commitTitle}
                  style={styles.halfBtn}
                />
              </View>
            </CardContainer>
          )}
        </View>

        {/* Status row + Share */}
        <View style={styles.statusRow}>
          <View style={styles.badgesRow}>
            <Badge label={pinnedLabel} tone={pinnedTone} variant="soft" icon="bookmark-outline" />
            <Badge label={`${clips.length} CLIPS`} tone="default" variant="soft" icon="albums-outline" />
          </View>

          <ButtonSecondary
            title="Share"
            icon="share-outline"
            onPress={onShare}
            style={[styles.shareBtn, { borderColor: "#00000010", backgroundColor: lightAccent }]}
            textStyle={{ color: deep }}
          />
        </View>

        {/* Add Clip */}
        <CardContainer style={styles.addClipCard}>
          <Text style={[styles.sectionTitle, { color: deep }]}>Add a clip</Text>

          <View style={styles.addRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type something to save... (or paste a link)"
              placeholderTextColor={muted}
              style={[styles.input, styles.clipInput, { color: deep }]}
              returnKeyType="done"
              onSubmitEditing={onAdd}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <ButtonPrimary
              title="Add"
              icon="add-outline"
              onPress={onAdd}
              style={styles.addBtn}
            />
          </View>
        </CardContainer>

        {/* Clips list */}
        <View style={styles.listBlock}>
          <Text style={[styles.sectionTitle, { color: deep }]}>Clips</Text>

          <FlatList
            data={clips}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 10 }}
            ListEmptyComponent={
              <View style={styles.emptyClips}>
                <Text style={[styles.emptyTitle, { color: deep }]}>No clips yet</Text>
                <Text style={[styles.emptyText, { color: muted }]}>
                  Add your first clip above. This is your lightweight vault.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isLink = item.type === "link";

              return (
                <View style={styles.clipRowOuter}>
                  <CardContainer style={styles.clipCard}>
                    <Pressable
                      onPress={() => {
                        if (isLink) onOpenLink(item.text);
                      }}
                      android_ripple={isLink ? { color: "#00000008" } : undefined}
                      style={styles.clipPressable}
                      accessibilityRole={isLink ? "button" : undefined}
                      accessibilityLabel={isLink ? "Open link" : undefined}
                    >
                      <View style={styles.clipHeader}>
                        {isLink ? (
                          <Icon name="link-outline" size={18} color={deep} />
                        ) : (
                          <Icon name="text-outline" size={18} color={deep} />
                        )}

                        <Text style={[styles.clipKind, { color: deep }]}>
                          {isLink ? "Link" : "Text"}
                        </Text>

                        {isLink ? (
                          <View style={{ marginLeft: 8 }}>
                            <Badge label="TAP TO OPEN" tone="primary" variant="soft" />
                          </View>
                        ) : null}
                      </View>

                      <Text
                        style={[
                          styles.clipText,
                          {
                            color: deep,
                            textDecorationLine: isLink ? "underline" : "none",
                          },
                        ]}
                        numberOfLines={isLink ? 2 : undefined}
                      >
                        {item.text}
                      </Text>

                      <View style={styles.clipFooter}>
                        <ButtonSecondary
                          title="Remove"
                          icon="trash-outline"
                          onPress={() => removeClip(item.id)}
                          style={styles.removeBtn}
                        />
                      </View>
                    </Pressable>
                  </CardContainer>
                </View>
              );
            }}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  notFoundWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  notFoundTitle: { fontWeight: "700", fontSize: 16 },
  notFoundText: { marginTop: 8, textAlign: "center" },

  container: { flex: 1, padding: 16 },

  topBlock: { marginBottom: 6 },
  renamePressable: { borderRadius: 12, paddingVertical: 4, overflow: "hidden" },
  bigTitle: { fontSize: 24, fontWeight: "800" },
  subtitle: { marginTop: 4 },

  renameCard: { padding: 12 },
  sectionTitle: { fontWeight: "800", marginBottom: 8 },

  rowButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  halfBtn: { flex: 1 },

  statusRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  badgesRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  shareBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },

  addClipCard: { marginTop: 16, padding: 12 },
  addRow: { flexDirection: "row", gap: 10, alignItems: "center" },

  input: {
    backgroundColor: "#00000006",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#00000010",
  },
  titleInput: { fontWeight: "700" },
  clipInput: { flex: 1 },

  addBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },

  listBlock: { marginTop: 16, flex: 1 },
  emptyClips: {
    marginTop: 18,
    alignItems: "center",
    padding: 16,
    backgroundColor: "#00000004",
    borderRadius: 16,
  },
  emptyTitle: { fontWeight: "700" },
  emptyText: { marginTop: 6, textAlign: "center" },

  clipRowOuter: { marginBottom: 10 },
  clipCard: { padding: 0, overflow: "hidden" },
  clipPressable: { padding: 12 },

  clipHeader: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  clipKind: { fontWeight: "800" },

  clipText: { marginTop: 8 },

  clipFooter: { marginTop: 12, alignItems: "flex-end" },
  removeBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
});