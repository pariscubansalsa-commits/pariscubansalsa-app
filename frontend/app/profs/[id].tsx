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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, TeacherItem } from "../../src/api";
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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const t = await api.getTeacher(id);
      setTeacher(t);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
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
          <Text style={styles.err}>Professeur introuvable.</Text>
          <TouchableOpacity onPress={() => router.replace("/profs")}>
            <Text style={styles.backLink}>RETOUR</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const ig = teacher.instagram?.replace(/^@/, "");
  const fb = teacher.facebook;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>PROF</Text>
        <View style={{ width: 20 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
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
          <Text style={styles.overline}>PROFESSEUR DE SALSA CUBAINE</Text>
          <Text style={styles.name}>{teacher.name}</Text>
          {!!teacher.bio && <Text style={styles.bio}>{teacher.bio}</Text>}

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
  photo: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: COLORS.surface,
  },
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
    marginTop: 28,
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
});
