/**
 * Travel deep links for festival detail pages — Skyscanner / SNCF Connect /
 * Ouigo / Booking.com. URLs are built dynamically from a festival's
 * (venue, country, date, end_date) tuple; no DB schema change needed.
 */

// ────────────────────────────────────────────────────────────────────────────
// Airport / city codes for Skyscanner (lowercase, 3–4 char). When a city is
// not in this table we fall back to the open-search query URL.
// ────────────────────────────────────────────────────────────────────────────
const SKYSCANNER_CITY_CODES: Record<string, string> = {
  // FR
  paris: "pari",
  // ES
  barcelone: "bcn",
  barcelona: "bcn",
  bilbao: "bio",
  benidorm: "alc", // nearest = Alicante
  tenerife: "tfs",
  "santa susanna": "bcn", // nearest = Barcelona
  saragosse: "zaz",
  // DE
  berlin: "berl",
  francfort: "fra",
  frankfurt: "fra",
  koblenz: "fra", // nearest large airport
  stuttgart: "str",
  dortmund: "dtm",
  augsbourg: "muc", // nearest = Munich
  "brême": "brme",
  breme: "brme",
  bremen: "brme",
  saarbrücken: "scn",
  saarbrucken: "scn",
  // PT
  lisbonne: "lis",
  lisbon: "lis",
  // HR
  rovinj: "puy", // nearest = Pula
  pula: "puy",
  osijek: "osi",
  // PL
  varsovie: "waw",
  warsaw: "waw",
  cracovie: "krk",
  krakow: "krk",
  wieliczka: "krk", // nearest = Krakow
  // DK
  horsens: "bll", // nearest = Billund
  jelling: "bll",
  bosei: "cph", // nearest = Copenhagen
  // GR
  kalogria: "atho", // search Athens region
  thessalonique: "skg",
  thessaloniki: "skg",
  // NO
  oslo: "osl",
  kristiansand: "krs",
  tromsø: "tos",
  tromso: "tos",
  // US
  miami: "mia",
  "new york": "nyca",
  // UK
  liverpool: "lpl",
  birmingham: "bhx",
  // CA
  ottawa: "yow",
  // TN
  monastir: "moa",
  // AT
  vienne: "vie",
  vienna: "vie",
  // SE
  stockholm: "sto",
  // RS
  belgrade: "beg",
  // HU
  budapest: "bud",
  // SK
  bratislava: "bts",
  // ID
  bali: "dps",
  // NL
  ede: "ams", // nearest = Amsterdam
  // CU
  "la havane": "hav",
  havana: "hav",
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Add 1 day to an ISO date (YYYY-MM-DD). */
function plusDays(iso: string, n: number): string {
  if (!iso) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// Skyscanner uses date format YYMMDD in its URL path (e.g. 260622 = 2026-06-22).
function shortDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${y.slice(2)}${m}${d}`;
}

// ────────────────────────────────────────────────────────────────────────────
// URL builders
// ────────────────────────────────────────────────────────────────────────────

export function buildSkyscannerUrl(
  destinationCity: string | null | undefined,
  startDate: string,
  endDate: string | null | undefined
): string {
  const departIso = startDate ? plusDays(startDate, -1) : "";
  const returnIso = endDate ? plusDays(endDate, 1) : startDate ? plusDays(startDate, 1) : "";

  const cityKey = normalize(destinationCity || "");
  const code = SKYSCANNER_CITY_CODES[cityKey];

  if (code && departIso && returnIso) {
    return `https://www.skyscanner.fr/transport/vols/pari/${code}/${shortDate(departIso)}/${shortDate(returnIso)}/`;
  }
  // Fallback: open search with city name
  const q = encodeURIComponent(destinationCity || "");
  return `https://www.skyscanner.fr/transport/vols/pari/?query=${q}`;
}

export function buildSncfConnectUrl(
  city: string | null | undefined,
  startDate: string
): string {
  const departIso = startDate ? plusDays(startDate, -1) : "";
  const dest = encodeURIComponent(city || "");
  // SNCF Connect uses ISO date with time component, but accepts plain YYYY-MM-DD.
  return `https://www.sncf-connect.com/app/home/search?destination=${dest}&outwardDate=${departIso}`;
}

export function buildOuigoUrl(
  city: string | null | undefined,
  startDate: string
): string {
  const departIso = startDate ? plusDays(startDate, -1) : "";
  const dest = encodeURIComponent(city || "");
  return `https://www.ouigo.com/recherche?destination=${dest}&outwardDate=${departIso}`;
}

export function buildBookingUrl(
  city: string | null | undefined,
  country: string | null | undefined,
  startDate: string,
  endDate: string | null | undefined
): string {
  const checkin = startDate ? plusDays(startDate, -1) : "";
  const checkout = endDate ? plusDays(endDate, 1) : startDate ? plusDays(startDate, 1) : "";
  const ss = encodeURIComponent(
    [city, country].filter(Boolean).join(" ")
  );
  return `https://www.booking.com/searchresults.fr.html?ss=${ss}&checkin=${checkin}&checkout=${checkout}&group_adults=1`;
}

export function isFranceFestival(country?: string | null): boolean {
  if (!country) return false;
  return normalize(country) === "france";
}
