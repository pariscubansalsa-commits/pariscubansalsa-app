import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, EventItem } from "../../src/api";
import TopBar from "../../src/TopBar";
import { COLORS, FONTS, SPACING } from "../../src/theme";

export default function Galerie() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const data = await api.listEvents();
      setEvents(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <TopBar />
      <FlatList
        testID="events-list"
        data={events}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Text style={styles.overline}>GALERIE PHOTO</Text>
            <Text style={styles.title}>
              Les soirs où l&apos;on a{" "}
              <Text style={styles.italic}>dansé.</Text>
            </Text>
            <Text style={styles.subtitle}>
              L&apos;archive vivante des soirées Paris Cuban Salsa. Retrouvez-vous,
              tagguez vos amis, partagez vos plus belles photos.
            </Text>
            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>ÉVÉNEMENTS</Text>
          </View>
        }
        renderItem={({ item, index }) => (
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
                <Text style={styles.coverBadgeTxt}>
                  #{String(index + 1).padStart(2, "0")}
                </Text>
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
                <Text style={styles.cardCtaTxt}>OUVRIR LA GALERIE</Text>
                <Ionicons name="arrow-forward" size={14} color={COLORS.primaryText} />
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={COLORS.primaryText} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Aucun événement pour l&apos;instant.</Text>
              <Text style={styles.emptySub}>
                Les photos des prochaines soirées apparaîtront ici.
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
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: SPACING.screen }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
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
  italic: {
    fontFamily: FONTS.headingItalic,
    fontStyle: "italic",
    color: COLORS.accentYellow,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.secondaryText,
    marginTop: 14,
  },
  divider: { height: 1, backgroundColor: COLORS.primaryText, marginTop: 18 },
  sectionLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.primaryText,
    marginTop: 16,
  },
  card: { marginBottom: 32, backgroundColor: COLORS.background },
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
  cardBody: { paddingTop: 14 },
  cardDate: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.secondaryText,
    textTransform: "uppercase",
  },
  cardTitle: {
    fontFamily: FONTS.heading,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.5,
    color: COLORS.primaryText,
    marginTop: 8,
  },
  cardDesc: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.secondaryText,
    marginTop: 6,
  },
  cardCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingTop: 10,
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
});
