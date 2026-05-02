import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, View, StyleSheet } from "react-native";
import { COLORS, FONTS } from "../../src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.accentYellow,
        tabBarInactiveTintColor: "rgba(255,255,255,0.55)",
        tabBarStyle: styles.bar,
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
          title: "Accueil",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="soirees"
        options={{
          title: "Soirées",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="musical-notes-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="workshops"
        options={{
          href: null,
          title: "Workshops",
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
      <Tabs.Screen
        name="profs"
        options={{
          title: "Artistes",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="people-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="galerie"
        options={{
          title: "Galerie",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="images-outline" color={color} focused={focused} />
          ),
        }}
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
    height: Platform.OS === "ios" ? 84 : 68,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 22 : 10,
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
