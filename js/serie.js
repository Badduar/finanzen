// Faelligkeiten einer Serie im Browser ausrechnen.
//
// Dieselbe Regel steckt in intern.faelligkeiten() in der Datenbank
// (supabase/migrationen/003_sichten.sql). Dort ist sie massgeblich - hier
// steht sie noch einmal, damit die Vorschau im Formular schon greift,
// bevor die Serie gespeichert ist. Wer die eine aendert, muss die andere
// mitziehen.

import { RHYTHMEN } from "./konfig.js";
import { heuteAlsText } from "./darstellung.js";

const MONATE_JE_RHYTHMUS = Object.fromEntries(
  RHYTHMEN.map(([schluessel, , monate]) => [schluessel, monate]),
);

function zwei(zahl) {
  return String(zahl).padStart(2, "0");
}

function alsText(jahr, monat, tag) {
  return `${jahr}-${zwei(monat)}-${zwei(tag)}`;
}

function letzterTagImMonat(jahr, monat) {
  return new Date(jahr, monat, 0).getDate();
}

// Die naechsten Faelligkeiten ab einem Stichtag. Gibt Datumstexte
// im Format 2026-09-07 zurueck.
export function naechsteFaelligkeiten(regel, anzahl = 4, ab = heuteAlsText()) {
  const {
    rhythmus, intervall = 1, faelligkeitstag = 1,
    beginnt_am: beginnt, endet_am: endet,
  } = regel;

  if (!rhythmus || !beginnt) return [];

  const treffer = [];
  const grenze = (wert) => (!endet || wert <= endet);

  if (rhythmus === "woechentlich") {
    const [j, m, t] = beginnt.split("-").map(Number);
    const lauf = new Date(j, m - 1, t);
    // Hoechstens fuenf Jahre weit suchen, damit eine unsinnige Regel
    // die Schleife nicht endlos laufen laesst.
    for (let i = 0; i < 261 && treffer.length < anzahl; i++) {
      const wert = alsText(lauf.getFullYear(), lauf.getMonth() + 1, lauf.getDate());
      if (wert >= ab && grenze(wert)) treffer.push(wert);
      if (endet && wert > endet) break;
      lauf.setDate(lauf.getDate() + intervall * 7);
    }
    return treffer;
  }

  const schritt = (MONATE_JE_RHYTHMUS[rhythmus] || 1) * intervall;
  const [startJahr, startMonat] = beginnt.split("-").map(Number);

  let jahr = startJahr;
  let monat = startMonat;
  for (let i = 0; i < 240 && treffer.length < anzahl; i++) {
    // Der 31. rutscht in kurzen Monaten auf den Monatsletzten.
    const tag = Math.min(faelligkeitstag, letzterTagImMonat(jahr, monat));
    const wert = alsText(jahr, monat, tag);
    if (wert >= beginnt && wert >= ab && grenze(wert)) treffer.push(wert);
    if (endet && wert > endet) break;

    monat += schritt;
    while (monat > 12) { monat -= 12; jahr += 1; }
  }
  return treffer;
}

// Was die Serie im Schnitt je Monat kostet - damit sich Posten mit
// verschiedenen Rhythmen vergleichen lassen.
export function monatsbetrag({ betrag, rhythmus, intervall = 1 }) {
  const wert = Number(betrag ?? 0);
  if (rhythmus === "woechentlich") return (wert * 52) / 12 / intervall;
  const monate = (MONATE_JE_RHYTHMUS[rhythmus] || 1) * intervall;
  return wert / monate;
}

// "monatlich" oder "alle 2 Monate", "vierteljährlich" ...
export function rhythmusText({ rhythmus, intervall = 1 }) {
  const eintrag = RHYTHMEN.find(([schluessel]) => schluessel === rhythmus);
  const name = eintrag ? eintrag[1] : rhythmus;
  if (intervall === 1) return name;
  return rhythmus === "woechentlich"
    ? `alle ${intervall} Wochen`
    : `alle ${intervall} × ${name}`;
}
