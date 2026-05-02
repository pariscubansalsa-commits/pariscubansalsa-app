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
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import RoleGuard from "../../../src/RoleGuard";
import { useAuth } from "../../../src/auth";
import { api, EntryItem } from "../../../src/api";
import { COLORS, FONTS, SPACING } from "../../../src/theme";

const TYPES = [
  { key: "soiree", label: "Soirée" },
  { key: "workshop", label: "Workshop" },
  { key: "festival", label: "Festival" },
  { key: "agenda", label: "Sortie" },
];
const LEVELS = ["Débutant", "Intermédiaire", "Avancé", "Tous niveaux"];
const CATEGORIES = ["Salsa cubaine", "Son", "Rumba", "Rueda", "Afro-cubain"];

function Inner() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const isNew = params.id === "new";
  const { token, user } = useAuth();

  const [type, setType] = React.useState<string>("soiree");
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [venue, setVenue] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [level, setLevel] = React.useState("");
  const [category, setCategory] = React.useState("");
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
        const all = await api.organisateurEntries(token);
        const e = all.find((x) => x.id === params.id);
        if (!e) {
          setError("Événement introuvable.");
          return;
        }
        if (e.status && e.status !== "pending") {
          setError("Cet événement n'est plus modifiable (déjà validé ou refusé).");
          return;
        }
        if (cancelled) return;
        setType(e.type);
        setTitle(e.title);
        setDate(e.date || "");
        setEndDate(e.end_date || "");
        setTime(e.time || "");
        setVenue(e.venue || "");
        setAddress(e.address || "");
        setDescription(e.description || "");
        setLevel(e.level || "");
        setCategory(e.category || "");
        setPrice(e.price || "");
        setTicketLink(e.ticket_link || "");
      } catch (e: any) {
        setError(e.message || "Erreur de chargement.");
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
      setError("Titre et date sont obligatoires.");
      return;
    }
    if (!token) {
      setError("Session expirée.");
      return;
    }
    const body: Partial<EntryItem> = {
      type: type as any,
      title: title.trim(),
      date,
      end_date: endDate || null,
      time,
      venue,
      address,
      description,
      level,
      category,
      price,
      ticket_link: ticketLink,
    };
    setSaving(true);
    try {
      if (isNew) {
        await api.organisateurCreateEntry(token, body);
        Alert.alert("Soumis", "Votre événement est en attente de validation.");
      } else {
        await api.organisateurUpdateEntry(token, params.id as string, body);
        Alert.alert("Mis à jour", "Modifications enregistrées. L'événement reste en attente de validation.");
      }
      router.replace("/organisateur/dashboard" as any);
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'enregistrement.");
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
          <Text style={styles.topTitle}>
            {isNew ? "NOUVEL ÉVÉNEMENT" : "MODIFIER"}
          </Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.overline}>{user?.organizer?.structure_name || user?.name}</Text>
          <Text style={styles.title}>
            {isNew ? "Soumettre un " : "Modifier votre "}
            <Text style={styles.italic}>événement.</Text>
          </Text>

          <Text style={styles.label}>TYPE D&apos;ÉVÉNEMENT</Text>
          <View style={styles.chipsRow}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                testID={`type-${t.key}`}
                style={[styles.chip, type === t.key && styles.chipActive]}
                onPress={() => setType(t.key)}
              >
                <Text style={[styles.chipTxt, type === t.key && styles.chipTxtActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field label="TITRE *" testID="input-title" value={title} onChangeText={setTitle} />
          <Field label="DATE * (AAAA-MM-JJ)" testID="input-date" value={date} onChangeText={setDate} placeholder="2026-09-15" />
          {type === "festival" && (
            <Field label="DATE DE FIN" testID="input-end-date" value={endDate} onChangeText={setEndDate} placeholder="2026-09-17" />
          )}
          <Field label="HORAIRE" testID="input-time" value={time} onChangeText={setTime} placeholder="21h — 03h" />
          <Field label="LIEU" testID="input-venue" value={venue} onChangeText={setVenue} placeholder="Casa de la Salsa" />
          <Field label="ADRESSE" testID="input-address" value={address} onChangeText={setAddress} placeholder="12 rue…" />
          <Field
            label="DESCRIPTION"
            testID="input-description"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          {type === "workshop" && (
            <>
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
            </>
          )}
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
          <Field label="PRIX" testID="input-price" value={price} onChangeText={setPrice} placeholder="15€ — Gratuit" />
          <Field label="LIEN BILLETTERIE" testID="input-ticket" value={ticketLink} onChangeText={setTicketLink} placeholder="https://…" />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            testID="submit-event-btn"
            style={[styles.primary, saving && { opacity: 0.6 }]}
            disabled={saving}
            onPress={onSubmit}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.primaryText} />
            ) : (
              <Text style={styles.primaryTxt}>{isNew ? "SOUMETTRE" : "ENREGISTRER"}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  testID?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        testID={props.testID}
        style={[styles.input, props.multiline && { minHeight: 100, textAlignVertical: "top" }]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#9ca3af"
        multiline={props.multiline}
        autoCapitalize={props.label.includes("LIEN") ? "none" : "sentences"}
      />
    </View>
  );
}

export default function OrganisateurEventForm() {
  return (
    <RoleGuard allow={["organisateur"]}>
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
  overline: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.8, color: COLORS.secondaryText },
  title: { fontFamily: FONTS.heading, fontSize: 36, lineHeight: 40, color: COLORS.primaryText, marginTop: 8 },
  italic: { fontFamily: FONTS.headingItalic, fontStyle: "italic", color: COLORS.accentYellow },
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
    marginTop: 24,
    marginBottom: 8,
  },
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
  chip: {
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: COLORS.accentYellow },
  chipTxt: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1, color: COLORS.primaryText },
  chipTxtActive: { color: COLORS.primaryText },
  primary: {
    marginTop: 32,
    backgroundColor: COLORS.accentYellow,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryTxt: { fontFamily: FONTS.bodyBold, fontSize: 13, letterSpacing: 1.5, color: COLORS.primaryText },
  error: {
    color: "#dc2626",
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    marginTop: 16,
  },
});
