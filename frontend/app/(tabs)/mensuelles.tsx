import React from "react";
import { Text } from "react-native";
import EntriesScreen from "../../src/EntriesScreen";
import SubmitEntryButton from "../../src/SubmitEntryButton";
import { COLORS, FONTS } from "../../src/theme";

export default function Mensuelles() {
  return (
    <EntriesScreen
      type="mensuelle"
      overline="LES RENDEZ-VOUS MENSUELS"
      headline={
        <>
          Les{" "}
          <Text
            style={{
              fontFamily: FONTS.headingItalic,
              fontStyle: "italic",
              color: COLORS.accentYellow,
            }}
          >
            mensuelles.
          </Text>
        </>
      }
      subtitle="Les soirées récurrentes de la communauté Paris Cuban Salsa. Notez les dates — elles reviennent chaque mois."
      headerExtra={<SubmitEntryButton type="mensuelle" />}
      showDanceStyleFilter
    />
  );
}
