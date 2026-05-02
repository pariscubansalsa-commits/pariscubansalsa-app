import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { Logo } from "../../src/Logo";
import { COLORS, FONTS, SPACING } from "../../src/theme";

export default function AdminDashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user?.is_admin) router.replace("/login");
  }, [loading, user, router]);

  const sections = [
    {
      key: "entries",
      title: "Agenda & sorties",
      desc: "Sorties du moment, soirées, workshops, festivals",
      icon: "calendar-outline" as const,
      path: "/admin/entries",
    },
    {
      key: "teachers",
      title: "Artistes",
      desc: "Fiches artistes, bios, photos, styles, réseaux sociaux",
      icon: "people-outline" as const,
      path: "/admin/teachers",
    },
    {
      key: "users",
      title: "Comptes utilisateurs",
      desc: "Approuver organisateurs, valider les claims artistes, suspendre des comptes",
      icon: "person-circle-outline" as const,
      path: "/admin/users",
    },
    {
      key: "analytics",
      title: "Analytics",
      desc: "Visiteurs, top events, conversions, performance des coups de cœur",
      icon: "stats-chart-outline" as const,
      path: "/admin/analytics",
    },
    {
      key: "gallery",
      title: "Galerie photo",
      desc: "Événements photos, uploads, tags",
      icon: "images-outline" as const,
      path: "/admin/gallery",
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.replace("/")} testID="back-home">
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Logo size={14} />
        <TouchableOpacity
          testID="logout-btn"
          onPress={async () => {
            await logout();
            router.replace("/");
          }}
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.overline}>ESPACE ADMIN</Text>
        <Text style={styles.title}>
          Votre{" "}
          <Text style={styles.italic}>studio.</Text>
        </Text>
        <Text style={styles.sub}>
          Connecté en tant que {user?.email}. Choisissez une section à gérer.
        </Text>

        <View style={{ marginTop: 28 }}>
          {sections.map((s) => (
            <TouchableOpacity
              key={s.key}
              testID={`admin-section-${s.key}`}
              style={styles.section}
              onPress={() => router.push(s.path as any)}
            >
              <View style={styles.sectionIcon}>
                <Ionicons name={s.icon} size={22} color={COLORS.primaryText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{s.title}</Text>
                <Text style={styles.sectionDesc}>{s.desc}</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={COLORS.primaryText} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screen,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  content: { padding: SPACING.screen, paddingTop: 28 },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: COLORS.secondaryText,
    marginBottom: 10,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1.2,
    color: COLORS.primaryText,
  },
  italic: {
    fontFamily: FONTS.headingItalic,
    fontStyle: "italic",
    color: COLORS.accentYellow,
  },
  sub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.secondaryText,
    marginTop: 14,
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    marginBottom: 10,
  },
  sectionIcon: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.accentYellow,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    color: COLORS.primaryText,
    letterSpacing: -0.3,
  },
  sectionDesc: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.secondaryText,
    marginTop: 2,
  },
});
