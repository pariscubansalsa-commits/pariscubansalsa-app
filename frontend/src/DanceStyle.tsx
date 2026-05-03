import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { COLORS, FONTS } from "./theme";

export type DanceStyle = "salsa_cubaine" | "on2" | "multi_styles" | "autre";

export const DANCE_STYLES: { key: DanceStyle; label: string; short: string }[] = [
  { key: "salsa_cubaine", label: "Salsa Cubaine", short: "CUBAINE" },
  { key: "on2", label: "On2", short: "ON2" },
  { key: "multi_styles", label: "Multi-styles", short: "MULTI" },
  { key: "autre", label: "Autre", short: "AUTRE" },
];

export const DANCE_STYLE_LABELS: Record<DanceStyle, string> = {
  salsa_cubaine: "Salsa Cubaine",
  on2: "On2",
  multi_styles: "Multi-styles",
  autre: "Autre",
};

/** Get visual properties for a dance style badge.
 *  - cubaine → solid yellow
 *  - on2 → solid grey
 *  - multi-styles → outlined (transparent bg)
 *  - autre → light grey
 */
export function getDanceStyleVisual(style?: string | null) {
  switch (style) {
    case "salsa_cubaine":
      return {
        bg: COLORS.accentYellow,
        fg: COLORS.primaryText,
        border: COLORS.primaryText,
        outlined: false,
      };
    case "on2":
      return {
        bg: "#374151",
        fg: "#FFFFFF",
        border: "#374151",
        outlined: false,
      };
    case "multi_styles":
      return {
        bg: "transparent",
        fg: COLORS.primaryText,
        border: COLORS.primaryText,
        outlined: true,
      };
    case "autre":
    default:
      return {
        bg: "#E5E7EB",
        fg: COLORS.secondaryText,
        border: "#D1D5DB",
        outlined: false,
      };
  }
}

/** Selectable input chips — used in event creation forms. */
export function DanceStyleChips({
  value,
  onChange,
  required = false,
  testIDPrefix = "dance-style",
}: {
  value?: DanceStyle | null;
  onChange: (v: DanceStyle) => void;
  required?: boolean;
  testIDPrefix?: string;
}) {
  return (
    <View>
      <Text style={styles.label}>STYLE DE DANSE {required ? "*" : ""}</Text>
      <View style={styles.row}>
        {DANCE_STYLES.map((s) => {
          const active = value === s.key;
          const v = getDanceStyleVisual(s.key);
          return (
            <TouchableOpacity
              key={s.key}
              testID={`${testIDPrefix}-${s.key}`}
              onPress={() => onChange(s.key)}
              style={[
                styles.chip,
                {
                  borderColor: active ? COLORS.primaryText : COLORS.border,
                  backgroundColor: active ? v.bg : "transparent",
                },
              ]}
            >
              <Text
                style={[
                  styles.chipTxt,
                  { color: active ? v.fg : COLORS.secondaryText },
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/** Filter chips with an "All" option — used on public/admin listings. */
export function DanceStyleFilterChips({
  value,
  onChange,
  testIDPrefix = "filter",
}: {
  value: DanceStyle | "all";
  onChange: (v: DanceStyle | "all") => void;
  testIDPrefix?: string;
}) {
  const items: { key: DanceStyle | "all"; label: string }[] = [
    { key: "all", label: "TOUS" },
    { key: "salsa_cubaine", label: "SALSA CUBAINE" },
    { key: "on2", label: "ON2" },
    { key: "multi_styles", label: "MULTI-STYLES" },
    { key: "autre", label: "AUTRE" },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
    >
      {items.map((it) => {
        const active = value === it.key;
        return (
          <TouchableOpacity
            key={it.key}
            testID={`${testIDPrefix}-${it.key}`}
            onPress={() => onChange(it.key)}
            style={[styles.filterChip, active && styles.filterChipActive]}
          >
            <Text style={[styles.filterTxt, active && styles.filterTxtActive]}>
              {it.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/** Compact badge to display a dance style on an EntryCard or detail page. */
export function DanceStyleBadge({
  style,
  size = "sm",
}: {
  style?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  if (!style) return null;
  const found = DANCE_STYLES.find((s) => s.key === style);
  if (!found) return null;
  const v = getDanceStyleVisual(style);
  const dims =
    size === "lg"
      ? { px: 14, py: 8, fs: 13 }
      : size === "md"
      ? { px: 10, py: 6, fs: 11 }
      : { px: 8, py: 4, fs: 10 };
  return (
    <View
      style={{
        paddingHorizontal: dims.px,
        paddingVertical: dims.py,
        backgroundColor: v.bg,
        borderWidth: v.outlined ? 1 : 0,
        borderColor: v.border,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: dims.fs,
          letterSpacing: 1,
          color: v.fg,
        }}
      >
        {found.short}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.primaryText,
    marginBottom: 8,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
    paddingRight: 16,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "transparent",
  },
  filterChipActive: {
    borderColor: COLORS.primaryText,
    backgroundColor: COLORS.primaryText,
  },
  filterTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.secondaryText,
  },
  filterTxtActive: { color: "#FFFFFF" },
});
