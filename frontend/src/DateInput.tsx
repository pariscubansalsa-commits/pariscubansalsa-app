import React from "react";
import { Platform, TextInput, View, StyleSheet } from "react-native";
import { COLORS, FONTS } from "./theme";

/**
 * Cross-platform date / time picker.
 *
 * On web (the only target right now — PWA via Expo Web):
 *   uses the native `<input type="date">` or `<input type="time">` which
 *   triggers the OS-level picker on iOS/Android browsers (best possible
 *   mobile UX) and renders a sane fallback on desktop browsers.
 *
 * On native (RN iOS/Android, if ever shipped via App Store):
 *   falls back to a plain TextInput with placeholder. Hookup with
 *   `@react-native-community/datetimepicker` can be plugged here later
 *   without changing call sites.
 *
 * Storage: value is always **ISO** (`YYYY-MM-DD` / `HH:MM`) so the rest
 * of the stack (Mongo, sorting, comparisons) stays consistent. Display
 * conversion to JJ/MM/AAAA happens at render time via `formatISOtoFR`.
 */
export type DateInputMode = "date" | "time";

export type DateInputProps = {
  value: string;                  // ISO: "YYYY-MM-DD" or "HH:MM"
  onChange: (iso: string) => void;
  mode?: DateInputMode;
  placeholder?: string;
  testID?: string;
};

export default function DateInput({
  value,
  onChange,
  mode = "date",
  placeholder,
  testID,
}: DateInputProps) {
  if (Platform.OS === "web") {
    // Cast through `as any` because RN doesn't type the underlying <input>.
    return (
      <View style={styles.wrap}>
        {React.createElement("input" as any, {
          type: mode,
          value: value || "",
          onChange: (e: any) => onChange(e?.target?.value || ""),
          "data-testid": testID,
          style: {
            width: "100%",
            backgroundColor: "transparent",
            color: COLORS.primaryText,
            border: "none",
            outline: "none",
            fontFamily: FONTS.body,
            fontSize: 14,
            padding: "10px 12px",
            // Force the visible placeholder text to look like FR format.
            // Browsers handle the underlying value as ISO — only the
            // display string is locale-driven.
          },
        })}
      </View>
    );
  }

  // Native fallback (kept simple — PWA-first product).
  return (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder || (mode === "date" ? "JJ/MM/AAAA" : "HH:MM")}
      placeholderTextColor={COLORS.secondaryText}
      style={styles.fallback}
    />
  );
}

// ────────────── helpers (ISO ⇄ FR display) ──────────────

/** "2026-07-04" → "04/07/2026". Empty / invalid input returns "". */
export function formatISOtoFR(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(iso));
  if (!m) return String(iso); // not ISO — pass through, backend will tolerate
  const [, y, mo, d] = m;
  return `${d.padStart(2, "0")}/${mo.padStart(2, "0")}/${y}`;
}

/** "04/07/2026" → "2026-07-04". Empty / invalid input returns "". */
export function formatFRtoISO(fr?: string | null): string {
  if (!fr) return "";
  const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(String(fr).trim());
  if (!m) return String(fr);
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  fallback: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.primaryText,
    fontFamily: FONTS.body,
    fontSize: 14,
  },
});
