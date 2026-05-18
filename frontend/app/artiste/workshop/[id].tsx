import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,

} from "react-native";
import { confirmAction, notify } from "../../../src/dialog";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import RoleGuard from "../../../src/RoleGuard";
import { useAuth } from "../../../src/auth";
import { api } from "../../../src/api";
import { DanceStyleChips, DanceStyle } from "../../../src/DanceStyle";
import { COLORS, FONTS, SPACING } from "../../../src/theme";

const LEVELS = ["Débutant", "Intermédiaire", "Avancé", "Tous niveaux"];
const CATEGORIES = ["Salsa cubaine", "Son", "Rumba", "Rueda", "Afro-cubain"];

function Inner() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const isNew = params.id === "new";
  const { token } = useAuth();

  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [venue, setVenue] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [level, setLevel] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [danceStyle, setDanceStyle] = React.useState<DanceStyle>("multi_styles");
  const [price, setPrice] = React.useState("");
  const [ticketLink, setTicketLink] = React.useState("");

  const [loading, setLoading] = React.useState(!isNew);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isNew || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await api.artisteWorkshops(token);
        const w = all.find((x) => x.id === params.id);
        if (!w) {
          setError("Workshop introuvable.");
          return;
        }
        if (w.status && w.status !== "pending") {
          setError("Ce workshop n'est plus modifiable.");
          return;
        }
        if (cancelled) return;
        setTitle(w.title);
        setDate(w.date || "");
        setTime(w.time || "");
        setVenue(w.venue || "");
        setAddress(w.address || "");
        setDescription(w.description || "");
        setLevel(w.level || "");
        setCategory(w.category || "");
        setDanceStyle((w.dance_style as DanceStyle) || "multi_styles");
        setPrice(w.price || "");
        setTicketLink(w.ticket_link || "");
      } catch (e: any) {
        setError(e.message || "Erreur");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNew, params.id, token]);

  const onSubmit = async () => {
    setError(null);
    if (!title.trim() || !date.trim()) {
      setError("Titre et date obligatoires.");
      return;
    }
    if (!token) {
      setError("Session expirée.");
      return;
    }
    const body: any = {
      title: title.trim(),
      date,
      time,
      venue,
      address,
      description,
      level,
      category,
      dance_style: danceStyle,
      price,
      ticket_link: ticketLink,
    };
    setSaving(true);
    try {
      if (isNew) {
        await api.artisteCreateWorkshop(token, body);
        notify("Soumis", "Workshop en attente de validation.");
      } else {
        await api.artisteUpdateWorkshop(token, params.id as string, body);
        notify("Mis à jour", "Modifications enregistrées.");
      }
      router.replace("/artiste/dashboard" as any);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.primaryText} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.primaryText} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{isNew ? "NOUVEAU WORKSHOP" : "MODIFIER"}</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>
            {isNew ? "Soumettre un " : "Modifier le "}
            <Text style={styles.italic}>workshop.</Text>
          </Text>

          <Field label="TITRE *" testID="input-title" value={title} onChangeText={setTitle} />
          <Field label="DATE * (AAAA-MM-JJ)" testID="input-date" value={date} onChangeText={setDate} placeholder="2026-09-15" />
          <Field label="HORAIRE" testID="input-time" value={time} onChangeText={setTime} placeholder="14h — 17h" />
          <Field label="LIEU" testID="input-venue" value={venue} onChangeText={setVenue} />
          <Field label="ADRESSE" testID="input-address" value={address} onChangeText={setAddress} />
          <Field label="DESCRIPTION" testID="input-description" value={description} onChangeText={setDescription} multiline />

          <Text style={styles.label}>NIVEAU</Text>
          <View style={styles.chipsRow}>
            {LEVELS.map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.chip, level === l && styles.chipActive]}
                onPress={() => setLevel(level === l ? "" : l)}
              >
                <Text style={[styles.chipTxt, level === l && styles.chipTxtActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>STYLE</Text>
          <View style={styles.chipsRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, category === c && styles.chipActive]}
                onPress={() => setCategory(category === c ? "" : c)}
              >
                <Text style={[styles.chipTxt, category === c && styles.chipTxtActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ marginTop: 22 }}>
            <DanceStyleChips
              value={danceStyle}
              onChange={setDanceStyle}
              required
              testIDPrefix="artiste-style"
            />
          </View>

          <Field label="PRIX" testID="input-price" value={price} onChangeText={setPrice} />
          <Field label="LIEN BILLETTERIE" testID="input-ticket" value={ticketLink} onChangeText={setTicketLink} placeholder="https://…" />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            testID="submit-workshop-btn"
            style={[styles.primary, saving && { opacity: 0.6 }]}
            disabled={saving}
            onPress={onSubmit}
          >
            {saving ? <ActivityIndicator color={COLORS.primaryText} /> : <Text style={styles.primaryTxt}>{isNew ? "SOUMETTRE" : "ENREGISTRER"}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(p: { label: string; testID?: string; value: string; onChangeText: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={styles.label}>{p.label}</Text>
      <TextInput
        testID={p.testID}
        style={[styles.input, p.multiline && { minHeight: 100, textAlignVertical: "top" }]}
        value={p.value}
        onChangeText={p.onChangeText}
        placeholder={p.placeholder}
        placeholderTextColor="#9ca3af"
        multiline={p.multiline}
        autoCapitalize={p.label.includes("LIEN") ? "none" : "sentences"}
      />
    </View>
  );
}

export default function ArtisteWorkshopForm() {
  return (
    <RoleGuard allow={["artiste"]}>
      <Inner />
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screen,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topTitle: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.5, color: COLORS.primaryText },
  body: { padding: SPACING.screen, paddingBottom: 100 },
  title: { fontFamily: FONTS.heading, fontSize: 36, lineHeight: 40, color: COLORS.primaryText },
  italic: { fontFamily: FONTS.headingItalic, fontStyle: "italic", color: COLORS.accentYellow },
  label: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.5, color: COLORS.primaryText, marginTop: 22, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.primaryText,
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.primaryText, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: COLORS.accentYellow },
  chipTxt: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1, color: COLORS.primaryText },
  chipTxtActive: { color: COLORS.primaryText },
  primary: {
    marginTop: 28,
    backgroundColor: COLORS.accentYellow,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryTxt: { fontFamily: FONTS.bodyBold, fontSize: 13, letterSpacing: 1.5, color: COLORS.primaryText },
  error: { color: "#dc2626", fontFamily: FONTS.bodySemi, fontSize: 13, marginTop: 14 },
});
