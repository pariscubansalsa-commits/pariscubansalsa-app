import React from "react";
import { Text } from "react-native";
import EntriesScreen from "../../src/EntriesScreen";
import { COLORS, FONTS } from "../../src/theme";

export default function Index() {
  return (
    <EntriesScreen
      overline="SORTIES DU MOMENT"
      showFeatured
      useCalendar
      headline={
        <>
          Le mois{" "}
          <Text
            style={{
              fontFamily: FONTS.headingItalic,
              fontStyle: "italic",
              color: COLORS.accentYellow,
            }}
          >
            salsa.
          </Text>
        </>
      }
      subtitle="L'agenda vivant synchronisé depuis notre Google Calendar. Soirées, workshops, festivals — actualisé toutes les 10 minutes."
      handleAuthCallback
    />
  );
}
