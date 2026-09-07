// Alle Zugriffe auf die Datenbank an einer Stelle.
//
// Gerechnet wird in Postgres (siehe supabase/migrationen/003_sichten.sql).
// Hier steht nur, was geholt und was geschrieben wird.

import { db } from "./supabase.js";
import { heuteAlsText, monatsGrenzen } from "./darstellung.js";

// ------------------------------------------------------------
//  Stammdaten
// ------------------------------------------------------------

export async function konten({ mitArchivierten = false } = {}) {
  let abfrage = db.from("konto")
    .select("id, name, art, farbe, sortierung, archiviert, startsaldo, startdatum")
    .order("sortierung");
  if (!mitArchivierten) abfrage = abfrage.eq("archiviert", false);

  const { data, error } = await abfrage;
  if (error) throw error;
  return data ?? [];
}

export async function kontenMitSaldo() {
  const { data, error } = await db.from("v_kontosaldo")
    .select("konto_id, name, art, farbe, sortierung, archiviert, saldo, startsaldo, startdatum")
    .eq("archiviert", false)
    .order("sortierung");
  if (error) throw error;
  return data ?? [];
}

export async function kategorien({ art = null, nurAktive = true } = {}) {
  let abfrage = db.from("kategorie")
    .select("id, name, art, eltern_id, farbe, sortierung, aktiv")
    .order("sortierung");
  if (art) abfrage = abfrage.eq("art", art);
  if (nurAktive) abfrage = abfrage.eq("aktiv", true);

  const { data, error } = await abfrage;
  if (error) throw error;
  return data ?? [];
}

// Kategorien als Baum: Hauptkategorien mit ihren Unterkategorien.
export function alsBaum(liste) {
  const haupt = liste.filter((k) => !k.eltern_id)
    .map((k) => ({ ...k, kinder: [] }));
  const nachId = new Map(haupt.map((k) => [k.id, k]));
  for (const k of liste) {
    if (k.eltern_id && nachId.has(k.eltern_id)) nachId.get(k.eltern_id).kinder.push(k);
  }
  return haupt;
}

export async function profile() {
  const { data, error } = await db.from("profil").select("id, name, farbe");
  if (error) throw error;
  return data ?? [];
}

// ------------------------------------------------------------
//  Buchungen
// ------------------------------------------------------------

const BUCHUNG_FELDER = `
  id, datum, betrag, art, konto_id, ziel_konto_id, kategorie_id,
  wer, notiz, serie_id, serie_datum, erfasst_von, erstellt_am
`;

export async function buchungen({
  von = null, bis = null, kontoId = null, kategorieId = null,
  suche = null, grenze = 100, versatz = 0, ausPapierkorb = false,
} = {}) {
  let abfrage = db.from("buchung")
    .select(BUCHUNG_FELDER + ", geloescht_am")
    .order("datum", { ascending: false })
    .order("erstellt_am", { ascending: false })
    .range(versatz, versatz + grenze - 1);

  abfrage = ausPapierkorb
    ? abfrage.not("geloescht_am", "is", null)
    : abfrage.is("geloescht_am", null);

  if (von) abfrage = abfrage.gte("datum", von);
  if (bis) abfrage = abfrage.lte("datum", bis);
  if (kontoId) abfrage = abfrage.or(`konto_id.eq.${kontoId},ziel_konto_id.eq.${kontoId}`);
  if (Array.isArray(kategorieId)) abfrage = abfrage.in("kategorie_id", kategorieId);
  else if (kategorieId) abfrage = abfrage.eq("kategorie_id", kategorieId);
  if (suche) abfrage = abfrage.or(`wer.ilike.%${suche}%,notiz.ilike.%${suche}%`);

  const { data, error } = await abfrage;
  if (error) throw error;
  return data ?? [];
}

export async function buchungLaden(id) {
  const { data, error } = await db.from("buchung")
    .select(BUCHUNG_FELDER).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// Wer zuletzt Empfaenger oder Zahler war - als Vorschlagsliste beim
// Erfassen. Spart Tippen bei den immer gleichen Laeden.
export async function empfaengerVorschlaege(grenze = 300) {
  const { data, error } = await db.from("buchung")
    .select("wer")
    .is("geloescht_am", null)
    .not("wer", "is", null)
    .order("datum", { ascending: false })
    .limit(grenze);
  if (error) throw error;

  const gesehen = new Set();
  for (const zeile of data ?? []) {
    const wert = (zeile.wer ?? "").trim();
    if (wert) gesehen.add(wert);
  }
  return [...gesehen].sort((a, b) => a.localeCompare(b, "de"));
}

export async function buchungAnlegen(buchung) {
  const { data: sitzung } = await db.auth.getSession();
  const { data, error } = await db.from("buchung")
    .insert({ ...buchung, erfasst_von: sitzung.session?.user?.id })
    .select(BUCHUNG_FELDER)
    .single();
  if (error) throw error;
  return data;
}

export async function buchungAendern(id, felder) {
  const { data, error } = await db.from("buchung")
    .update(felder).eq("id", id).select(BUCHUNG_FELDER).single();
  if (error) throw error;
  return data;
}

// Nicht wirklich loeschen: bei mehreren Personen soll nichts
// spurlos verschwinden.
export async function buchungInPapierkorb(id) {
  const { error } = await db.from("buchung")
    .update({ geloescht_am: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function buchungZurueckholen(id) {
  const { error } = await db.from("buchung")
    .update({ geloescht_am: null }).eq("id", id);
  if (error) throw error;
}

// ------------------------------------------------------------
//  Serien (Fixkosten)
// ------------------------------------------------------------

const SERIE_FELDER = `
  id, name, betrag, art, rhythmus, intervall, faelligkeitstag,
  beginnt_am, endet_am, konto_id, kategorie_id, wer, notiz, aktiv
`;

export async function serien({ nurAktive = false } = {}) {
  let abfrage = db.from("serie").select(SERIE_FELDER).order("name");
  if (nurAktive) abfrage = abfrage.eq("aktiv", true);
  const { data, error } = await abfrage;
  if (error) throw error;
  return data ?? [];
}

export async function serieAnlegen(serie) {
  const { data: sitzung } = await db.auth.getSession();
  const { data, error } = await db.from("serie")
    .insert({ ...serie, erstellt_von: sitzung.session?.user?.id })
    .select(SERIE_FELDER).single();
  if (error) throw error;
  return data;
}

export async function serieAendern(id, felder) {
  const { data, error } = await db.from("serie")
    .update(felder).eq("id", id).select(SERIE_FELDER).single();
  if (error) throw error;
  return data;
}

export async function serieLoeschen(id) {
  const { error } = await db.from("serie").delete().eq("id", id);
  if (error) throw error;
}

// Offene Faelligkeiten: was laut Regel dran ist oder war und wofuer es
// weder eine Buchung noch eine Ausnahme gibt.
export async function offeneFaelligkeiten({ bis = null } = {}) {
  let abfrage = db.from("v_offene_faelligkeit")
    .select("serie_id, name, betrag, art, konto_id, kategorie_id, wer, faellig_am, ueberfaellig")
    .order("faellig_am");
  if (bis) abfrage = abfrage.lte("faellig_am", bis);

  const { data, error } = await abfrage;
  if (error) throw error;
  return data ?? [];
}

// Ein Vorkommen bestaetigen: daraus wird eine Buchung.
export async function faelligkeitBuchen(faellig, { betrag = null, datum = null } = {}) {
  return buchungAnlegen({
    datum: datum ?? faellig.faellig_am,
    betrag: betrag ?? faellig.betrag,
    art: faellig.art,
    konto_id: faellig.konto_id,
    kategorie_id: faellig.kategorie_id,
    wer: faellig.wer,
    serie_id: faellig.serie_id,
    serie_datum: faellig.faellig_am,
  });
}

// Ein Vorkommen ueberspringen, ohne die Serie anzufassen.
export async function faelligkeitUeberspringen(serieId, faelligAm, bemerkung = null) {
  const { data: sitzung } = await db.auth.getSession();
  const { error } = await db.from("serie_ausnahme").insert({
    serie_id: serieId,
    faellig_am: faelligAm,
    bemerkung,
    erstellt_von: sitzung.session?.user?.id,
  });
  if (error) throw error;
}

// ------------------------------------------------------------
//  Zusammenfassungen fuer den Startbildschirm
// ------------------------------------------------------------

// Einnahmen und Ausgaben eines Monats. Umbuchungen bleiben aussen vor:
// Geld von einem eigenen Konto auf ein anderes ist keine Ausgabe.
export async function monatssumme(datum = heuteAlsText()) {
  const { von, bis } = monatsGrenzen(datum);
  const { data, error } = await db.from("buchung")
    .select("art, betrag")
    .is("geloescht_am", null)
    .gte("datum", von).lte("datum", bis)
    .in("art", ["ausgabe", "einnahme"]);
  if (error) throw error;

  let ausgaben = 0, einnahmen = 0;
  for (const b of data ?? []) {
    if (b.art === "ausgabe") ausgaben += Number(b.betrag);
    else einnahmen += Number(b.betrag);
  }
  return { von, bis, ausgaben, einnahmen };
}

// Wie sich eine Hauptkategorie auf ihre Unterkategorien verteilt -
// das ist die Ansicht nach dem Antippen eines Tortenstuecks.
export async function verteilungInKategorie({ von, bis, hauptId, art = "ausgabe" }) {
  const alle = await kategorien({ art, nurAktive: false });
  const kinder = alle.filter((k) => k.eltern_id === hauptId);
  const eigene = [hauptId, ...kinder.map((k) => k.id)];

  const { data, error } = await db.from("buchung")
    .select("betrag, kategorie_id")
    .is("geloescht_am", null)
    .eq("art", art)
    .in("kategorie_id", eigene)
    .gte("datum", von).lte("datum", bis);
  if (error) throw error;

  const nameVon = new Map(alle.map((k) => [k.id, k.name]));
  const summen = new Map();
  for (const b of data ?? []) {
    summen.set(b.kategorie_id, (summen.get(b.kategorie_id) ?? 0) + Number(b.betrag));
  }

  return [...summen.entries()].map(([id, summe]) => ({
    id,
    name: id === hauptId ? "Ohne Unterkategorie" : (nameVon.get(id) ?? "Unbekannt"),
    summe,
  })).sort((a, b) => b.summe - a.summe);
}

// Verteilung auf die Hauptkategorien - die Grundlage des Kuchendiagramms.
// Unterkategorien werden ihrer Hauptkategorie zugeschlagen.
export async function verteilungNachKategorie({ von, bis, art = "ausgabe" }) {
  const [liste, alle] = await Promise.all([
    db.from("buchung")
      .select("betrag, kategorie_id")
      .is("geloescht_am", null)
      .eq("art", art)
      .gte("datum", von).lte("datum", bis),
    kategorien({ art, nurAktive: false }),
  ]);
  if (liste.error) throw liste.error;

  const elternVon = new Map(alle.map((k) => [k.id, k.eltern_id ?? k.id]));
  const infoVon = new Map(alle.map((k) => [k.id, k]));

  const summen = new Map();
  let ohne = 0;
  for (const b of liste.data ?? []) {
    if (!b.kategorie_id) { ohne += Number(b.betrag); continue; }
    const haupt = elternVon.get(b.kategorie_id) ?? b.kategorie_id;
    summen.set(haupt, (summen.get(haupt) ?? 0) + Number(b.betrag));
  }

  const stuecke = [...summen.entries()].map(([id, summe]) => ({
    id,
    name: infoVon.get(id)?.name ?? "Unbekannt",
    farbe: infoVon.get(id)?.farbe ?? "#71717a",
    summe,
  })).sort((a, b) => b.summe - a.summe);

  if (ohne > 0) {
    stuecke.push({ id: null, name: "Ohne Kategorie", farbe: "#9aa4a6", summe: ohne });
  }
  return stuecke;
}
