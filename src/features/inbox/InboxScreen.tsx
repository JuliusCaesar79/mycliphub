import React, {
  useLayoutEffect,
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { Alert, FlatList, Pressable, Text, View, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Swipeable } from "react-native-gesture-handler";

import { Colors } from "../../app/theme";
import { useCardStore } from "../../core/storage/cardStore";
import { RootStackParamList } from "../../app/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Inbox">;

type TabKey = "inbox" | "archive";

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
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dd = pad2(d.getDate());
  const mon = months[d.getMonth()] ?? "";
  const yyyy = d.getFullYear();
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${dd} ${mon} ${yyyy}, ${hh}:${mm}`;
}

function Segmented({
  value,
  onChange,
}: {
  value: TabKey;
  onChange: (v: TabKey) => void;
}) {
  const isInbox = value === "inbox";
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: "#00000008",
        padding: 4,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#00000010",
      }}
    >
      <Pressable
        onPress={() => onChange("inbox")}
        android_ripple={{ color: "#00000010" }}
        style={{
          flex: 1,
          paddingVertical: 8,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: isInbox ? Colors.white : "transparent",
          borderWidth: isInbox ? 1 : 0,
          borderColor: isInbox ? "#00000010" : "transparent",
          alignItems: "center",
        }}
        accessibilityRole="button"
        accessibilityLabel="Show Inbox"
      >
        <Text style={{ fontWeight: "800", color: Colors.deep }}>Inbox</Text>
      </Pressable>

      <Pressable
        onPress={() => onChange("archive")}
        android_ripple={{ color: "#00000010" }}
        style={{
          flex: 1,
          paddingVertical: 8,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: !isInbox ? Colors.white : "transparent",
          borderWidth: !isInbox ? 1 : 0,
          borderColor: !isInbox ? "#00000010" : "transparent",
          alignItems: "center",
        }}
        accessibilityRole="button"
        accessibilityLabel="Show Archive"
      >
        <Text style={{ fontWeight: "800", color: Colors.deep }}>Archive</Text>
      </Pressable>
    </View>
  );
}

function normalizeQuery(q: string) {
  return (q ?? "").trim().toLowerCase();
}

function SwipeAction({
  title,
  subtitle,
  emoji,
  bg,
  fg,
  onPress,
  align = "left",
}: {
  title: string;
  subtitle: string;
  emoji: string;
  bg: string;
  fg: string;
  onPress: () => void;
  align?: "left" | "right";
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "#00000010" }}
      style={{
        width: 160,
        height: "100%",
        backgroundColor: bg,
        justifyContent: "center",
        paddingHorizontal: 14,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#00000010",
        alignItems: align === "right" ? "flex-end" : "flex-start",
      }}
    >
      <Text style={{ color: fg, fontWeight: "900", fontSize: 14 }}>
        {emoji} {title}
      </Text>
      <Text style={{ marginTop: 2, color: fg, opacity: 0.85, fontSize: 12 }}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

type CardRowProps = {
  item: any;
  tab: TabKey;
  isShared: boolean;
  label: string;
  shownMs: number;
  onOpen: () => void;
  onTogglePin: () => Promise<void> | void;
  onArchive: () => Promise<void> | void;
  onRestore: () => Promise<void> | void;
  onDelete: () => void;
};

function CardRow({
  item,
  tab,
  isShared,
  label,
  shownMs,
  onOpen,
  onTogglePin,
  onArchive,
  onRestore,
  onDelete,
}: CardRowProps) {
  const swipeRef = useRef<Swipeable | null>(null);

  const close = () => swipeRef.current?.close();

  const renderLeftActions = () => {
    // Swipe RIGHT
    if (tab === "inbox") {
      return (
        <View style={{ justifyContent: "center", paddingRight: 10 }}>
          <SwipeAction
            emoji="📌"
            title={item.pinned ? "Unpin" : "Pin"}
            subtitle="Swipe right"
            bg={(Colors as any).lightAccent ?? "#DBEAFE"}
            fg={Colors.deep}
            onPress={() => {
              close();
              onTogglePin();
            }}
            align="left"
          />
        </View>
      );
    }

    return (
      <View style={{ justifyContent: "center", paddingRight: 10 }}>
        <SwipeAction
          emoji="↩️"
          title="Restore"
          subtitle="Swipe right"
          bg={(Colors as any).lightAccent ?? "#DBEAFE"}
          fg={Colors.deep}
          onPress={() => {
            close();
            onRestore();
          }}
          align="left"
        />
      </View>
    );
  };

  const renderRightActions = () => {
    // Swipe LEFT
    if (tab === "inbox") {
      return (
        <View style={{ justifyContent: "center", paddingLeft: 10, alignItems: "flex-end" }}>
          <SwipeAction
            emoji="🗄️"
            title="Archive"
            subtitle="Swipe left"
            bg="#00000008"
            fg={Colors.deep}
            onPress={() => {
              close();
              onArchive();
            }}
            align="right"
          />
        </View>
      );
    }

    return (
      <View style={{ justifyContent: "center", paddingLeft: 10, alignItems: "flex-end" }}>
        <SwipeAction
          emoji="🗑️"
          title="Delete"
          subtitle="Swipe left"
          bg="#FFE4E6"
          fg="#7F1D1D"
          onPress={() => {
            close();
            onDelete();
          }}
          align="right"
        />
      </View>
    );
  };

  const isInbox = tab === "inbox";

  return (
    <View style={{ marginBottom: 12 }}>
      <Swipeable
        ref={(r) => {
          swipeRef.current = r;
        }}
        overshootLeft={false}
        overshootRight={false}
        friction={2}
        leftThreshold={40}
        rightThreshold={40}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
      >
        <Pressable
          onPress={onOpen}
          android_ripple={{ color: "#00000008" }}
          style={{
            backgroundColor: Colors.white,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: "#00000010",
            opacity: !isInbox ? 0.96 : 1,
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

            {!isInbox && (
              <View
                style={{
                  marginLeft: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: "#00000006",
                  borderWidth: 1,
                  borderColor: "#00000010",
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#00000088" }}>
                  ARCHIVED
                </Text>
              </View>
            )}
          </View>

          {!!shownMs && (
            <Text style={{ marginTop: 6, fontSize: 12, color: "#00000066" }}>
              {label} {formatDateTime(shownMs)}
            </Text>
          )}

          {/* Buttons (kept for stability; Swipe is premium shortcut) */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            {isInbox ? (
              <>
                <Pressable
                  onPress={onTogglePin}
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
                  onPress={onArchive}
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
              </>
            ) : (
              <>
                <Pressable
                  onPress={onRestore}
                  android_ripple={{ color: "#00000010" }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: (Colors as any).lightAccent ?? "#DBEAFE",
                    overflow: "hidden",
                  }}
                >
                  <Text style={{ color: Colors.deep, fontWeight: "700" }}>Restore</Text>
                </Pressable>

                <Pressable
                  onPress={onDelete}
                  android_ripple={{ color: "#00000010" }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: "#FFE4E6",
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: "#FFCDD2",
                  }}
                >
                  <Text style={{ color: "#7F1D1D", fontWeight: "800" }}>Delete</Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Swipeable>
    </View>
  );
}

export default function InboxScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>("inbox");

  const cards = useCardStore((s) => s.cards);

  // ✅ STEP 16: Search globale in-memory (titolo + clip), anche su card mai aperte
  const matchesQuery = useCardStore((s) => s.matchesQuery);

  // usato per badge SHARED e per compatibilità UI
  const clipItemsByCardId = useCardStore((s) => s.clipItemsByCardId);

  const createCard = useCardStore((s) => s.createCard);
  const togglePin = useCardStore((s) => s.togglePin);
  const archiveCard = useCardStore((s) => s.archiveCard);
  const restoreCard = useCardStore((s: any) => s.restoreCard);
  const deleteCard = useCardStore((s: any) => s.deleteCard);

  // --- Search state (with debounce) ---
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Clear search when switching tab (keeps UX simple and predictable)
  useEffect(() => {
    setQuery("");
    setDebouncedQuery("");
  }, [tab]);

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

  const inboxData = useMemo(() => {
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

  const archiveData = useMemo(() => {
    const visible = cards.filter((c) => !!c.archived);

    const getSortKey = (c: any) => toMs(c.updatedAt) || toMs(c.createdAt) || 0;

    return [...visible].sort((a: any, b: any) => {
      const ka = getSortKey(a);
      const kb = getSortKey(b);
      if (ka !== kb) return kb - ka;

      const ta = String(a.title ?? "");
      const tb = String(b.title ?? "");
      if (ta !== tb) return ta.localeCompare(tb);
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });
  }, [cards]);

  const baseData = tab === "inbox" ? inboxData : archiveData;

  const filteredData = useMemo(() => {
    const q = normalizeQuery(debouncedQuery);
    if (!q) return baseData;

    // ✅ STEP 16: filtriamo su indice globale (titolo+clip) — no DB, no “card opened” dependency
    return baseData.filter((card) => matchesQuery(card.id, q));
  }, [baseData, debouncedQuery, matchesQuery]);

  const isSearching = normalizeQuery(debouncedQuery).length > 0;

  const EmptyState = () => {
    const isInbox = tab === "inbox";

    if (isSearching) {
      return (
        <View style={{ marginTop: 56, alignItems: "center", paddingHorizontal: 18 }}>
          <Text style={{ fontSize: 34, marginBottom: 10 }}>🔎</Text>

          <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.deep }}>
            No results
          </Text>

          <Text
            style={{
              marginTop: 10,
              color: Colors.primary,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            Try a different keyword.
            {"\n"}We search in card titles and clips.
          </Text>

          <Pressable
            onPress={() => setQuery("")}
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
            <Text style={{ color: Colors.deep, fontWeight: "800" }}>
              Clear search
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={{ marginTop: 56, alignItems: "center", paddingHorizontal: 18 }}>
        <Text style={{ fontSize: 34, marginBottom: 10 }}>
          {isInbox ? "🗂️" : "🗄️"}
        </Text>

        <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.deep }}>
          {isInbox ? "Your Inbox is empty" : "Archive is empty"}
        </Text>

        <Text
          style={{
            marginTop: 10,
            color: Colors.primary,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          {isInbox ? (
            <>
              Create a card to start collecting notes and links.
              {"\n"}Tip: you can also “Share to MyClipHub”.
            </>
          ) : (
            <>
              Archived cards will appear here.
              {"\n"}You can restore them anytime.
            </>
          )}
        </Text>

        {isInbox && (
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
            <Text style={{ color: Colors.deep, fontWeight: "800" }}>
              Create card
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  const confirmDelete = useCallback(
    (cardId: string, title: string) => {
      Alert.alert(
        "Delete card?",
        `This will permanently delete “${title}” and all its clips.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteCard(cardId),
          },
        ]
      );
    },
    [deleteCard]
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Top controls */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Segmented value={tab} onChange={setTab} />

        {/* Search bar */}
        <View
          style={{
            marginTop: 12,
            backgroundColor: Colors.white,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#00000010",
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 16 }}>🔎</Text>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search in ${tab === "inbox" ? "Inbox" : "Archive"}…`}
            placeholderTextColor={Colors.muted}
            style={{
              flex: 1,
              color: Colors.deep,
              paddingVertical: 0,
            }}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />

          {!!query.trim().length && (
            <Pressable
              onPress={() => setQuery("")}
              android_ripple={{ color: "#00000010", borderless: true }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                backgroundColor: "#00000006",
                borderWidth: 1,
                borderColor: "#00000010",
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Text style={{ color: Colors.deep, fontWeight: "900" }}>×</Text>
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        data={filteredData}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<EmptyState />}
        renderItem={({ item }) => {
          const createdMs = toMs((item as any).createdAt);
          const updatedMs = toMs((item as any).updatedAt);

          const hasMeaningfulUpdate = updatedMs && updatedMs !== createdMs;
          const label = hasMeaningfulUpdate ? "Updated" : "Created";
          const shownMs = hasMeaningfulUpdate ? updatedMs : createdMs;

          const clips = clipItemsByCardId[item.id] ?? [];
          const isShared = clips.length > 0;

          return (
            <CardRow
              item={item}
              tab={tab}
              isShared={isShared}
              label={label}
              shownMs={shownMs}
              onOpen={() => navigation.navigate("CardDetail", { cardId: item.id })}
              onTogglePin={() => togglePin(item.id)}
              onArchive={() => archiveCard(item.id)}
              onRestore={() => restoreCard(item.id)}
              onDelete={() =>
                confirmDelete(item.id, String(item.title ?? "Untitled"))
              }
            />
          );
        }}
      />

      {/* FAB only on Inbox */}
      {tab === "inbox" && (
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
          <Text style={{ color: Colors.white, fontSize: 28, fontWeight: "900" }}>
            +
          </Text>
        </Pressable>
      )}
    </View>
  );
}