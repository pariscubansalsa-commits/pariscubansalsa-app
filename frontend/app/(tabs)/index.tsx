import React from "react";
import { Text } from "react-native";
import EntriesScreen from "../../src/EntriesScreen";
import { COLORS, FONTS } from "../../src/theme";

export default function Index() {
  return (
    <EntriesScreen
      overline="SORTIES DU MOMENT"
      showFeatured
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
      subtitle="L'agenda vivant de Paris Cuban Salsa. Soirées, workshops, festivals — tout ce qui bouge cette semaine et les suivantes."
      handleAuthCallback
    />
  );
}
