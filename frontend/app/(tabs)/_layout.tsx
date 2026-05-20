import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS } from "../../src/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Extend the tab bar into the safe-area-bottom so the dark background
  // reaches the screen edge on PWA on iPhone (no white gap under the bar).
  // Cap the inset at 24px so on tall home-indicator devices the bar doesn't
  // grow excessively.
  const bottomInset = Math.min(insets.bottom || 0, 24);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.accentYellow,
        tabBarInactiveTintColor: "rgba(255,255,255,0.55)",
        tabBarStyle: {
          ...styles.bar,
          height: 56 + bottomInset,
          paddingBottom: bottomInset + 6,
        },
        tabBarItemStyle: styles.item,
        tabBarLabelStyle: {
          fontFamily: FONTS.bodyBold,
          fontSize: 9,
          letterSpacing: 0.8,
          textTransform: "uppercase",
        },
        tabBarActiveBackgroundColor: "transparent",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Soirées",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="sparkles-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="mensuelles"
        options={{
          title: "Mensuelles",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="repeat-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="workshops"
        options={{
          title: "Workshops",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="school-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="festivals"
        options={{
          title: "Festivals",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="calendar-outline" color={color} focused={focused} />
          ),
        }}
      />
      {/* Hidden routes — kept for direct navigation only */}
      <Tabs.Screen
        name="profs"
        options={{ href: null, title: "Artistes" }}
      />
      <Tabs.Screen
        name="galerie"
        options={{ href: null, title: "Galerie" }}
      />
    </Tabs>
  );
}

function TabIcon({
  name,
  color,
  focused,
}: {
  name: any;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={name} size={20} color={color} />
      {focused && <View style={styles.activeDot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#1A1A1A",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 8,
  },
  item: { paddingVertical: 2 },
  iconWrap: { alignItems: "center", justifyContent: "center" },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.accentYellow,
    marginTop: 3,
  },
});
