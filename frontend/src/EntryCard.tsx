import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS } from "./theme";
import { EntryItem } from "./api";

const MONTHS_FR = [
  "janv.", "févr.", "mars", "avril", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateFR(isoDate: string): { day: string; month: string; weekday: string } {
  const d = parseDate(isoDate);
  if (!d) return { day: "--", month: "--", weekday: "" };
  const days = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: MONTHS_FR[d.getMonth()],
    weekday: days[d.getDay()],
  };
}

export function formatDateRangeFR(start: string, end?: string | null): string {
  const s = parseDate(start);
  if (!s) return start;
  const e = parseDate(end || null);
  const sStr = `${s.getDate()} ${MONTHS_FR[s.getMonth()]}`;
  if (!e) return `${sStr} ${s.getFullYear()}`;
  const eStr = `${e.getDate()} ${MONTHS_FR[e.getMonth()]} ${e.getFullYear()}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} – ${e.getDate()} ${MONTHS_FR[e.getMonth()]} ${e.getFullYear()}`;
  }
  return `${sStr} – ${eStr}`;
}

async function openLink(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(url, "_blank");
    return;
  }
  const can = await Linking.canOpenURL(url);
  if (can) Linking.openURL(url);
}

export default function EntryCard({
  entry,
  onAdminEdit,
  onAdminDelete,
  isAdmin,
}: {
  entry: EntryItem;
  onAdminEdit?: () => void;
  onAdminDelete?: () => void;
  isAdmin?: boolean;
}) {
  const isFestival = entry.type === "festival";
  const { day, month, weekday } = formatDateFR(entry.date);
  const rangeLabel = isFestival
    ? formatDateRangeFR(entry.date, entry.end_date)
    : null;

  return (
    <View style={styles.card} testID={`entry-card-${entry.id}`}>
      <View style={styles.row}>
        {/* Date block */}
        <View style={styles.dateBlock}>
          {!isFestival ? (
            <>
              <Text style={styles.weekday}>{weekday}</Text>
              <Text style={styles.day}>{day}</Text>
              <Text style={styles.month}>{month}</Text>
            </>
          ) : (
            <View style={styles.festivalBadge}>
              <Ionicons name="calendar" size={18} color={COLORS.primaryText} />
            </View>
          )}
        </View>

        <View style={styles.content}>
          {entry.type === "workshop" && !!entry.instructor && (
            <Text style={styles.overline}>AVEC {entry.instructor.toUpperCase()}</Text>
          )}
          {entry.type === "soiree" && (
            <Text style={styles.overline}>SOIRÉE MENSUELLE</Text>
          )}
          {isFestival && !!rangeLabel && (
            <Text style={styles.overline}>{rangeLabel.toUpperCase()}</Text>
          )}

          <Text style={styles.title} numberOfLines={2}>
            {entry.title}
          </Text>

          {!!entry.venue && (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color={COLORS.secondaryText} />
              <Text style={styles.metaTxt} numberOfLines={1}>
                {entry.venue}
                {entry.address ? ` · ${entry.address}` : ""}
              </Text>
            </View>
          )}
          {!!entry.time && (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={13} color={COLORS.secondaryText} />
              <Text style={styles.metaTxt}>{entry.time}</Text>
            </View>
          )}

          {!!entry.description && (
            <Text style={styles.desc} numberOfLines={3}>
              {entry.description}
            </Text>
          )}

          <View style={styles.actions}>
            {!!entry.ticket_link && (
              <TouchableOpacity
                testID={`ticket-${entry.id}`}
                style={styles.ticketBtn}
                onPress={() => openLink(entry.ticket_link!)}
              >
                <Ionicons name="ticket-outline" size={14} color={COLORS.primaryText} />
                <Text style={styles.ticketTxt}>ACHETER LE TICKET</Text>
              </TouchableOpacity>
            )}
            {isAdmin && (
              <View style={styles.adminActions}>
                {onAdminEdit && (
                  <TouchableOpacity
                    testID={`edit-entry-${entry.id}`}
                    onPress={onAdminEdit}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="create-outline" size={16} color={COLORS.primaryText} />
                  </TouchableOpacity>
                )}
                {onAdminDelete && (
                  <TouchableOpacity
                    testID={`delete-entry-${entry.id}`}
                    onPress={onAdminDelete}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="trash-outline" size={16} color={COLORS.primaryText} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </View>

      {entry.cover_photo && (
        <Image source={{ uri: entry.cover_photo }} style={styles.cover} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: COLORS.primaryText,
    padding: 16,
    marginBottom: 14,
    backgroundColor: "#fff",
  },
  row: { flexDirection: "row", gap: 16 },
  dateBlock: {
    width: 64,
    alignItems: "center",
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  weekday: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: COLORS.secondaryText,
  },
  day: {
    fontFamily: FONTS.heading,
    fontSize: 34,
    color: COLORS.primaryText,
    lineHeight: 38,
    marginTop: 2,
  },
  month: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: COLORS.primaryText,
    marginTop: 2,
    textTransform: "uppercase",
  },
  festivalBadge: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.accentYellow,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1 },
  overline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: COLORS.secondaryText,
    marginBottom: 6,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    lineHeight: 24,
    color: COLORS.primaryText,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  metaTxt: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.secondaryText,
    flex: 1,
  },
  desc: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.secondaryText,
    marginTop: 10,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    flexWrap: "wrap",
    gap: 8,
  },
  ticketBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.accentYellow,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 40,
  },
  ticketTxt: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.3,
    color: COLORS.primaryText,
  },
  adminActions: { flexDirection: "row", gap: 4, marginLeft: "auto" },
  iconBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 6,
  },
  cover: {
    width: "100%",
    height: 160,
    marginTop: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
  },
});
