import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Linking,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, EntryItem, TeacherItem } from "../../src/api";
import EntryCard from "../../src/EntryCard";
import SubmitEntryButton from "../../src/SubmitEntryButton";
import { COLORS, FONTS, SPACING } from "../../src/theme";

async function openLink(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(url, "_blank");
    return;
  }
  const can = await Linking.canOpenURL(url);
  if (can) Linking.openURL(url);
}

export default function TeacherDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherItem | null>(null);
  const [workshops, setWorkshops] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [t, ws] = await Promise.all([
        api.getTeacher(id),
        api.listTeacherWorkshops(id).catch(() => [] as EntryItem[]),
      ]);
      setTeacher(t);
      setWorkshops(ws);
    } catch (e) {
      console.log("teacher detail err", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loader}>
          <ActivityIndicator color={COLORS.primaryText} />
        </View>
      </SafeAreaView>
    );
  }

  if (!teacher) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loader}>
          <Text style={styles.err}>Artiste introuvable.</Text>
          <TouchableOpacity onPress={() => router.replace("/profs")}>
            <Text style={styles.backLink}>RETOUR</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const ig = teacher.instagram?.replace(/^@/, "");
  const fb = teacher.facebook;
  const styles_dance = teacher.dance_styles || [];
  const featuredWorkshops = workshops.filter((w) => w.status === "featured");
  const approvedWorkshops = workshops.filter((w) => w.status !== "featured");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>FICHE ARTISTE</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
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
      >
        {teacher.photo ? (
          <Image source={{ uri: teacher.photo }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoFallback]}>
            <Text style={styles.photoFallbackTxt}>
              {teacher.name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.body}>
          <Text style={styles.overline}>ARTISTE — SCÈNE CUBAINE PARISIENNE</Text>
          <Text style={styles.name}>{teacher.name}</Text>

          {styles_dance.length > 0 && (
            <View style={styles.stylesRow}>
              {styles_dance.map((s, i) => (
                <View key={`${s}-${i}`} style={styles.styleChip}>
                  <Text style={styles.styleChipTxt}>{s.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          )}

          {!!teacher.bio && <Text style={styles.bio}>{teacher.bio}</Text>}

          {(!!ig || !!fb) && (
            <View style={styles.socials}>
              {!!ig && (
                <TouchableOpacity
                  testID="ig-link"
                  style={styles.socialBtn}
                  onPress={() => openLink(`https://instagram.com/${ig}`)}
                >
                  <Ionicons name="logo-instagram" size={16} color={COLORS.primaryText} />
                  <Text style={styles.socialTxt}>@{ig}</Text>
                </TouchableOpacity>
              )}
              {!!fb && (
                <TouchableOpacity
                  testID="fb-link"
                  style={styles.socialBtn}
                  onPress={() => openLink(fb!)}
                >
                  <Ionicons name="logo-facebook" size={16} color={COLORS.primaryText} />
                  <Text style={styles.socialTxt}>Facebook</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.sectionDivider} />

          <View style={styles.sectionHead}>
            <Text style={styles.sectionOverline}>WORKSHOPS À VENIR</Text>
            <Text style={styles.sectionTitle}>
              Avec{" "}
              <Text
                style={{
                  fontFamily: FONTS.headingItalic,
                  fontStyle: "italic",
                  color: COLORS.accentYellow,
                }}
              >
                {teacher.name.split(" ")[0]}
              </Text>
            </Text>
            <Text style={styles.sectionSub}>
              {workshops.length === 0
                ? "Aucun workshop programmé pour le moment."
                : "Coups de cœur d'abord, puis les autres dates validées."}
            </Text>
          </View>

          {featuredWorkshops.length > 0 && (
            <View style={styles.featuredBand}>
              <Text style={styles.featuredLabel}>★ COUP DE CŒUR PCS</Text>
              {featuredWorkshops.map((w) => (
                <EntryCard
                  key={w.id}
                  entry={w}
                  onPress={() => router.push(`/entry/${w.id}`)}
                />
              ))}
            </View>
          )}

          {approvedWorkshops.map((w) => (
            <EntryCard
              key={w.id}
              entry={w}
              onPress={() => router.push(`/entry/${w.id}`)}
            />
          ))}

          <View style={styles.proposeWrap}>
            <Text style={styles.proposeOverline}>VOUS ÊTES CET ARTISTE ?</Text>
            <Text style={styles.proposeTitle}>Proposez votre prochain workshop</Text>
            <Text style={styles.proposeSub}>
              Soumettez la fiche de votre stage. Notre équipe valide les contenus
              avant publication, sauf si vous êtes artiste vérifié.
            </Text>
            <SubmitEntryButton type="workshop" presetTeacherId={teacher.id} />
          </View>
        </View>
      </ScrollView>
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
  topTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.primaryText,
  },
  photo: { width: "100%", aspectRatio: 1, backgroundColor: COLORS.surface },
  photoFallback: {
    backgroundColor: COLORS.primaryText,
    alignItems: "center",
    justifyContent: "center",
  },
  photoFallbackTxt: {
    fontFamily: FONTS.heading,
    fontSize: 96,
    color: COLORS.accentYellow,
  },
  body: { padding: SPACING.screen },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: COLORS.secondaryText,
    marginBottom: 10,
  },
  name: {
    fontFamily: FONTS.heading,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1,
    color: COLORS.primaryText,
  },
  stylesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 16,
  },
  styleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    backgroundColor: COLORS.accentYellow,
  },
  styleChipTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: COLORS.primaryText,
  },
  bio: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.primaryText,
    marginTop: 20,
  },
  socials: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    flexWrap: "wrap",
  },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  socialTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    color: COLORS.primaryText,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: COLORS.primaryText,
    marginTop: 36,
    marginBottom: 20,
  },
  sectionHead: { marginBottom: 18 },
  sectionOverline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: COLORS.secondaryText,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: FONTS.heading,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: COLORS.primaryText,
  },
  sectionSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.secondaryText,
    marginTop: 8,
  },
  featuredBand: {
    backgroundColor: "#1A1A1A",
    padding: 14,
    marginBottom: 16,
    borderRadius: 12,
  },
  featuredLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: COLORS.accentYellow,
    marginBottom: 10,
  },
  proposeWrap: {
    marginTop: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FAFAFA",
  },
  proposeOverline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: COLORS.secondaryText,
    marginBottom: 6,
  },
  proposeTitle: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: COLORS.primaryText,
    marginBottom: 6,
  },
  proposeSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.secondaryText,
    marginBottom: 14,
  },
});
