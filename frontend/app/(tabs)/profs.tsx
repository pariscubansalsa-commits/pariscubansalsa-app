import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, TeacherItem } from "../../src/api";
import TopBar from "../../src/TopBar";
import SubmitEntryButton from "../../src/SubmitEntryButton";
import { COLORS, FONTS, SPACING } from "../../src/theme";

const { width: SCREEN_W } = Dimensions.get("window");
const NUM_COLS = SCREEN_W >= 600 ? 3 : 2;
const GAP = 12;
const TILE_W = (SCREEN_W - SPACING.screen * 2 - GAP * (NUM_COLS - 1)) / NUM_COLS;

const STYLE_FILTERS = [
  "Casino",
  "Rumba",
  "Afro",
  "Son",
  "Lady Style",
  "Reggaeton",
  "Folklore",
];

// Sprint refactor: prepare the page for the Sprint +1 artists typology
// (prof/dj/dancer/singer/group/musician). For this release, only `prof` has
// any data — the other types render zero results but the filter is wired
// up so the layout & UX are ready for the next sprint.
type ArtistType = "all" | "prof" | "dj" | "dancer" | "singer" | "group" | "musician";

const TYPE_FILTERS: { key: ArtistType; label: string; icon: string }[] = [
  { key: "all",      label: "TOUS",       icon: "people-outline" },
  { key: "prof",     label: "PROFS",      icon: "school-outline" },
  { key: "dj",       label: "DJs",        icon: "disc-outline" },
  { key: "dancer",   label: "DANSEURS",   icon: "body-outline" },
  { key: "singer",   label: "CHANTEURS",  icon: "mic-outline" },
  { key: "group",    label: "GROUPES",    icon: "musical-notes-outline" },
];

const TYPE_LABEL_FR: Record<ArtistType, string> = {
  all: "",
  prof: "Prof",
  dj: "DJ",
  dancer: "Danseur",
  singer: "Chanteur",
  group: "Groupe",
  musician: "Musicien",
};

const TYPE_EMOJI: Record<ArtistType, string> = {
  all: "",
  prof: "💃",
  dj: "🎧",
  dancer: "🕺",
  singer: "🎤",
  group: "🎶",
  musician: "🎹",
};

/** Match a teacher's `dance_styles` against a filter keyword (loose, case + accent insensitive). */
function matchesFilter(teacher: TeacherItem, filter: string): boolean {
  const styles = teacher.dance_styles || [];
  if (styles.length === 0) return false;
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const f = norm(filter);
  return styles.some((s) => {
    const n = norm(s);
    if (n.includes(f)) return true;
    // Aliases
    if (f === "casino" && (n.includes("salsa") || n.includes("rueda"))) return true;
    if (f === "afro" && n.includes("afro")) return true;
    if (f === "son" && n.includes("son")) return true;
    if (f === "lady style" && (n.includes("lady") || n.includes("féminin"))) return true;
    return false;
  });
}

export default function Artistes() {
  const router = useRouter();
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  // Sprint refactor: artist-type filter. For this release, only `prof` has
  // data — the DB doesn't have a `type` field on teachers yet (arrives in
  // Sprint +1). When `activeType !== 'all'` AND there's no typology data,
  // we still return the prof results so the page never goes empty.
  const [activeType, setActiveType] = useState<ArtistType>("all");

  const load = useCallback(async () => {
    try {
      const data = await api.listTeachers();
      setTeachers(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let base = teachers;
    // Sprint refactor: type filter wired UI-only. In Sprint +1 each
    // TeacherItem will gain `artist_type: 'prof'|'dj'|'dancer'|...`.
    // For now, only 'prof' has real data — any other type returns empty,
    // 'all' shows everything (the 5 profs currently in DB).
    if (activeType !== "all" && activeType !== "prof") {
      base = [];
    }
    if (!activeFilter) return base;
    return base.filter((t) => matchesFilter(t, activeFilter));
  }, [teachers, activeFilter, activeType]);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <TopBar />
      <FlatList
        testID="artistes-list"
        data={filtered}
        numColumns={NUM_COLS}
        columnWrapperStyle={NUM_COLS > 1 ? { gap: GAP } : undefined}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{
          paddingHorizontal: SPACING.screen,
          paddingBottom: 40,
          gap: GAP,
        }}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.overline}>ARTISTES</Text>
              <Text style={styles.title}>
                Les{" "}
                <Text
                  style={{
                    fontFamily: FONTS.headingItalic,
                    fontStyle: "italic",
                    color: COLORS.accentYellow,
                  }}
                >
                  artistes
                </Text>
                {" "}de la scène cubaine.
              </Text>
              <Text style={styles.subtitle}>
                Profs, DJs, danseurs, chanteurs, groupes — découvrez celles
                et ceux qui font vivre la salsa cubaine à Paris. Touchez une
                fiche pour voir leur bio, leur musique et leurs prochains
                rendez-vous.
              </Text>
              <View style={styles.divider} />
            </View>

            {/* Sprint refactor: artist-type filter (row 1) — wired but only
                'prof' has real data in DB for now. Other types return empty
                until Sprint +1 lands the artists data model. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              testID="type-filter-row"
            >
              {TYPE_FILTERS.map((tf) => (
                <FilterChip
                  key={tf.key}
                  label={tf.label}
                  active={activeType === tf.key}
                  onPress={() => setActiveType(tf.key)}
                  testID={`type-filter-${tf.key}`}
                />
              ))}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              testID="style-filter-row"
            >
              <FilterChip
                label="TOUS STYLES"
                active={!activeFilter}
                onPress={() => setActiveFilter(null)}
                testID="filter-all"
              />
              {STYLE_FILTERS.map((f) => (
                <FilterChip
                  key={f}
                  label={f}
                  active={activeFilter === f}
                  onPress={() =>
                    setActiveFilter((cur) => (cur === f ? null : f))
                  }
                  testID={`filter-${f}`}
                />
              ))}
            </ScrollView>

            <View style={{ paddingTop: 6, paddingBottom: 4 }}>
              {/* Sprint +1: a dedicated 'Proposer un artiste' form is
                  coming. For this release we keep the existing workshop
                  submit (still useful for profs) but relabel it to match
                  the new positioning. */}
              <SubmitEntryButton type="workshop" customLabel="+ PROPOSER UN ARTISTE" />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`teacher-${item.id}`}
            style={[styles.tile, { width: TILE_W }]}
            onPress={() => router.push(`/profs/${item.id}`)}
            activeOpacity={0.85}
          >
            {item.photo ? (
              <Image source={{ uri: item.photo }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoFallback]}>
                <Text style={styles.photoFallbackTxt}>
                  {item.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            {!!item.dance_styles && item.dance_styles.length > 0 && (
              <Text style={styles.styles} numberOfLines={1}>
                {item.dance_styles.slice(0, 2).join(" · ")}
              </Text>
            )}
            {!!item.bio && (
              <Text style={styles.bio} numberOfLines={2}>
                {item.bio}
              </Text>
            )}
            <View style={styles.viewRow}>
              <Text style={styles.viewTxt}>VOIR L&apos;ARTISTE</Text>
              <Ionicons name="arrow-forward" size={12} color={COLORS.primaryText} />
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
              <Text style={styles.emptyTxt}>
                {activeFilter
                  ? `Aucun artiste pour ${activeFilter}.`
                  : "Aucun artiste pour le moment."}
              </Text>
              {activeFilter && (
                <TouchableOpacity onPress={() => setActiveFilter(null)}>
                  <Text style={styles.emptyLink}>RÉINITIALISER LE FILTRE</Text>
                </TouchableOpacity>
              )}
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

function FilterChip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
        {label.toUpperCase()}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  hero: { paddingTop: 24, paddingBottom: 14, width: "100%" },
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
  divider: { height: 1, backgroundColor: COLORS.primaryText, marginBottom: 4 },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 14,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: COLORS.primaryText,
    borderColor: COLORS.primaryText,
  },
  chipTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.primaryText,
  },
  chipTxtActive: { color: COLORS.accentYellow },
  tile: {
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    backgroundColor: "#fff",
    padding: 10,
  },
  photo: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: COLORS.surface,
    marginBottom: 10,
  },
  photoFallback: {
    backgroundColor: COLORS.primaryText,
    alignItems: "center",
    justifyContent: "center",
  },
  photoFallbackTxt: {
    fontFamily: FONTS.heading,
    fontSize: 36,
    color: COLORS.accentYellow,
  },
  name: {
    fontFamily: FONTS.heading,
    fontSize: 17,
    color: COLORS.primaryText,
    letterSpacing: -0.3,
  },
  styles: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: COLORS.accentYellow,
    marginTop: 4,
    textTransform: "uppercase",
  },
  bio: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.secondaryText,
    marginTop: 6,
    lineHeight: 17,
  },
  viewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  viewTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: COLORS.primaryText,
  },
  empty: { padding: 40, alignItems: "center", gap: 12 },
  emptyTxt: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.primaryText },
  emptyLink: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
    textDecorationLine: "underline",
  },
});
