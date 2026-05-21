import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, EntryItem } from "../../src/api";
import EntryCard from "../../src/EntryCard";
import TopBar from "../../src/TopBar";
import SubmitEntryButton from "../../src/SubmitEntryButton";
import { COLORS, FONTS, SPACING } from "../../src/theme";
import { DanceStyleFilterChips, DanceStyle } from "../../src/DanceStyle";
import { getCountryInfo, KNOWN_COUNTRIES } from "../../src/countries";

const PAST_TILE_W = 240;

export default function Festivals() {
  const router = useRouter();
  const [upcoming, setUpcoming] = useState<EntryItem[]>([]);
  const [pastWithGallery, setPastWithGallery] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [danceStyle, setDanceStyle] = useState<DanceStyle | "all">("all");
  const [country, setCountry] = useState<string>("all"); // ISO-2 code or "all"

  const load = useCallback(async () => {
    try {
      const [up, past] = await Promise.all([
        api.listEntries("festival", danceStyle === "all" ? undefined : danceStyle),
        api.listPastFestivalsWithGallery().catch(() => [] as EntryItem[]),
      ]);
      setUpcoming(up);
      setPastWithGallery(past);
    } catch (e) {
      console.log("festivals err", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [danceStyle]);

  useEffect(() => {
    load();
  }, [load]);

  // Compute the list of countries that have at least 1 festival in the
  // currently-loaded data (already filtered by dance_style). Sorted to keep
  // the most popular PCS destinations (per KNOWN_COUNTRIES order) on the left,
  // followed by any others alphabetically.
  const availableCountries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of upcoming) {
      const info = getCountryInfo(e.country);
      counts.set(info.code, (counts.get(info.code) || 0) + 1);
    }
    const known = KNOWN_COUNTRIES.filter((c) => counts.has(c.code));
    const knownCodes = new Set(known.map((c) => c.code));
    const extras = Array.from(counts.keys())
      .filter((code) => !knownCodes.has(code) && code !== "??")
      .sort()
      .map((code) => ({ code, flag: "🌍", label: code }));
    return [...known, ...extras];
  }, [upcoming]);

  // If the selected country no longer has any festivals after filtering by
  // dance_style, fall back to "all" so the user never sees an empty list with
  // a dead chip selected.
  useEffect(() => {
    if (country === "all") return;
    if (!availableCountries.some((c) => c.code === country)) {
      setCountry("all");
    }
  }, [availableCountries, country]);

  // Apply the country filter client-side (cheap: <= ~70 festivals).
  const visible = useMemo(() => {
    if (country === "all") return upcoming;
    return upcoming.filter((e) => getCountryInfo(e.country).code === country);
  }, [upcoming, country]);

  const openDetail = (id: string) => router.push(`/entry/${id}` as any);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <TopBar />
      <FlatList
        testID="entries-festival"
        data={visible}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <EntryCard entry={item} onPress={() => openDetail(item.id)} />
        )}
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: SPACING.screen }}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <Text style={styles.overline}>FESTIVALS FR & EUROPE</Text>
              <Text style={styles.title}>
                Les grands{" "}
                <Text
                  style={{
                    fontFamily: FONTS.headingItalic,
                    fontStyle: "italic",
                    color: COLORS.accentYellow,
                  }}
                >
                  rendez-vous.
                </Text>
              </Text>
              <Text style={styles.subtitle}>
                Calendrier des festivals de salsa cubaine en France et en
                Europe. Réservez vos vacances dansantes.
              </Text>
              <View style={styles.countPill}>
                <Text style={styles.count}>
                  {visible.length}{" "}
                  {visible.length <= 1 ? "FESTIVAL" : "FESTIVALS"}
                </Text>
              </View>
              <View style={{ marginTop: 18 }}>
                <SubmitEntryButton type="festival" />
              </View>
              <View style={{ marginTop: 12 }}>
                <DanceStyleFilterChips
                  value={danceStyle}
                  onChange={setDanceStyle}
                  testIDPrefix="filter-festival"
                />
              </View>
              {availableCountries.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 10, marginHorizontal: -SPACING.screen }}
                  contentContainerStyle={{
                    paddingHorizontal: SPACING.screen,
                    gap: 8,
                  }}
                  testID="filter-festival-country-row"
                >
                  <CountryChip
                    active={country === "all"}
                    flag={null}
                    label="TOUS"
                    onPress={() => setCountry("all")}
                    testID="filter-festival-country-all"
                  />
                  {availableCountries.map((c) => (
                    <CountryChip
                      key={c.code}
                      active={country === c.code}
                      flag={c.flag}
                      label={c.label.toUpperCase()}
                      onPress={() => setCountry(c.code)}
                      testID={`filter-festival-country-${c.code}`}
                    />
                  ))}
                </ScrollView>
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
              <Text style={styles.emptyTxt}>Aucun festival pour ces filtres.</Text>
            </View>
          )
        }
        ListFooterComponent={
          pastWithGallery.length > 0 ? (
            <View style={styles.pastSection}>
              <View style={styles.pastHead}>
                <Text style={styles.pastOverline}>NOS FESTIVALS PASSÉS 📸</Text>
                <Text style={styles.pastTitle}>L&apos;archive vivante.</Text>
                <Text style={styles.pastSub}>
                  Revivez les éditions précédentes — photos et vidéos par la
                  communauté Paris Cuban Salsa.
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingRight: 16 }}
                testID="past-festivals-row"
              >
                {pastWithGallery.map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    testID={`past-festival-${f.id}`}
                    activeOpacity={0.85}
                    style={[styles.pastTile, { width: PAST_TILE_W }]}
                    onPress={() => openDetail(f.id)}
                  >
                    {f.cover_photo ? (
                      <Image source={{ uri: f.cover_photo }} style={styles.pastCover} />
                    ) : (
                      <View style={[styles.pastCover, styles.pastCoverFallback]}>
                        <Text style={styles.pastCoverFallbackTxt}>PCS</Text>
                      </View>
                    )}
                    <View style={styles.pastBadge}>
                      <Ionicons name="images-outline" size={12} color={COLORS.primaryText} />
                      <Text style={styles.pastBadgeTxt}>GALERIE</Text>
                    </View>
                    <View style={styles.pastBody}>
                      <Text style={styles.pastName} numberOfLines={2}>
                        {f.title}
                      </Text>
                      <Text style={styles.pastDate}>
                        {formatYear(f.end_date || f.date)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null
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

function formatYear(s?: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const months = [
    "JANV.", "FÉVR.", "MARS", "AVRIL", "MAI", "JUIN",
    "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC.",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function CountryChip({
  active,
  flag,
  label,
  onPress,
  testID,
}: {
  active: boolean;
  flag: string | null;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      testID={testID}
      activeOpacity={0.7}
      style={[
        chipStyles.chip,
        active && chipStyles.chipActive,
      ]}
    >
      {flag ? <Text style={chipStyles.chipFlag}>{flag}</Text> : null}
      <Text style={[chipStyles.chipLabel, active && chipStyles.chipLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: COLORS.primaryText,
  },
  chipFlag: {
    fontSize: 14,
    lineHeight: 16,
  },
  chipLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: COLORS.primaryText,
  },
  chipLabelActive: {
    color: COLORS.accentYellow,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  hero: { paddingTop: 12, paddingBottom: 18 },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: COLORS.secondaryText,
    marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1,
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
  emptyTxt: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.primaryText, textAlign: "center" },

  pastSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  pastHead: { marginBottom: 16 },
  pastOverline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: COLORS.secondaryText,
    marginBottom: 8,
  },
  pastTitle: {
    fontFamily: FONTS.heading,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: COLORS.primaryText,
  },
  pastSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.secondaryText,
    marginTop: 8,
  },
  pastTile: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    position: "relative",
  },
  pastCover: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: COLORS.surface,
  },
  pastCoverFallback: {
    backgroundColor: COLORS.primaryText,
    alignItems: "center",
    justifyContent: "center",
  },
  pastCoverFallbackTxt: {
    fontFamily: FONTS.heading,
    fontSize: 56,
    color: COLORS.accentYellow,
  },
  pastBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.accentYellow,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pastBadgeTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: COLORS.primaryText,
  },
  pastBody: { padding: 12 },
  pastName: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    lineHeight: 22,
    color: COLORS.primaryText,
    letterSpacing: -0.2,
  },
  pastDate: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: COLORS.secondaryText,
    marginTop: 6,
  },
});
