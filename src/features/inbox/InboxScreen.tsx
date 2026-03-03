import React, {
  useLayoutEffect,
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { Alert, FlatList, Pressable, Text, View, TextInput, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Swipeable } from "react-native-gesture-handler";

import { Colors } from "../../app/theme";
import { useCardStore } from "../../core/storage/cardStore";
import { RootStackParamList } from "../../app/navigation";

import Icon from "../../ui/Icon";
import ButtonPrimary from "../../ui/ButtonPrimary";
import ButtonSecondary from "../../ui/ButtonSecondary";
import Badge from "../../ui/Badge";
import CardContainer from "../../ui/CardContainer";

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
    <View style={styles.segmentedWrap}>
      <Pressable
        onPress={() => onChange("inbox")}
        android_ripple={{ color: "#00000010" }}
        style={[
          styles.segmentItem,
          isInbox && styles.segmentItemActive,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Show Inbox"
      >
        <Text style={styles.segmentText}>Inbox</Text>
      </Pressable>

      <Pressable
        onPress={() => onChange("archive")}
        android_ripple={{ color: "#00000010" }}
        style={[
          styles.segmentItem,
          !isInbox && styles.segmentItemActive,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Show Archive"
      >
        <Text style={styles.segmentText}>Archive</Text>
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
  icon,
  bg,
  fg,
  onPress,
  align = "left",
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  bg: string;
  fg: string;
  onPress: () => void;
  align?: "left" | "right";
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "#00000010" }}
      style={[
        styles.swipeAction,
        {
          backgroundColor: bg,
          alignItems: align === "right" ? "flex-end" : "flex-start",
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.swipeActionTitleRow}>
        {icon}
        <Text style={[styles.swipeActionTitle, { color: fg }]}>{title}</Text>
      </View>
      <Text style={[styles.swipeActionSubtitle, { color: fg }]}>{subtitle}</Text>
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
      const title = item.pinned ? "Unpin" : "Pin";
      return (
        <View style={styles.swipeLeftWrap}>
          <SwipeAction
            title={title}
            subtitle="Swipe right"
            icon={<Icon name="bookmark-outline" size={18} color={Colors.deep} />}
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
      <View style={styles.swipeLeftWrap}>
        <SwipeAction
          title="Restore"
          subtitle="Swipe right"
          icon={<Icon name="arrow-undo-outline" size={18} color={Colors.deep} />}
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
        <View style={styles.swipeRightWrap}>
          <SwipeAction
            title="Archive"
            subtitle="Swipe left"
            icon={<Icon name="archive-outline" size={18} color={Colors.deep} />}
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
      <View style={styles.swipeRightWrap}>
        <SwipeAction
          title="Delete"
          subtitle="Swipe left"
          icon={<Icon name="trash-outline" size={18} color="#7F1D1D" />}
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
    <View style={styles.rowOuter}>
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
        <CardContainer style={[styles.cardShell, !isInbox && styles.cardShellArchived]}>
          <Pressable
            onPress={onOpen}
            android_ripple={{ color: "#00000008" }}
            style={styles.cardPressable}
            accessibilityRole="button"
            accessibilityLabel="Open card"
          >
            {/* Title Row */}
            <View style={styles.titleRow}>
              <Text style={styles.title}>{item.title}</Text>

              {item.pinned ? (
                <View style={styles.titleIcon}>
                  <Icon name="bookmark-outline" size={16} color={Colors.deep} />
                </View>
              ) : null}

              {isShared && (
                <View style={styles.badgeWrap}>
                  <Badge label="SHARED" tone="primary" variant="soft" />
                </View>
              )}

              {!isInbox && (
                <View style={styles.badgeWrap}>
                  <Badge label="ARCHIVED" tone="muted" variant="soft" />
                </View>
              )}
            </View>

            {!!shownMs && (
              <Text style={styles.meta}>
                {label} {formatDateTime(shownMs)}
              </Text>
            )}

            {/* Buttons (kept for stability; Swipe is premium shortcut) */}
            <View style={styles.actionsRow}>
              {isInbox ? (
                <>
                  <ButtonSecondary
                    title={item.pinned ? "Unpin" : "Pin"}
                    icon="bookmark-outline"
                    onPress={onTogglePin}
                    style={styles.actionBtn}
                  />
                  <ButtonSecondary
                    title="Archive"
                    icon="archive-outline"
                    onPress={onArchive}
                    style={styles.actionBtn}
                  />
                </>
              ) : (
                <>
                  <ButtonSecondary
                    title="Restore"
                    icon="arrow-undo-outline"
                    onPress={onRestore}
                    style={styles.actionBtn}
                  />

                  {/* Destructive (kept explicit to avoid accidental “primary-colored delete”) */}
                  <Pressable
                    onPress={onDelete}
                    android_ripple={{ color: "#00000010" }}
                    style={styles.deleteBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Delete card"
                  >
                    <Icon name="trash-outline" size={18} color="#7F1D1D" />
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </>
              )}
            </View>
          </Pressable>
        </CardContainer>
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
          style={styles.headerIconBtn}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Icon name="settings-outline" size={20} color={Colors.deep} />
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
        <View style={styles.emptyWrap}>
          <Icon name="search-outline" size={34} color={Colors.deep} />

          <Text style={styles.emptyTitle}>No results</Text>

          <Text style={styles.emptyText}>
            Try a different keyword.
            {"\n"}We search in card titles and clips.
          </Text>

          <View style={{ marginTop: 16 }}>
            <ButtonSecondary
              title="Clear search"
              icon="close-circle-outline"
              onPress={() => setQuery("")}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.emptyWrap}>
        <Icon
          name={isInbox ? "albums-outline" : "archive-outline"}
          size={34}
          color={Colors.deep}
        />

        <Text style={styles.emptyTitle}>
          {isInbox ? "Your Inbox is empty" : "Archive is empty"}
        </Text>

        <Text style={styles.emptyText}>
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
          <View style={{ marginTop: 16 }}>
            <ButtonPrimary
              title="Create card"
              icon="add-outline"
              onPress={() => createCard("New Card")}
            />
          </View>
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
      <View style={styles.topControls}>
        <Segmented value={tab} onChange={setTab} />

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Icon name="search-outline" size={18} color={Colors.deep} />

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search in ${tab === "inbox" ? "Inbox" : "Archive"}…`}
            placeholderTextColor={Colors.muted}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />

          {!!query.trim().length && (
            <Pressable
              onPress={() => setQuery("")}
              android_ripple={{ color: "#00000010", borderless: true }}
              style={styles.clearSearchBtn}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Icon name="close-circle" size={18} color={Colors.deep} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
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
              onDelete={() => confirmDelete(item.id, String(item.title ?? "Untitled"))}
            />
          );
        }}
      />

      {/* FAB only on Inbox */}
      {tab === "inbox" && (
        <Pressable
          onPress={() => createCard("New Card")}
          android_ripple={{ color: "#ffffff33" }}
          style={[
            styles.fab,
            {
              bottom: 18 + insets.bottom,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Create new card"
        >
          <Icon name="add" size={28} color={Colors.white} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Segmented
  segmentedWrap: {
    flexDirection: "row",
    backgroundColor: "#00000008",
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#00000010",
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    alignItems: "center",
  },
  segmentItemActive: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: "#00000010",
  },
  segmentText: {
    fontWeight: "800",
    color: Colors.deep,
  },

  // Header
  headerIconBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#00000008",
  },

  // Top controls
  topControls: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchBar: {
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
  },
  searchInput: {
    flex: 1,
    color: Colors.deep,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#00000006",
    borderWidth: 1,
    borderColor: "#00000010",
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 120,
  },

  // Empty states
  emptyWrap: {
    marginTop: 56,
    alignItems: "center",
    paddingHorizontal: 18,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: "800",
    color: Colors.deep,
  },
  emptyText: {
    marginTop: 10,
    color: Colors.primary,
    textAlign: "center",
    lineHeight: 20,
  },

  // Swipe wrappers
  swipeLeftWrap: {
    justifyContent: "center",
    paddingRight: 10,
  },
  swipeRightWrap: {
    justifyContent: "center",
    paddingLeft: 10,
    alignItems: "flex-end",
  },
  swipeAction: {
    width: 160,
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#00000010",
  },
  swipeActionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  swipeActionTitle: {
    fontWeight: "900",
    fontSize: 14,
  },
  swipeActionSubtitle: {
    marginTop: 2,
    opacity: 0.85,
    fontSize: 12,
  },

  // Card row
  rowOuter: {
    marginBottom: 12,
  },
  cardShell: {
    padding: 0,
    overflow: "hidden",
  },
  cardShellArchived: {
    opacity: 0.96,
  },
  cardPressable: {
    padding: 14,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.deep,
  },
  titleIcon: {
    marginLeft: 8,
    marginTop: 2,
  },
  badgeWrap: {
    marginLeft: 8,
    marginTop: 2,
  },
  meta: {
    marginTop: 6,
    fontSize: 12,
    color: "#00000066",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  deleteBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#FFE4E6",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#FFCDD2",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteText: {
    color: "#7F1D1D",
    fontWeight: "800",
  },

  // FAB
  fab: {
    position: "absolute",
    right: 18,
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
  },
});