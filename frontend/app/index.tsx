import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api, EventItem } from "../src/api";
import { useAuth } from "../src/auth";
import { COLORS, FONTS, SPACING } from "../src/theme";
import { Logo } from "../src/Logo";
import { Ionicons } from "@expo/vector-icons";
import AuthCallback from "../src/AuthCallback";

export default function Index() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  // Handle emergent auth callback fragment synchronously during render
  const isAuthCallback =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location.hash?.includes("session_id=");

  const load = useCallback(async () => {
    try {
      const data = await api.listEvents();
      setEvents(data);
    } catch (e) {
      console.log("load events err", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthCallback) load();
  }, [load, isAuthCallback]);

  if (isAuthCallback) return <AuthCallback />;

  const formatDate = (d: string) => {
    try {
      const date = new Date(d);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return d;
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Logo size={22} />
        {user?.is_admin ? (
          <TouchableOpacity
            testID="admin-dashboard-link"
            onPress={() => router.push("/admin")}
            style={styles.adminBtn}
          >
            <Ionicons name="settings-outline" size={16} color={COLORS.primaryText} />
            <Text style={styles.adminBtnTxt}>ADMIN</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            testID="admin-login-link"
            onPress={() => router.push("/login")}
          >
            <Text style={styles.loginLink}>LOG IN</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.hero}>
        <Text style={styles.overline}>GALLERY · COMMUNITY · MEMORIES</Text>
        <Text style={styles.heroTitle}>
          The nights we <Text style={styles.italic}>danced.</Text>
        </Text>
        <Text style={styles.heroSub}>
          A living archive of the Paris Cuban Salsa community. Browse events,
          find yourself, and tag your moves.
        </Text>
      </View>

      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>EVENTS</Text>
    </View>
  );

  const renderEvent = ({ item, index }: { item: EventItem; index: number }) => (
    <TouchableOpacity
      testID={`event-card-${index}`}
      activeOpacity={0.85}
      style={styles.card}
      onPress={() => router.push(`/event/${item.id}`)}
    >
      <View style={styles.coverWrap}>
        {item.cover_photo ? (
          <Image source={{ uri: item.cover_photo }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}>
            <Text style={styles.coverFallbackTxt}>PCS</Text>
          </View>
        )}
        <View style={styles.coverBadge}>
          <Text style={styles.coverBadgeTxt}>#{String(index + 1).padStart(2, "0")}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.name}
        </Text>
        {!!item.description && (
          <Text style={styles.cardDesc} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.cardCta}>
          <Text style={styles.cardCtaTxt}>VIEW GALLERY</Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.primaryText} />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <FlatList
        testID="events-list"
        data={events}
        keyExtractor={(e) => e.id}
        renderItem={renderEvent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={COLORS.primaryText} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No events yet.</Text>
              <Text style={styles.emptySub}>
                Check back soon — photos from the next milonga will live here.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.footerTxt}>© Paris Cuban Salsa · pcs.photos</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={COLORS.primaryText}
          />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.screen, paddingTop: 8 },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  adminBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  adminBtnTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.primaryText,
  },
  loginLink: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
  hero: { paddingTop: 32, paddingBottom: 24 },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: COLORS.secondaryText,
    marginBottom: 16,
  },
  heroTitle: {
    fontFamily: FONTS.heading,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1.5,
    color: COLORS.primaryText,
  },
  italic: {
    fontFamily: FONTS.headingItalic,
    fontStyle: "italic",
    color: COLORS.accentYellow,
  },
  heroSub: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.secondaryText,
    marginTop: 20,
    maxWidth: 520,
  },
  divider: { height: 1, backgroundColor: COLORS.primaryText, marginTop: 8 },
  sectionLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.primaryText,
    marginTop: 20,
    marginBottom: 16,
  },
  card: {
    marginHorizontal: SPACING.screen,
    marginBottom: 40,
    backgroundColor: COLORS.background,
  },
  coverWrap: { position: "relative" },
  cover: { width: "100%", aspectRatio: 4 / 3, backgroundColor: COLORS.surface },
  coverFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryText,
  },
  coverFallbackTxt: {
    fontFamily: FONTS.heading,
    fontSize: 64,
    color: COLORS.accentYellow,
  },
  coverBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: COLORS.accentYellow,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  coverBadgeTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.primaryText,
  },
  cardBody: { paddingTop: 16 },
  cardDate: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.secondaryText,
    textTransform: "uppercase",
  },
  cardTitle: {
    fontFamily: FONTS.heading,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: COLORS.primaryText,
    marginTop: 8,
  },
  cardDesc: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.secondaryText,
    marginTop: 8,
  },
  cardCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cardCtaTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
  empty: { padding: 40, alignItems: "center" },
  emptyTitle: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.primaryText },
  emptySub: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.secondaryText,
    marginTop: 8,
    textAlign: "center",
  },
  footer: {
    paddingTop: 40,
    paddingBottom: 20,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginHorizontal: SPACING.screen,
  },
  footerTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.secondaryText,
  },
});
