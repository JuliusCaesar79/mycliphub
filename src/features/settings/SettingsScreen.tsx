import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "../../app/theme";
import { usePrefsStore, ShareBehavior } from "../../core/storage/prefsStore";

import Icon from "../../ui/Icon";
import Badge from "../../ui/Badge";

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
  const deep = (Colors as any).deep ?? "#0F172A";

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "#00000010" }}
      style={({ pressed }) => [
        styles.optionCard,
        selected && styles.optionCardSelected,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.optionRow}>
        {/* Radio */}
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>

        {/* Text */}
        <View style={styles.optionTextCol}>
          <View style={styles.optionTitleRow}>
            <Text style={[styles.optionTitle, { color: deep }]}>{title}</Text>
            {selected ? (
              <Badge
                label="SELECTED"
                tone="primary"
                variant="soft"
                icon="checkmark-circle-outline"
              />
            ) : null}
          </View>

          <Text style={styles.optionSubtitle}>{subtitle}</Text>
        </View>

        {/* Right icon */}
        <View style={styles.optionIcon}>
          <Icon
            name={selected ? "checkmark-circle-outline" : "ellipse-outline"}
            size={18}
            color={selected ? Colors.primary : "#00000055"}
          />
        </View>
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const shareBehavior = usePrefsStore((s) => s.shareBehavior);
  const setShareBehavior = usePrefsStore((s) => s.setShareBehavior);

  const deep = (Colors as any).deep ?? "#0F172A";

  return (
    <View style={styles.root}>
      <Text style={[styles.title, { color: deep }]}>Share-to-Save</Text>
      <Text style={styles.subtitle}>
        Choose what happens when you share text or links to MyClipHub.
      </Text>

      <View style={styles.optionsWrap}>
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

      <View style={styles.tipCard}>
        <Icon name="information-circle-outline" size={18} color={Colors.primary} />
        <Text style={styles.tipText}>
          Tip: “Append to current card” is the safest option if you want predictable behavior.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },

  title: {
    fontSize: 18,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 6,
    color: "#00000066",
    lineHeight: 18,
  },

  optionsWrap: {
    marginTop: 14,
    gap: 12,
  },

  optionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#00000010",
    overflow: "hidden",
  },
  optionCardSelected: {
    borderWidth: 1.5,
    borderColor: "#1D4ED8",
  },
  pressed: {
    opacity: 0.9,
  },

  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#00000040",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: "#1D4ED8",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1D4ED8",
  },

  optionTextCol: {
    flex: 1,
  },

  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  optionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#00000066",
    lineHeight: 18,
  },

  optionIcon: {
    width: 24,
    alignItems: "flex-end",
  },

  tipCard: {
    marginTop: 18,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#00000006",
    borderWidth: 1,
    borderColor: "#00000010",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: "#00000066",
    lineHeight: 18,
  },
});