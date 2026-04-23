import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { api, EntryItem } from "../../src/api";
import { useAuth } from "../../src/auth";
import { COLORS, FONTS, SPACING } from "../../src/theme";
import { formatDateFR, formatDateRangeFR } from "../../src/EntryCard";

async function openLink(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(url, "_blank");
    return;
  }
  const can = await Linking.canOpenURL(url);
  if (can) Linking.openURL(url);
}

export default function EntryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [entry, setEntry] = useState<EntryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const e = await api.getEntry(id);
      setEntry(e);
    } catch (err) {
      console.log("entry detail err", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const shareUrl =
    Platform.OS === "web" && typeof window !== "undefined"
      ? `${window.location.origin}/entry/${id}`
      : `pcs.photos/entry/${id}`;

  const handleShare = async () => {
    try {
      if (Platform.OS === "web" && (navigator as any)?.share) {
        await (navigator as any).share({
          title: entry?.title ?? "Paris Cuban Salsa",
          url: shareUrl,
        });
        return;
      }
      await Clipboard.setStringAsync(shareUrl);
      setToast(true);
      setTimeout(() => setToast(false), 1800);
    } catch (e) {
      console.log(e);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loader}>
          <ActivityIndicator color={COLORS.primaryText} />
        </View>
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loader}>
          <Text style={styles.err}>Événement introuvable.</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>RETOUR</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isFestival = entry.type === "festival";
  const { day, month, weekday } = formatDateFR(entry.date);
  const range = isFestival ? formatDateRangeFR(entry.date, entry.end_date) : "";
  // Only manual entries stored in DB are editable in the admin
  const isEditable =
    user?.is_admin && !!entry.id && /^[0-9a-f-]{36}$/i.test(entry.id);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.topBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>DÉTAIL</Text>
        <TouchableOpacity testID="share-btn" onPress={handleShare} style={styles.topBtn}>
          <Ionicons name="share-outline" size={18} color={COLORS.primaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {entry.cover_photo && (
          <Image source={{ uri: entry.cover_photo }} style={styles.cover} />
        )}

        <View style={styles.header}>
          {!isFestival ? (
            <View style={styles.dateBlock}>
              <Text style={styles.weekday}>{weekday}</Text>
              <Text style={styles.day}>{day}</Text>
              <Text style={styles.month}>{month.toUpperCase()}</Text>
            </View>
          ) : (
            <View style={styles.festBadge}>
              <Text style={styles.festBadgeTxt}>{range.toUpperCase()}</Text>
            </View>
          )}
          {entry.featured && (
            <View style={styles.partnerTag}>
              <Ionicons name="heart" size={12} color={COLORS.primaryText} />
              <Text style={styles.partnerTxt}>PARTENAIRE</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          {entry.type === "workshop" && !!entry.instructor && (
            <Text style={styles.overline}>
              AVEC {entry.instructor.toUpperCase()}
            </Text>
          )}
          {entry.type === "soiree" && (
            <Text style={styles.overline}>SOIRÉE MENSUELLE</Text>
          )}

          <Text style={styles.title}>{entry.title}</Text>

          <View style={styles.metaGroup}>
            {!!entry.time && (
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={16} color={COLORS.primaryText} />
                <Text style={styles.metaTxt}>{entry.time}</Text>
              </View>
            )}
            {!!entry.venue && (
              <View style={styles.metaRow}>
                <Ionicons name="business-outline" size={16} color={COLORS.primaryText} />
                <Text style={styles.metaTxt}>{entry.venue}</Text>
              </View>
            )}
            {!!entry.address && (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={16} color={COLORS.primaryText} />
                <Text style={styles.metaTxt}>{entry.address}</Text>
              </View>
            )}
          </View>

          {!!entry.description && (
            <Text style={styles.desc}>{entry.description}</Text>
          )}

          {!!entry.ticket_link && (
            <TouchableOpacity
              testID="detail-ticket"
              style={styles.ticketBtn}
              onPress={() => openLink(entry.ticket_link!)}
            >
              <Ionicons name="ticket-outline" size={16} color={COLORS.primaryText} />
              <Text style={styles.ticketTxt}>ACHETER LE TICKET</Text>
              <Ionicons name="arrow-forward" size={14} color={COLORS.primaryText} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            testID="detail-share"
            style={styles.secondaryBtn}
            onPress={handleShare}
          >
            <Ionicons name="share-social-outline" size={16} color={COLORS.primaryText} />
            <Text style={styles.secondaryTxt}>PARTAGER CET ÉVÉNEMENT</Text>
          </TouchableOpacity>

          {isEditable && (
            <TouchableOpacity
              testID="detail-edit"
              style={[styles.secondaryBtn, { marginTop: 8 }]}
              onPress={() => router.push("/admin/entries" as any)}
            >
              <Ionicons name="create-outline" size={16} color={COLORS.primaryText} />
              <Text style={styles.secondaryTxt}>MODIFIER DEPUIS L&apos;ADMIN</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastTxt}>LIEN COPIÉ</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  err: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.primaryText },
  backLink: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screen,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topBtn: { padding: 4 },
  topTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.primaryText,
  },
  cover: {
    width: "100%",
    aspectRatio: 16 / 10,
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screen,
    paddingTop: 20,
  },
  dateBlock: { alignItems: "center", width: 72 },
  weekday: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.3,
    color: COLORS.secondaryText,
  },
  day: {
    fontFamily: FONTS.heading,
    fontSize: 48,
    lineHeight: 52,
    color: COLORS.primaryText,
    marginTop: 4,
  },
  month: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: COLORS.primaryText,
  },
  festBadge: {
    backgroundColor: COLORS.accentYellow,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 40,
  },
  festBadgeTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    color: COLORS.primaryText,
  },
  partnerTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.accentYellow,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 40,
  },
  partnerTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
    color: COLORS.primaryText,
  },
  body: { padding: SPACING.screen, paddingTop: 18 },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: COLORS.secondaryText,
    marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: COLORS.primaryText,
  },
  metaGroup: { marginTop: 18, gap: 10 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaTxt: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.primaryText,
    flex: 1,
  },
  desc: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 23,
    color: COLORS.secondaryText,
    marginTop: 20,
  },
  ticketBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    backgroundColor: COLORS.accentYellow,
    paddingVertical: 16,
    borderRadius: 40,
  },
  ticketTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 14,
    borderRadius: 40,
  },
  secondaryTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
  },
  toast: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: COLORS.primaryText,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 40,
  },
  toastTxt: {
    color: COLORS.accentYellow,
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
  },
});
