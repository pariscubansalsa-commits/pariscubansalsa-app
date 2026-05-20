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

  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { confirmAction, notify } from "./dialog";
import { Ionicons } from "@expo/vector-icons";
import { api, TeacherItem } from "./api";
import { COLORS, FONTS, SPACING } from "./theme";
import { DanceStyleChips, DanceStyle } from "./DanceStyle";

export type EntryTypeSubmit = "soiree" | "workshop" | "festival" | "agenda" | "mensuelle";

const EMPTY = {
  title: "",
  date: "",
  end_date: "",
  time: "",
  end_time: "",
  venue: "",
  address: "",
  description: "",
  instructor: "",
  teacher_id: "",
  level: "",
  price: "",
  category: "",
  ticket_link: "",
  instagram_post: "",
  cover_photo: "" as string,
  submitter_name: "",
  submitter_email: "",
  submitter_link: "",
};

const TYPE_OPTIONS: { v: EntryTypeSubmit; l: string }[] = [
  { v: "soiree", l: "Soirée / concert" },
  { v: "mensuelle", l: "Mensuelle" },
  { v: "workshop", l: "Workshop" },
  { v: "festival", l: "Festival" },
  { v: "agenda", l: "Sortie / autre" },
];

const LEVELS = [
  { v: "beginner", l: "Débutant" },
  { v: "intermediate", l: "Intermédiaire" },
  { v: "advanced", l: "Avancé" },
];

export default function SubmitEntryButton({
  type,
  presetTeacherId,
  customLabel,
}: {
  type: EntryTypeSubmit;
  presetTeacherId?: string;
  /** Override the default button label */
  customLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const [currentType, setCurrentType] = useState<EntryTypeSubmit>(type);
  const [form, setForm] = useState({ ...EMPTY, teacher_id: presetTeacherId || "" });
  const [danceStyle, setDanceStyle] = useState<DanceStyle>("multi_styles");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const isLockedTeacher = !!presetTeacherId;

  useEffect(() => {
    if (open) setCurrentType(type);
  }, [open, type]);

  useEffect(() => {
    if (currentType === "workshop" && open && !isLockedTeacher && teachers.length === 0) {
      api.listTeachers().then(setTeachers).catch(() => {});
    }
  }, [currentType, open, isLockedTeacher, teachers.length]);

  const reset = () => {
    setForm({ ...EMPTY, teacher_id: presetTeacherId || "" });
    setDanceStyle("multi_styles");
    setSuccess(false);
  };

  const pickImage = async () => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      // Limit to ~3MB raw to keep base64 reasonable
      if (file.size > 3 * 1024 * 1024) {
        window.alert("Image trop lourde (3 Mo max). Compressez-la avant l'envoi.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setForm((f) => ({ ...f, cover_photo: String(reader.result) }));
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const submit = async () => {
    if (
      !form.title.trim() ||
      !form.date.trim() ||
      !form.submitter_name.trim() ||
      !form.submitter_email.trim()
    ) {
      const msg = "Titre, date, votre nom et votre email sont obligatoires.";
      if (Platform.OS === "web") window.alert(msg);
      else notify("Champs manquants", msg);
      return;
    }
    setSubmitting(true);
    try {
      await api.submitEntry({
        type: currentType,
        ...form,
        dance_style: danceStyle,
        cover_photo: form.cover_photo || null,
      });
      setSuccess(true);
    } catch (e: any) {
      const msg = "Erreur : " + (e.message || "envoi impossible");
      if (Platform.OS === "web") window.alert(msg);
      else notify("Erreur", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const defaultLabel: Record<EntryTypeSubmit, string> = {
    soiree: "PROPOSER UNE SOIRÉE",
    workshop: "PROPOSER UN WORKSHOP",
    festival: "PROPOSER UN FESTIVAL",
    agenda: "PROPOSER UN EVENT",
    mensuelle: "PROPOSER UNE MENSUELLE",
  };
  const label = customLabel || defaultLabel[type];

  const titleNoun: Record<EntryTypeSubmit, string> = {
    soiree: "une soirée",
    workshop: "un workshop",
    festival: "un festival",
    agenda: "un event",
    mensuelle: "une mensuelle",
  };

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
            <View style={[styles.sheet, { paddingTop: Math.max(insets.top + 12, 20) }]}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {success ? "Merci !" : `Proposer ${titleNoun[currentType]}`}
                </Text>
                <TouchableOpacity
                  testID="close-submit-modal"
                  onPress={() => setOpen(false)}
                  hitSlop={12}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={22} color={COLORS.primaryText} />
                </TouchableOpacity>
              </View>

              {success ? (
                <View style={styles.successWrap}>
                  <View style={styles.successIcon}>
                    <Ionicons name="checkmark" size={32} color={COLORS.primaryText} />
                  </View>
                  <Text style={styles.successTxt}>
                    Votre proposition est bien reçue. L&apos;équipe Paris Cuban Salsa la
                    validera sous peu et vous recontactera à l&apos;adresse indiquée si
                    besoin.
                  </Text>
                  <TouchableOpacity style={styles.submitBtn} onPress={() => setOpen(false)}>
                    <Text style={styles.submitTxt}>FERMER</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.help}>
                    Pas besoin de compte. Remplissez ce formulaire — votre proposition
                    sera validée par l&apos;équipe avant d&apos;apparaître publiquement.
                  </Text>

                  <Text style={styles.label}>TYPE D&apos;EVENT *</Text>
                  <View style={styles.chipRow}>
                    {TYPE_OPTIONS.map((opt) => (
                      <Chip
                        key={opt.v}
                        label={opt.l}
                        active={currentType === opt.v}
                        onPress={() => setCurrentType(opt.v)}
                        testID={`submit-type-${opt.v}`}
                      />
                    ))}
                  </View>

                  <Field
                    label="TITRE *"
                    testID="sub-title"
                    value={form.title}
                    onChange={(v) => setForm({ ...form, title: v })}
                  />
                  <Field
                    label="DATE * (AAAA-MM-JJ)"
                    testID="sub-date"
                    value={form.date}
                    onChange={(v) => setForm({ ...form, date: v })}
                    autoCapitalize="none"
                    placeholder="2027-05-22"
                  />
                  {currentType === "festival" && (
                    <Field
                      label="DATE DE FIN (AAAA-MM-JJ)"
                      testID="sub-end-date"
                      value={form.end_date}
                      onChange={(v) => setForm({ ...form, end_date: v })}
                      autoCapitalize="none"
                      placeholder="2027-05-25"
                    />
                  )}

                  <View style={styles.timeRow}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="HEURE DÉBUT"
                        testID="sub-time"
                        value={form.time}
                        onChange={(v) => setForm({ ...form, time: v })}
                        placeholder="20:30"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="HEURE FIN"
                        testID="sub-end-time"
                        value={form.end_time}
                        onChange={(v) => setForm({ ...form, end_time: v })}
                        placeholder="03:00"
                      />
                    </View>
                  </View>

                  <Field
                    label="LIEU / SALLE"
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
                  <Field
                    label="DESCRIPTION"
                    testID="sub-desc"
                    value={form.description}
                    onChange={(v) => setForm({ ...form, description: v })}
                    multiline
                  />

                  {currentType === "workshop" && (
                    <>
                      <Field
                        label="PROFESSEUR / INTERVENANT"
                        testID="sub-instructor"
                        value={form.instructor}
                        onChange={(v) => setForm({ ...form, instructor: v })}
                      />
                      {!isLockedTeacher && teachers.length > 0 && (
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
                                onPress={() => setForm({ ...form, teacher_id: t.id })}
                              />
                            ))}
                          </ScrollView>
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
                    </>
                  )}

                  <View style={{ marginTop: 14 }}>
                    <DanceStyleChips
                      value={danceStyle}
                      onChange={setDanceStyle}
                      required
                      testIDPrefix="sub-style"
                    />
                  </View>

                  <Field
                    label="PRIX"
                    testID="sub-price"
                    value={form.price}
                    onChange={(v) => setForm({ ...form, price: v })}
                    placeholder="25€ ou Gratuit"
                  />
                  <Field
                    label="LIEN BILLETTERIE"
                    testID="sub-ticket"
                    value={form.ticket_link}
                    onChange={(v) => setForm({ ...form, ticket_link: v })}
                    autoCapitalize="none"
                    placeholder="https://www.helloasso.com/..."
                  />

                  {currentType === "mensuelle" && (
                    <Field
                      label="LIEN POST INSTAGRAM (optionnel)"
                      testID="sub-instagram-post"
                      value={form.instagram_post}
                      onChange={(v) => setForm({ ...form, instagram_post: v })}
                      autoCapitalize="none"
                      placeholder="https://www.instagram.com/p/XXXXXXX/"
                    />
                  )}

                  <Text style={[styles.label, { marginTop: 14 }]}>IMAGE / AFFICHE</Text>
                  {form.cover_photo ? (
                    <View style={styles.imagePreviewWrap}>
                      <Image
                        source={{ uri: form.cover_photo }}
                        style={styles.imagePreview}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        testID="sub-cover-remove"
                        style={styles.imageRemove}
                        onPress={() => setForm({ ...form, cover_photo: "" })}
                      >
                        <Ionicons name="close-circle" size={20} color="#fff" />
                        <Text style={styles.imageRemoveTxt}>Retirer</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      testID="sub-cover-upload"
                      style={styles.imageBtn}
                      onPress={pickImage}
                    >
                      <Ionicons name="image-outline" size={18} color={COLORS.primaryText} />
                      <Text style={styles.imageBtnTxt}>CHOISIR UNE IMAGE</Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.divider} />
                  <Text style={styles.section}>VOS COORDONNÉES</Text>

                  <Field
                    label="VOTRE NOM / STRUCTURE *"
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
                  <Field
                    label="INSTAGRAM OU SITE WEB"
                    testID="sub-link"
                    value={form.submitter_link}
                    onChange={(v) => setForm({ ...form, submitter_link: v })}
                    autoCapitalize="none"
                    placeholder="@votreasso ou https://..."
                  />

                  <TouchableOpacity
                    testID="submit-btn"
                    style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                    onPress={submit}
                    disabled={submitting}
                  >
                    <Text style={styles.submitTxt}>
                      {submitting ? "ENVOI EN COURS..." : "ENVOYER POUR VALIDATION"}
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
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      testID={testID}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{label}</Text>
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
  timeRow: { flexDirection: "row", gap: 10 },
  imageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.border,
    paddingVertical: 18,
    borderRadius: 10,
    marginTop: 4,
  },
  imageBtnTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.primaryText,
  },
  imagePreviewWrap: { position: "relative", marginTop: 4 },
  imagePreview: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  imageRemove: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  imageRemoveTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: "#fff",
    letterSpacing: 0.5,
  },
  backdrop: { flex: 1, backgroundColor: COLORS.overlay },
  sheetWrap: { flexGrow: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    paddingHorizontal: SPACING.screen,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.04)",
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
    marginBottom: 12,
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
