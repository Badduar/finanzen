// Zahlen und Daten so aufbereiten, wie man sie hier liest.

import { WAEHRUNG, ZEITZONE } from "./konfig.js";

const GELD = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: WAEHRUNG,
  minimumFractionDigits: 2,
});

const GELD_OHNE_ZEICHEN = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const TAG_KURZ  = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" });
const TAG_LANG  = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short" });
const MONAT     = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });
const TAG_VOLL  = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export function euro(betrag) {
  return GELD.format(Number(betrag ?? 0));
}

// Mit Vorzeichen: Ausgaben mit Minus, Einnahmen mit Plus. Fuer Listen,
// in denen beides untereinander steht.
export function euroMitZeichen(betrag, art) {
  const zahl = Number(betrag ?? 0);
  if (art === "ausgabe")  return "−" + GELD.format(zahl);
  if (art === "einnahme") return "+" + GELD.format(zahl);
  return GELD.format(zahl);
}

// Fuer Eingabefelder: 1234.5 wird zu "1.234,50".
export function betragFuerFeld(betrag) {
  if (betrag === null || betrag === undefined || betrag === "") return "";
  return GELD_OHNE_ZEICHEN.format(Number(betrag));
}

// Aus "1.234,56" oder "1234,56" oder "1234.56" wird 1234.56.
// Gibt null zurueck, wenn nichts Brauchbares drinsteht.
export function betragAusFeld(text) {
  const roh = String(text ?? "").trim().replace(/[\s€]/g, "");
  if (!roh) return null;
  // Deutsches Format: Punkt ist Tausendertrenner, Komma das Dezimalzeichen.
  const bereinigt = roh.includes(",")
    ? roh.replace(/\./g, "").replace(",", ".")
    : roh;
  const zahl = Number(bereinigt);
  if (!Number.isFinite(zahl)) return null;
  return Math.round(zahl * 100) / 100;
}

// Datumsangaben sind reine Tage (date in der Datenbank, "2026-09-07").
// Sie werden bewusst nicht durch die Zeitzone gedreht.
export function heuteAlsText() {
  const jetzt = new Date();
  const teile = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZEITZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(jetzt);
  const hole = (art) => teile.find((t) => t.type === art).value;
  return `${hole("year")}-${hole("month")}-${hole("day")}`;
}

function alsDatum(text) {
  const [j, m, t] = String(text).split("-").map(Number);
  return new Date(j, m - 1, t);
}

export function tagKurz(text)  { return TAG_KURZ.format(alsDatum(text)); }

// Wie tagKurz, haengt aber das Jahr an, sobald es nicht das laufende ist.
// Bei einer Jahresrechnung waere "05.01." sonst mehrdeutig.
export function tagKurzMitJahr(text) {
  const jahr = String(text).slice(0, 4);
  return jahr === heuteAlsText().slice(0, 4)
    ? tagKurz(text)
    : `${tagKurz(text)}${jahr}`;
}
export function tagLang(text)  { return TAG_LANG.format(alsDatum(text)); }

// Mit Jahreszahl - fuer Listen, die ueber Jahresgrenzen laufen. Eine
// jaehrliche Serie zeigt sonst vier Mal denselben Tag ohne Unterschied.
export function tagVoll(text)  { return TAG_VOLL.format(alsDatum(text)); }
export function monatName(text) { return MONAT.format(alsDatum(text)); }

// "heute", "gestern", "in 3 Tagen", "seit 5 Tagen" - fuer Faelligkeiten.
export function tageText(datumText) {
  const tage = tageBis(datumText);
  if (tage === 0)  return "heute";
  if (tage === 1)  return "morgen";
  if (tage === -1) return "gestern";
  if (tage > 1)    return `in ${tage} Tagen`;
  return `seit ${Math.abs(tage)} Tagen`;
}

export function tageBis(datumText) {
  const heute = alsDatum(heuteAlsText());
  const ziel = alsDatum(datumText);
  return Math.round((ziel - heute) / 86400000);
}

// Erster und letzter Tag des Monats, in dem das Datum liegt.
export function monatsGrenzen(datumText = heuteAlsText()) {
  const [j, m] = String(datumText).split("-").map(Number);
  const zwei = (n) => String(n).padStart(2, "0");
  const letzter = new Date(j, m, 0).getDate();
  return { von: `${j}-${zwei(m)}-01`, bis: `${j}-${zwei(m)}-${zwei(letzter)}` };
}

// Text sicher in ein Element schreiben. Kuerzer als jedes Mal
// textContent zu setzen und verhindert versehentliches innerHTML.
export function setzeText(element, text) {
  if (element) element.textContent = text ?? "";
}
