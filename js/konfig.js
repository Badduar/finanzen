// Zentrale Einstellungen.
//
// Der Schluessel unten ist der oeffentliche "publishable key". Er darf im
// Quelltext stehen: Was damit sichtbar wird, entscheidet allein die
// Row Level Security in der Datenbank. Der "service_role"-Schluessel
// gehoert dagegen NIEMALS hierher.

export const SUPABASE_URL = "https://gmoktjxtdjonlfbhyoxe.supabase.co";
export const SUPABASE_KEY = "sb_publishable_C6jjXA8B5HNyIdPZHxolZQ_atm5Xzpk";

export const ZEITZONE = "Europe/Berlin";
export const WAEHRUNG = "EUR";

export const STANDARD_FARBE = "#1e6b70";

// Auswahl fuer Profil-, Konto- und Kategoriefarben.
// Alle Werte mitteldunkel, damit weisse Schrift darauf lesbar bleibt.
export const FARBPALETTE = [
  "#1e6b70", "#1565a0", "#2e7d32", "#6d8c3a",
  "#4a5b8c", "#7b4fa0", "#b23a86", "#b03a5b",
  "#c2410c", "#d97706", "#a0522d", "#8a6d3b",
  "#0e8a8a", "#3f7d5c", "#5b6470", "#71717a",
];

// Kontoarten, wie sie in der Datenbank stehen, mit ihrer Beschriftung.
export const KONTOARTEN = [
  ["giro",        "Girokonto"],
  ["bar",         "Bargeld"],
  ["spar",        "Sparkonto / Tagesgeld"],
  ["kreditkarte", "Kreditkarte"],
  ["depot",       "Depot"],
];

// Rhythmen einer Serie. Der dritte Wert ist der Schritt in Monaten,
// 0 steht fuer die woechentliche Serie - die zaehlt in Wochen.
export const RHYTHMEN = [
  ["woechentlich",  "wöchentlich",   0],
  ["monatlich",     "monatlich",     1],
  ["quartal",       "vierteljährlich", 3],
  ["halbjaehrlich", "halbjährlich",  6],
  ["jaehrlich",     "jährlich",     12],
];

// Wie weit die Startseite in die Zukunft schaut.
export const VORSCHAU_TAGE = 7;
