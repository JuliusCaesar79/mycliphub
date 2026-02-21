import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import InboxScreen from "../../features/inbox/InboxScreen";
import CardDetailScreen from "../../features/card/CardDetailScreen";
import SettingsScreen from "../../features/settings/SettingsScreen";
import { Colors } from "../theme";
import { navigationRef } from "../navigationRef";

export type RootStackParamList = {
  Inbox: undefined;
  CardDetail: { cardId: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerTitleStyle: {
            color: Colors.deep,
            fontWeight: "700",
          },
        }}
      >
        <Stack.Screen
          name="Inbox"
          component={InboxScreen}
          options={{ title: "Inbox" }}
        />

        <Stack.Screen
          name="CardDetail"
          component={CardDetailScreen}
          options={{
            title: "Card",
          }}
        />

        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: "Settings" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}