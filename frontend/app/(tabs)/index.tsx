import React from "react";
import { Text } from "react-native";
import EntriesScreen from "../../src/EntriesScreen";
import SubmitEntryButton from "../../src/SubmitEntryButton";
import { COLORS, FONTS } from "../../src/theme";

export default function Index() {
  return (
    <EntriesScreen
      overline="SORTIES DU MOMENT"
      showFeatured
      useCalendar
      headline={
        <>
          Les soirées{" "}
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
      showDanceStyleFilter
      headerExtra={<SubmitEntryButton type="agenda" customLabel="+ PROPOSER UN EVENT" />}
    />
  );
}
