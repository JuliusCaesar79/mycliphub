import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { Colors } from "../../app/theme";
import type { RootStackParamList } from "../../app/navigation";
import Icon from "../../ui/Icon";
import ButtonPrimary from "../../ui/ButtonPrimary";
import ButtonSecondary from "../../ui/ButtonSecondary";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Logo responsive (manteniamo ratio "banner")
  const logoW = Math.min(420, Math.round(width * 0.86));
  const logoH = Math.round(logoW * (547 / 1131)); // ratio del logo full croppato

  const deep = (Colors as any).deep ?? "#0F172A";
  const muted = (Colors as any).muted ?? "#7A7A7A";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>
        {/* Settings (top-right, safe-area aware) */}
        <Pressable
          onPress={() => navigation.navigate("Settings")}
          hitSlop={12}
          style={[styles.settingsBtn, { top: insets.top + 6 }]}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Icon name="settings-outline" size={24} color={deep} />
        </Pressable>

        {/* Center rail (logo + actions centrati) */}
        <View style={styles.centerRail}>
          <View style={styles.hero}>
            <Image
              source={require("../../assets/brand/mycliphub_logo_full_transparent.png")}
              style={{ width: logoW, height: logoH }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>

          <View style={styles.actions}>
            <ButtonPrimary
              title="Inbox"
              icon="mail-outline"
              onPress={() => navigation.navigate("Inbox")}
            />

            <ButtonSecondary
              title="Agenda"
              icon="calendar-outline"
              onPress={() => navigation.navigate("Agenda")}
            />
          </View>
        </View>

        {/* Footer (safe-area aware) */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
          <FooterText color={muted}>Powered by Virgilius Labs</FooterText>
        </View>
      </View>
    </SafeAreaView>
  );
}

function FooterText({ children, color }: { children: string; color: string }) {
  // Import locale per mantenere l’header pulito (come nel tuo approccio originale).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Text } = require("react-native");
  return <Text style={[styles.footerText, { color }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  root: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // settings
  settingsBtn: {
    position: "absolute",
    right: 14,
    paddingHorizontal: 6,
    paddingVertical: 6,
    zIndex: 10,
  },

  // center rail
  centerRail: {
    flex: 1,
    justifyContent: "center",
  },
  hero: {
    alignItems: "center",
    paddingBottom: 18,
  },

  // actions
  actions: {
    gap: 12,
  },

  // footer
  footer: {
    alignItems: "center",
    paddingTop: 10,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
  },
});