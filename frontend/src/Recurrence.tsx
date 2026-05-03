import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS, FONTS } from "./theme";

export type Recurrence = {
  freq: "none" | "daily" | "weekly" | "biweekly" | "monthly_weekday" | "monthly_date";
  interval?: number;
  until?: string | null;
  count?: number | null;
};

export const RECURRENCE_PRESETS: {
  key: Recurrence["freq"];
  label: string;
  short: string;
}[] = [
  { key: "none", label: "Ne se répète pas", short: "AUCUNE" },
  { key: "daily", label: "Tous les jours", short: "QUOTIDIEN" },
  { key: "weekly", label: "Toutes les semaines", short: "HEBDO" },
  { key: "biweekly", label: "Toutes les 2 semaines", short: "BI-HEBDO" },
  { key: "monthly_weekday", label: "Tous les mois (même jour de semaine)", short: "MENSUEL/JOUR" },
  { key: "monthly_date", label: "Tous les mois (même date)", short: "MENSUEL/DATE" },
];

export const RECURRENCE_END_MODES = [
  { key: "rolling", label: "Jamais (fenêtre 3 mois glissants)" },
  { key: "until", label: "Jusqu'à une date" },
  { key: "count", label: "Après un nombre d'occurrences" },
];

type Props = {
  value: Recurrence;
  onChange: (v: Recurrence) => void;
  /** True when editing an existing master — shows a note about scope */
  isEditingMaster?: boolean;
};

export default function RecurrenceSection({ value, onChange, isEditingMaster }: Props) {
  const [endMode, setEndMode] = React.useState<"rolling" | "until" | "count">(
    value.until ? "until" : value.count ? "count" : "rolling"
  );

  const setFreq = (freq: Recurrence["freq"]) => {
    onChange({ ...value, freq });
  };

  const isRec = value.freq && value.freq !== "none";

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>RÉPÉTITION</Text>

      <View style={styles.presetRow}>
        {RECURRENCE_PRESETS.map((p) => {
          const active = (value.freq || "none") === p.key;
          return (
            <TouchableOpacity
              key={p.key}
              testID={`rec-${p.key}`}
              onPress={() => setFreq(p.key)}
              style={[styles.preset, active && styles.presetActive]}
            >
              <Text style={[styles.presetTxt, active && styles.presetTxtActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isRec ? (
        <>
          <Text style={styles.subLabel}>FIN DE RÉCURRENCE</Text>
          <View style={styles.endRow}>
            {RECURRENCE_END_MODES.map((m) => {
              const active = endMode === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  testID={`rec-end-${m.key}`}
                  onPress={() => {
                    setEndMode(m.key as any);
                    if (m.key === "rolling") {
                      onChange({ ...value, until: null, count: null });
                    } else if (m.key === "until") {
                      onChange({ ...value, count: null });
                    } else if (m.key === "count") {
                      onChange({ ...value, until: null });
                    }
                  }}
                  style={[styles.preset, active && styles.presetActive]}
                >
                  <Text style={[styles.presetTxt, active && styles.presetTxtActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {endMode === "until" && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.inputLabel}>DATE DE FIN (AAAA-MM-JJ)</Text>
              <TextInput
                testID="rec-until-input"
                style={styles.input}
                value={value.until || ""}
                onChangeText={(t) => onChange({ ...value, until: t })}
                placeholder="2027-12-31"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
              />
            </View>
          )}

          {endMode === "count" && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.inputLabel}>NOMBRE TOTAL D&apos;OCCURRENCES</Text>
              <TextInput
                testID="rec-count-input"
                style={styles.input}
                value={value.count ? String(value.count) : ""}
                onChangeText={(t) => onChange({ ...value, count: parseInt(t, 10) || null })}
                placeholder="10"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
            </View>
          )}

          {isEditingMaster ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoTxt}>
                ⚠️ Cet événement est un maître de récurrence. Modifier la règle régénérera
                les occurrences futures.
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 22 },
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
    marginBottom: 10,
  },
  subLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.3,
    color: COLORS.secondaryText,
    marginTop: 18,
    marginBottom: 8,
  },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  endRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preset: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  presetActive: {
    borderColor: COLORS.primaryText,
    backgroundColor: COLORS.accentYellow,
  },
  presetTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: COLORS.secondaryText,
  },
  presetTxtActive: { color: COLORS.primaryText },
  inputLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: COLORS.secondaryText,
    marginBottom: 6,
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
  infoBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#FEF3C7",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accentYellow,
  },
  infoTxt: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
  },
});

/** Scope picker modal content — used when saving changes on a recurring event */
export function RecurrenceScopeChooser({
  onPick,
  onCancel,
  isMaster,
}: {
  onPick: (scope: "this" | "future" | "all") => void;
  onCancel: () => void;
  isMaster?: boolean;
}) {
  return (
    <View style={scopeStyles.wrap}>
      <Text style={scopeStyles.title}>Appliquer les modifications à…</Text>
      <TouchableOpacity testID="scope-this" style={scopeStyles.opt} onPress={() => onPick("this")}>
        <Text style={scopeStyles.optTitle}>Uniquement cet événement</Text>
        <Text style={scopeStyles.optDesc}>Les autres occurrences restent inchangées.</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="scope-future" style={scopeStyles.opt} onPress={() => onPick("future")}>
        <Text style={scopeStyles.optTitle}>Cet événement et les suivants</Text>
        <Text style={scopeStyles.optDesc}>
          S&apos;applique à partir de cette date vers le futur.
        </Text>
      </TouchableOpacity>
      <TouchableOpacity testID="scope-all" style={scopeStyles.opt} onPress={() => onPick("all")}>
        <Text style={scopeStyles.optTitle}>Toute la série</Text>
        <Text style={scopeStyles.optDesc}>
          {isMaster
            ? "Y compris le maître et toutes ses occurrences."
            : "Y compris le maître, les occurrences passées et futures."}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity testID="scope-cancel" style={scopeStyles.cancel} onPress={onCancel}>
        <Text style={scopeStyles.cancelTxt}>Annuler</Text>
      </TouchableOpacity>
    </View>
  );
}

const scopeStyles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.background,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.primaryText,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: COLORS.primaryText,
    letterSpacing: -0.4,
    marginBottom: 18,
  },
  opt: {
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    padding: 14,
    marginBottom: 10,
  },
  optTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    letterSpacing: 0.5,
    color: COLORS.primaryText,
  },
  optDesc: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.secondaryText,
    marginTop: 4,
    lineHeight: 16,
  },
  cancel: { marginTop: 8, alignItems: "center", paddingVertical: 10 },
  cancelTxt: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12,
    color: COLORS.secondaryText,
  },
});
