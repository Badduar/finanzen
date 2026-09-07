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

// Farben fuer die Kuchendiagramme: acht Werte je Modus, in fester
// Reihenfolge. Sie sind darauf geprueft, dass benachbarte Stuecke auch
// bei Rot-Gruen-Schwaeche unterscheidbar bleiben - eigene Farben nach
// Gefuehl bestehen diese Pruefung nicht.
//
// Mehr als acht Stuecke gibt es nie: alles Weitere faellt in ein
// neutrales Sammelstueck. Ein Kuchen mit sechzehn Stuecken ist
// unlesbar, egal wie gut die Farben sind.
export const DIAGRAMM_FARBEN = [
  { hell: "#2a78d6", dunkel: "#3987e5" },  // blau
  { hell: "#eb6834", dunkel: "#d95926" },  // orange
  { hell: "#1baf7a", dunkel: "#199e70" },  // aqua
  { hell: "#eda100", dunkel: "#c98500" },  // gelb
  { hell: "#e87ba4", dunkel: "#d55181" },  // magenta
  { hell: "#008300", dunkel: "#008300" },  // gruen
  { hell: "#4a3aa7", dunkel: "#9085e9" },  // violett
  { hell: "#e34948", dunkel: "#e66767" },  // rot
];

export const DIAGRAMM_SAMMEL = { hell: "#8a8a80", dunkel: "#9c9c92" };
