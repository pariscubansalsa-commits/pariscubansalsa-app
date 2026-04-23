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
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, EntryItem } from "./api";
import { COLORS, FONTS, SPACING } from "./theme";
import { formatDateFR } from "./EntryCard";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = Math.min(SCREEN_W - SPACING.screen * 2 - 40, 320);
const CARD_H = CARD_W * 1.35;

async function openLink(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(url, "_blank");
    return;
  }
  const can = await Linking.canOpenURL(url);
  if (can) Linking.openURL(url);
}

export default function FeaturedCarousel() {
  const [items, setItems] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.listFeatured();
        setItems(data);
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
        <Ionicons name="heart" size={14} color={COLORS.accentYellow} />
        <Text style={styles.label}>NOS COUPS DE CŒUR</Text>
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
              activeOpacity={0.92}
              onPress={() => item.ticket_link && openLink(item.ticket_link)}
            >
              {item.cover_photo ? (
                <Image source={{ uri: item.cover_photo }} style={styles.img} />
              ) : (
                <View style={[styles.img, styles.imgFallback]}>
                  <Text style={styles.imgFallbackTxt}>PCS</Text>
                </View>
              )}
              <View style={styles.dateBadge}>
                <Text style={styles.dateDay}>{day}</Text>
                <Text style={styles.dateMonth}>{month.toUpperCase()}</Text>
              </View>
              <View style={styles.partnerTag}>
                <Text style={styles.partnerTxt}>PARTENAIRE</Text>
              </View>
              <View style={styles.overlay}>
                {!!item.time && <Text style={styles.time}>De {item.time}</Text>}
                <Text style={styles.title} numberOfLines={2}>
                  {item.title.toUpperCase()}
                </Text>
                {!!item.description && (
                  <Text style={styles.desc} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
                {!!item.venue && (
                  <View style={styles.venueRow}>
                    <Ionicons name="location" size={12} color={COLORS.accentYellow} />
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
    marginTop: 16,
    marginBottom: 24,
    marginHorizontal: -SPACING.screen, // bleed to edges
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.screen,
    marginBottom: 12,
  },
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: COLORS.primaryText,
  },
  scroll: { paddingHorizontal: SPACING.screen, gap: 12 },
  card: {
    marginRight: 12,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: COLORS.primaryText,
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
  dateBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.accentYellow,
    alignItems: "center",
    justifyContent: "center",
  },
  dateDay: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: COLORS.primaryText,
    lineHeight: 24,
  },
  dateMonth: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    color: COLORS.primaryText,
    marginTop: 0,
  },
  partnerTag: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: COLORS.primaryText,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  partnerTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: COLORS.accentYellow,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingTop: 40,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  time: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: "#fff",
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    letterSpacing: 0.3,
    color: COLORS.accentYellow,
    marginBottom: 6,
  },
  desc: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 8,
  },
  venueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  venue: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    flex: 1,
  },
});
