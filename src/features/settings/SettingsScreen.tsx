import React from "react";
import { Pressable, Text, View } from "react-native";
import { Colors } from "../../app/theme";
import { usePrefsStore, ShareBehavior } from "../../core/storage/prefsStore";

function OptionRow({
  title,
  subtitle,
  value,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  value: ShareBehavior;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "#00000010" }}
      style={{
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: selected ? "#1D4ED8" : "#00000010",
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 2,
            borderColor: selected ? "#1D4ED8" : "#00000040",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected && (
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: "#1D4ED8",
              }}
            />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.deep }}>
            {title}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 12, color: "#00000066", lineHeight: 18 }}>
            {subtitle}
          </Text>
        </View>

        <Text style={{ fontSize: 14 }}>{selected ? "✅" : ""}</Text>
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const shareBehavior = usePrefsStore((s) => s.shareBehavior);
  const setShareBehavior = usePrefsStore((s) => s.setShareBehavior);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "900", color: Colors.deep }}>
        Share-to-Save
      </Text>
      <Text style={{ marginTop: 6, color: "#00000066", lineHeight: 18 }}>
        Choose what happens when you share text or links to MyClipHub.
      </Text>

      <View style={{ marginTop: 14, gap: 12 }}>
        <OptionRow
          title="Create a new card"
          subtitle="Every share creates a new card."
          value="new"
          selected={shareBehavior === "new"}
          onPress={() => setShareBehavior("new")}
        />

        <OptionRow
          title="Append to current card"
          subtitle="If you are viewing a card, the share is added there. Otherwise a new card is created."
          value="append_current"
          selected={shareBehavior === "append_current"}
          onPress={() => setShareBehavior("append_current")}
        />

        <OptionRow
          title="Append to last opened"
          subtitle="If no card is open, the share is added to the last card you opened."
          value="append_last"
          selected={shareBehavior === "append_last"}
          onPress={() => setShareBehavior("append_last")}
        />
      </View>

      <View style={{ marginTop: 18, padding: 12, borderRadius: 14, backgroundColor: "#00000006" }}>
        <Text style={{ fontSize: 12, color: "#00000066", lineHeight: 18 }}>
          Tip: “Append to current card” is the safest option if you want predictable behavior.
        </Text>
      </View>
    </View>
  );
}