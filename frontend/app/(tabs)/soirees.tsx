import React from "react";
import { Text } from "react-native";
import EntriesScreen from "../../src/EntriesScreen";
import SubmitEntryButton from "../../src/SubmitEntryButton";
import { COLORS, FONTS } from "../../src/theme";

export default function Soirees() {
  return (
    <EntriesScreen
      type="soiree"
      overline="SOIRÉES RÉCURRENTES"
      headline={
        <>
          Nos{" "}
          <Text
            style={{
              fontFamily: FONTS.headingItalic,
              fontStyle: "italic",
              color: COLORS.accentYellow,
            }}
          >
            soirées.
          </Text>
        </>
      }
      subtitle="Les rendez-vous mensuels incontournables — Callesol, Cabeza Loca, CUBAILA & Cie."
      headerExtra={<SubmitEntryButton type="soiree" />}
    />
  );
}
