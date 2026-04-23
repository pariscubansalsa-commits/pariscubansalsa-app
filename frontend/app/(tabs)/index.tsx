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
      subtitle="L'agenda vivant de la communauté Paris Cuban Salsa — soirées, workshops, festivals. Actualisé en permanence."
      handleAuthCallback
    />
  );
}
