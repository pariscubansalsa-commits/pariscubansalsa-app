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
import { api, EntryItem, EntryType } from "./api";
import EntryCard from "./EntryCard";
import TopBar from "./TopBar";
import { COLORS, FONTS, SPACING } from "./theme";
import AuthCallback from "./AuthCallback";

type Props = {
  type?: EntryType; // undefined = agenda (accueil)
  overline: string;
  headline: React.ReactNode;
  subtitle: string;
  handleAuthCallback?: boolean;
  filterFn?: (e: EntryItem) => boolean;
};

export default function EntriesScreen({
  type,
  overline,
  headline,
  subtitle,
  handleAuthCallback = false,
  filterFn,
}: Props) {
  const [items, setItems] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAuthCallback =
    handleAuthCallback &&
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location.hash?.includes("session_id=");

  const load = useCallback(async () => {
    try {
      const data = await api.listEntries(type);
      const filtered = filterFn ? data.filter(filterFn) : data;
      setItems(filtered);
    } catch (e) {
      console.log("entries err", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type, filterFn]);

  useEffect(() => {
    if (!isAuthCallback) load();
  }, [load, isAuthCallback]);

  if (isAuthCallback) return <AuthCallback />;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <TopBar />
      <FlatList
        testID={`entries-${type || "agenda"}`}
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <EntryCard entry={item} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Text style={styles.overline}>{overline}</Text>
            <Text style={styles.title}>{headline}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            <View style={styles.divider} />
            <Text style={styles.count}>
              {items.length} {items.length <= 1 ? "ENTRÉE" : "ENTRÉES"}
            </Text>
          </View>
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
        style={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  list: { paddingHorizontal: SPACING.screen },
  hero: { paddingTop: 24, paddingBottom: 20 },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: COLORS.secondaryText,
    marginBottom: 10,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1.2,
    color: COLORS.primaryText,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.secondaryText,
    marginTop: 14,
    marginBottom: 18,
  },
  divider: { height: 1, backgroundColor: COLORS.primaryText },
  count: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: COLORS.primaryText,
    marginTop: 14,
    marginBottom: 18,
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
