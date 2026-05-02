import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, TeacherItem } from "./api";
import { COLORS, FONTS, SPACING } from "./theme";

type EntryTypeSubmit = "soiree" | "workshop";

const EMPTY = {
  title: "",
  date: "",
  time: "",
  venue: "",
  address: "",
  description: "",
  instructor: "",
  teacher_id: "",
  level: "",
  price: "",
  category: "",
  ticket_link: "",
  submitter_name: "",
  submitter_email: "",
};

const LEVELS = [
  { v: "beginner", l: "Débutant" },
  { v: "intermediate", l: "Intermédiaire" },
  { v: "advanced", l: "Avancé" },
];
const CATEGORIES = [
  { v: "salsa", l: "Salsa cubaine" },
  { v: "afro-cuban", l: "Afro-cubain" },
  { v: "rumba", l: "Rumba" },
  { v: "son", l: "Son cubano" },
  { v: "rueda", l: "Rueda de casino" },
  { v: "other", l: "Autre" },
];

export default function SubmitEntryButton({
  type,
  presetTeacherId,
}: {
  type: EntryTypeSubmit;
  presetTeacherId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY, teacher_id: presetTeacherId || "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const isLockedTeacher = !!presetTeacherId;

  useEffect(() => {
    if (type === "workshop" && open && !isLockedTeacher && teachers.length === 0) {
      api.listTeachers().then(setTeachers).catch(() => {});
    }
  }, [type, open, isLockedTeacher, teachers.length]);

  const reset = () => {
    setForm({ ...EMPTY, teacher_id: presetTeacherId || "" });
    setSuccess(false);
  };

  const submit = async () => {
    if (
      !form.title.trim() ||
      !form.date.trim() ||
      !form.submitter_name.trim() ||
      !form.submitter_email.trim()
    ) {
      if (Platform.OS === "web")
        window.alert("Titre, date, votre nom et votre email sont requis");
      else Alert.alert("Champs manquants", "Titre, date, nom et email sont requis");
      return;
    }
    setSubmitting(true);
    try {
      await api.submitEntry({ type, ...form });
      setSuccess(true);
    } catch (e: any) {
      if (Platform.OS === "web") window.alert("Erreur : " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const label = type === "soiree" ? "PROPOSER UNE SOIRÉE" : "PROPOSER UN WORKSHOP";

  return (
    <>
      <TouchableOpacity
        testID={`submit-${type}-btn`}
        style={styles.cta}
        onPress={() => {
          reset();
          setOpen(true);
        }}
      >
        <Ionicons name="add-circle-outline" size={16} color={COLORS.primaryText} />
        <Text style={styles.ctaTxt}>{label}</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.backdrop}
        >
          <ScrollView
            contentContainerStyle={styles.sheetWrap}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {success
                    ? "Merci !"
                    : `Proposer ${
                        type === "soiree" ? "une soirée" : "un workshop"
                      }`}
                </Text>
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Ionicons name="close" size={22} color={COLORS.primaryText} />
                </TouchableOpacity>
              </View>

              {success ? (
                <View style={styles.successWrap}>
                  <View style={styles.successIcon}>
                    <Ionicons name="checkmark" size={32} color={COLORS.primaryText} />
                  </View>
                  <Text style={styles.successTxt}>
                    Votre proposition est bien reçue. Nous la validerons sous peu et
                    vous recontacterons si besoin à l&apos;adresse indiquée.
                  </Text>
                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={() => setOpen(false)}
                  >
                    <Text style={styles.submitTxt}>FERMER</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.help}>
                    Votre proposition sera soumise à validation par l&apos;équipe PCS
                    avant d&apos;apparaître publiquement.
                  </Text>

                  <Field
                    label="TITRE *"
                    testID="sub-title"
                    value={form.title}
                    onChange={(v) => setForm({ ...form, title: v })}
                  />
                  <Field
                    label="DATE (AAAA-MM-JJ) *"
                    testID="sub-date"
                    value={form.date}
                    onChange={(v) => setForm({ ...form, date: v })}
                    autoCapitalize="none"
                    placeholder="2026-05-22"
                  />
                  <Field
                    label="HORAIRE"
                    testID="sub-time"
                    value={form.time}
                    onChange={(v) => setForm({ ...form, time: v })}
                    placeholder="20:30"
                  />
                  <Field
                    label="LIEU"
                    testID="sub-venue"
                    value={form.venue}
                    onChange={(v) => setForm({ ...form, venue: v })}
                    placeholder="Le Cabaret Sauvage"
                  />
                  <Field
                    label="ADRESSE"
                    testID="sub-address"
                    value={form.address}
                    onChange={(v) => setForm({ ...form, address: v })}
                    placeholder="59 Bd Macdonald, 75019 Paris"
                  />

                  {type === "workshop" && (
                    <>
                      <Field
                        label="PROFESSEUR / INTERVENANT"
                        testID="sub-instructor"
                        value={form.instructor}
                        onChange={(v) => setForm({ ...form, instructor: v })}
                      />

                      {!isLockedTeacher && (
                        <View style={{ marginTop: 10 }}>
                          <Text style={styles.label}>FICHE PROF (optionnel)</Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 6 }}
                          >
                            <Chip
                              label="—"
                              active={!form.teacher_id}
                              onPress={() => setForm({ ...form, teacher_id: "" })}
                            />
                            {teachers.map((t) => (
                              <Chip
                                key={t.id}
                                label={t.name}
                                active={form.teacher_id === t.id}
                                onPress={() =>
                                  setForm({ ...form, teacher_id: t.id })
                                }
                              />
                            ))}
                          </ScrollView>
                        </View>
                      )}

                      {isLockedTeacher && (
                        <View style={styles.lockedTeacher}>
                          <Ionicons
                            name="lock-closed"
                            size={12}
                            color={COLORS.primaryText}
                          />
                          <Text style={styles.lockedTeacherTxt}>
                            Ce workshop sera rattaché à cette fiche artiste.
                          </Text>
                        </View>
                      )}

                      <View style={{ marginTop: 10 }}>
                        <Text style={styles.label}>NIVEAU</Text>
                        <View style={styles.chipRow}>
                          {LEVELS.map((opt) => (
                            <Chip
                              key={opt.v}
                              label={opt.l}
                              active={form.level === opt.v}
                              onPress={() =>
                                setForm({
                                  ...form,
                                  level: form.level === opt.v ? "" : opt.v,
                                })
                              }
                            />
                          ))}
                        </View>
                      </View>

                      <View style={{ marginTop: 10 }}>
                        <Text style={styles.label}>CATÉGORIE</Text>
                        <View style={styles.chipRow}>
                          {CATEGORIES.map((opt) => (
                            <Chip
                              key={opt.v}
                              label={opt.l}
                              active={form.category === opt.v}
                              onPress={() =>
                                setForm({
                                  ...form,
                                  category: form.category === opt.v ? "" : opt.v,
                                })
                              }
                            />
                          ))}
                        </View>
                      </View>

                      <Field
                        label="PRIX"
                        testID="sub-price"
                        value={form.price}
                        onChange={(v) => setForm({ ...form, price: v })}
                        placeholder="25€ ou Gratuit"
                      />
                    </>
                  )}

                  <Field
                    label="DESCRIPTION"
                    testID="sub-desc"
                    value={form.description}
                    onChange={(v) => setForm({ ...form, description: v })}
                    multiline
                  />
                  <Field
                    label="LIEN TICKET / BILLETTERIE"
                    testID="sub-ticket"
                    value={form.ticket_link}
                    onChange={(v) => setForm({ ...form, ticket_link: v })}
                    autoCapitalize="none"
                    placeholder="https://www.helloasso.com/..."
                  />

                  <View style={styles.divider} />
                  <Text style={styles.section}>VOS COORDONNÉES</Text>

                  <Field
                    label="VOTRE NOM *"
                    testID="sub-name"
                    value={form.submitter_name}
                    onChange={(v) => setForm({ ...form, submitter_name: v })}
                  />
                  <Field
                    label="VOTRE EMAIL *"
                    testID="sub-email"
                    value={form.submitter_email}
                    onChange={(v) => setForm({ ...form, submitter_email: v })}
                    autoCapitalize="none"
                    placeholder="contact@votre-asso.fr"
                  />

                  <TouchableOpacity
                    testID="submit-btn"
                    style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                    onPress={submit}
                    disabled={submitting}
                  >
                    <Text style={styles.submitTxt}>
                      {submitting
                        ? "ENVOI EN COURS..."
                        : "ENVOYER POUR VALIDATION"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  placeholder,
  testID,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  testID?: string;
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        style={[styles.input, multiline && { height: 80, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={COLORS.secondaryText}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    paddingVertical: 14,
    borderRadius: 40,
    marginBottom: 18,
    backgroundColor: "#fff",
  },
  ctaTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: COLORS.primaryText,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 40,
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: COLORS.primaryText,
    borderColor: COLORS.primaryText,
  },
  chipTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: COLORS.primaryText,
  },
  chipTxtActive: { color: COLORS.accentYellow },
  lockedTeacher: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFBEA",
    borderWidth: 1,
    borderColor: COLORS.accentYellow,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
    borderRadius: 6,
  },
  lockedTeacherTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.primaryText,
  },
  backdrop: { flex: 1, backgroundColor: COLORS.overlay },
  sheetWrap: { flexGrow: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    padding: SPACING.screen,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sheetTitle: {
    fontFamily: FONTS.heading,
    fontSize: 26,
    color: COLORS.primaryText,
  },
  help: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.secondaryText,
    marginBottom: 6,
  },
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.3,
    color: COLORS.primaryText,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.primaryText,
    borderRadius: 10,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 20,
    marginBottom: 14,
  },
  section: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: COLORS.primaryText,
    marginBottom: 2,
  },
  submitBtn: {
    marginTop: 22,
    backgroundColor: COLORS.accentYellow,
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 40,
  },
  submitTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
  },
  successWrap: { alignItems: "center", paddingVertical: 10 },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accentYellow,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  successTxt: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.primaryText,
    textAlign: "center",
    marginTop: 10,
  },
});
