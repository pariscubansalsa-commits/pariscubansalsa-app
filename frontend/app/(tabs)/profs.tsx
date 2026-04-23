import React, { useCallback, useEffect, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, TeacherItem } from "../../src/api";
import TopBar from "../../src/TopBar";
import { COLORS, FONTS, SPACING } from "../../src/theme";

const { width: SCREEN_W } = Dimensions.get("window");
const NUM_COLS = SCREEN_W >= 600 ? 3 : 2;
const GAP = 12;
const TILE_W = (SCREEN_W - SPACING.screen * 2 - GAP * (NUM_COLS - 1)) / NUM_COLS;

export default function Profs() {
  const router = useRouter();
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <TopBar />
      <FlatList
        testID="profs-list"
        data={teachers}
        numColumns={NUM_COLS}
        columnWrapperStyle={NUM_COLS > 1 ? { gap: GAP } : undefined}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{
          paddingHorizontal: SPACING.screen,
          paddingBottom: 40,
          gap: GAP,
        }}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Text style={styles.overline}>ANNUAIRE DES PROFS</Text>
            <Text style={styles.title}>
              Les{" "}
              <Text
                style={{
                  fontFamily: FONTS.headingItalic,
                  fontStyle: "italic",
                  color: COLORS.accentYellow,
                }}
              >
                profs
              </Text>{" "}
              de la scène parisienne.
            </Text>
            <Text style={styles.subtitle}>
              Découvrez les enseignants qui font vivre la salsa cubaine à Paris.
            </Text>
            <View style={styles.divider} />
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
            {!!item.bio && (
              <Text style={styles.bio} numberOfLines={2}>
                {item.bio}
              </Text>
            )}
            <View style={styles.viewRow}>
              <Text style={styles.viewTxt}>FICHE COMPLÈTE</Text>
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
              <Text style={styles.emptyTxt}>Aucun prof pour le moment.</Text>
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
  hero: { paddingTop: 24, paddingBottom: 20, width: "100%" },
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
  divider: { height: 1, backgroundColor: COLORS.primaryText, marginBottom: 16 },
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
  bio: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.secondaryText,
    marginTop: 4,
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
  empty: { padding: 40, alignItems: "center" },
  emptyTxt: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.primaryText },
});
