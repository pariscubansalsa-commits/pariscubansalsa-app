import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, EntryItem, entryCoverUri } from "./api";
import { COLORS, FONTS, SPACING } from "./theme";
import { formatDateFR } from "./EntryCard";
import { openExternal } from "./links";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = Math.min(SCREEN_W * 0.78, 300);
const CARD_H = CARD_W * 1.25;

const openLink = (url: string) => openExternal(url);

/**
 * Normalize a date string to ISO format YYYY-MM-DD so lexicographic comparison
 * works correctly. Some legacy entries were stored as "2026/05/23" with
 * slashes — that sorts AFTER "2026-07-07" because '/' (0x2F) > '-' (0x2D)
 * in ASCII, which broke the carousel order.
 */
function normalizeDate(s?: string | null): string {
  if (!s) return "";
  return s.trim().replace(/\//g, "-").slice(0, 10);
}

/** Today as YYYY-MM-DD in the user's local timezone. */
function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function FeaturedCarousel() {
  const router = useRouter();
  const [items, setItems] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.listFeatured();
        const today = todayISO();
        // Hide entries whose date (or end_date for multi-day events) has
        // already passed, and sort chronologically — soonest first.
        const upcoming = data
          .filter((it) => {
            const end = normalizeDate(it.end_date);
            const start = normalizeDate(it.date);
            const ref = end || start;
            return ref >= today;
          })
          .sort(
            (a, b) =>
              normalizeDate(a.date).localeCompare(normalizeDate(b.date)) ||
              (a.time || "").localeCompare(b.time || "")
          );
        setItems(upcoming);
      } catch {}
      finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <View style={styles.wrap} testID="featured-carousel">
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>
          Nos coups de{" "}
          <Text style={styles.sectionTitleAccent}>cœur.</Text>
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_W + 12}
        contentContainerStyle={styles.scroll}
      >
        {items.map((item, idx) => {
          const { day, month } = formatDateFR(item.date);
          return (
            <TouchableOpacity
              key={item.id}
              testID={`featured-${idx}`}
              style={[styles.card, { width: CARD_W, height: CARD_H }]}
              activeOpacity={0.9}
              onPress={() => router.push(`/entry/${item.id}` as any)}
            >
              {(() => {
                const coverUri = entryCoverUri(item);
                if (!coverUri) {
                  return (
                    <View style={[styles.img, styles.imgFallback]}>
                      <Text style={styles.imgFallbackTxt}>PCS</Text>
                    </View>
                  );
                }
                return Platform.OS === "web" ? (
                  // @ts-ignore — raw <img> on web for native lazy loading
                  <img
                    src={coverUri}
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    alt=""
                  />
                ) : (
                  <Image source={{ uri: coverUri }} style={styles.img} />
                );
              })()}
              <View style={styles.gradient} />
              <View style={styles.dateBadge}>
                <Text style={styles.dateDay}>{day}</Text>
                <Text style={styles.dateMonth}>{month.toUpperCase()}</Text>
              </View>
              <View style={styles.partnerTag}>
                <Text style={styles.partnerTxt}>PARTENAIRE</Text>
              </View>
              <View style={styles.overlay}>
                {!!item.time && <Text style={styles.time}>{item.time}</Text>}
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>
                {!!item.description && (
                  <Text style={styles.desc} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
                {!!item.venue && (
                  <View style={styles.venueRow}>
                    <Ionicons name="location" size={11} color={COLORS.accentYellow} />
                    <Text style={styles.venue} numberOfLines={1}>
                      {item.venue}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#1A1A1A",
    paddingTop: 0,
    paddingBottom: 24,
    marginHorizontal: -SPACING.screen,
    marginBottom: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: SPACING.screen,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: "#fff",
  },
  sectionTitleAccent: {
    fontFamily: FONTS.headingItalic,
    fontStyle: "italic",
    color: COLORS.accentYellow,
  },
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.55)",
  },
  labelAccent: {
    color: COLORS.accentYellow,
    fontStyle: "italic",
    fontFamily: FONTS.headingItalic,
  },
  scroll: { paddingHorizontal: SPACING.screen, gap: 12 },
  card: {
    marginRight: 12,
    backgroundColor: "#252525",
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
  },
  img: { width: "100%", height: "100%" },
  imgFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryText,
  },
  imgFallbackTxt: {
    fontFamily: FONTS.heading,
    fontSize: 72,
    color: COLORS.accentYellow,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  dateBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.accentYellow,
    alignItems: "center",
    justifyContent: "center",
  },
  dateDay: {
    fontFamily: FONTS.bodyBold,
    fontSize: 20,
    color: COLORS.primaryText,
    lineHeight: 22,
  },
  dateMonth: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    color: COLORS.primaryText,
  },
  partnerTag: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: COLORS.accentYellow,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 40,
  },
  partnerTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    color: COLORS.primaryText,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
  },
  time: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: 0.3,
    color: "#fff",
    marginBottom: 4,
  },
  desc: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 8,
  },
  venueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  venue: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11,
    color: COLORS.accentYellow,
    flex: 1,
  },
});
