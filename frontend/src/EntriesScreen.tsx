import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api, EntryItem, EntryType } from "./api";
import EntryCard from "./EntryCard";
import TopBar from "./TopBar";
import FeaturedCarousel from "./FeaturedCarousel";
import HighlightsCarousel from "./HighlightsCarousel";
import { COLORS, FONTS, SPACING } from "./theme";
import AuthCallback from "./AuthCallback";
import { DanceStyleFilterChips, DanceStyle } from "./DanceStyle";

type Props = {
  type?: EntryType;
  overline: string;
  headline: React.ReactNode;
  subtitle: string;
  showFeatured?: boolean;
  useCalendar?: boolean;
  handleAuthCallback?: boolean;
  headerExtra?: React.ReactNode;
  /** Show the dance-style filter row (TOUS / SALSA CUBAINE / ON2 / MULTI / AUTRE) */
  showDanceStyleFilter?: boolean;
};

export default function EntriesScreen({
  type,
  overline,
  headline,
  subtitle,
  showFeatured = false,
  useCalendar = false,
  handleAuthCallback = false,
  headerExtra,
  showDanceStyleFilter = false,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [danceStyle, setDanceStyle] = useState<DanceStyle | "all">("all");

  const isAuthCallback =
    handleAuthCallback &&
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location.hash?.includes("session_id=");

  const load = useCallback(async () => {
    try {
      const data = useCalendar
        ? await api.listCalendar()
        : await api.listEntries(type, danceStyle);
      // Calendar endpoint doesn't filter by dance_style server-side; do it client-side
      const filtered =
        useCalendar && danceStyle !== "all"
          ? data.filter((d) => d.dance_style === danceStyle)
          : data;
      setItems(filtered);
    } catch (e) {
      console.log("entries err", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type, useCalendar, danceStyle]);

  useEffect(() => {
    if (!isAuthCallback) load();
  }, [load, isAuthCallback]);

  if (isAuthCallback) return <AuthCallback />;

  const openDetail = (id: string) => router.push(`/entry/${id}` as any);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <TopBar />
      <FlatList
        testID={`entries-${type || "agenda"}`}
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <EntryCard entry={item} onPress={() => openDetail(item.id)} />
        )}
        contentContainerStyle={{ paddingBottom: 12, paddingHorizontal: SPACING.screen }}
        ListHeaderComponent={
          <>
            {showFeatured && <FeaturedCarousel />}
            {showFeatured && (
              <View style={{ marginHorizontal: SPACING.screen }}>
                <HighlightsCarousel />
                <View style={styles.sectionDivider} />
              </View>
            )}
            <View style={styles.hero}>
              <Text style={styles.overline}>{overline}</Text>
              <Text style={styles.title}>{headline}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
              <View style={styles.countPill}>
                <Text style={styles.count}>
                  {items.length} {items.length <= 1 ? "ENTRÉE" : "ENTRÉES"}
                </Text>
              </View>
              {headerExtra ? <View style={{ marginTop: 18 }}>{headerExtra}</View> : null}
              {showDanceStyleFilter && (
                <View style={{ marginTop: 18 }}>
                  <DanceStyleFilterChips
                    value={danceStyle}
                    onChange={setDanceStyle}
                    testIDPrefix={`filter-${type || "agenda"}`}
                  />
                </View>
              )}
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={COLORS.primaryText} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTxt}>Rien pour le moment.</Text>
              <Text style={styles.emptySub}>
                Revenez bientôt — la communauté bouge chaque semaine.
              </Text>
            </View>
          )
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
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  hero: { paddingTop: 12, paddingBottom: 18 },
  sectionDivider: {
    height: 1,
    backgroundColor: "#333",
    marginVertical: 8,
    marginHorizontal: 0,
    opacity: 0.25,
  },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#888",
    marginBottom: 6,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: COLORS.primaryText,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.secondaryText,
    marginTop: 12,
    marginBottom: 14,
  },
  countPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F5F5F5",
    borderRadius: 40,
  },
  count: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.secondaryText,
  },
  empty: { padding: 40, alignItems: "center" },
  emptyTxt: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.primaryText },
  emptySub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.secondaryText,
    marginTop: 6,
    textAlign: "center",
  },
});
