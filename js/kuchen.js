// Kuchendiagramm als Ring, von Hand in SVG gezeichnet.
//
// Als Ring und nicht als voller Kreis, weil in der Mitte die Summe steht -
// und weil sich Flaechen am Rand besser vergleichen lassen als Keile,
// die alle in einem Punkt zusammenlaufen.
//
// Jedes Stueck ist ein Kreisbogen mit stroke-dasharray. Zwischen den
// Stuecken bleibt eine kleine Luecke in Hintergrundfarbe: ohne sie
// verschwimmen zwei aehnliche Farben zu einer Flaeche.

import { DIAGRAMM_FARBEN, DIAGRAMM_SAMMEL } from "./konfig.js";

const NS = "http://www.w3.org/2000/svg";

const RADIUS = 78;
const DICKE = 26;
const UMFANG = 2 * Math.PI * RADIUS;
const LUECKE = 3;          // in Umfangseinheiten
const HOECHSTZAHL = 8;     // mehr Stuecke sind nicht mehr zu unterscheiden

function dunkelModus() {
  const gesetzt = document.documentElement.dataset.theme;
  if (gesetzt === "dark") return true;
  if (gesetzt === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Farbe eines Stuecks nach seinem Platz in der festen Reihenfolge.
export function stueckFarbe(platz) {
  const paar = platz === null || platz >= DIAGRAMM_FARBEN.length
    ? DIAGRAMM_SAMMEL
    : DIAGRAMM_FARBEN[platz];
  return dunkelModus() ? paar.dunkel : paar.hell;
}

// Aus beliebig vielen Posten hoechstens acht Stuecke machen: die
// groessten einzeln, der Rest als ein Sammelstueck. Die Reihenfolge der
// Farben haengt am Platz, nicht am Betrag - so behaelt eine Kategorie
// ihre Farbe, wenn man den Monat wechselt.
export function stueckeBilden(posten, plaetze) {
  const sortiert = [...posten].sort((a, b) => b.summe - a.summe);
  const einzeln = [];
  let sammel = 0;

  for (const p of sortiert) {
    const platz = plaetze.get(p.id);
    if (platz !== undefined && platz < HOECHSTZAHL && einzeln.length < HOECHSTZAHL) {
      einzeln.push({ ...p, farbe: stueckFarbe(platz) });
    } else {
      sammel += p.summe;
    }
  }

  if (sammel > 0) {
    einzeln.push({ id: null, name: "Weitere", summe: sammel, farbe: stueckFarbe(null) });
  }
  return einzeln.sort((a, b) => b.summe - a.summe);
}

export function kuchenZeichnen(svg, stuecke, { beiAuswahl } = {}) {
  svg.textContent = "";
  svg.setAttribute("viewBox", "0 0 200 200");

  const summe = stuecke.reduce((s, st) => s + st.summe, 0);
  if (summe <= 0) return;

  const grund = document.createElementNS(NS, "circle");
  grund.setAttribute("cx", "100");
  grund.setAttribute("cy", "100");
  grund.setAttribute("r", String(RADIUS));
  grund.setAttribute("fill", "none");
  grund.setAttribute("stroke", "var(--flaeche-2)");
  grund.setAttribute("stroke-width", String(DICKE));
  svg.appendChild(grund);

  let gelaufen = 0;
  stuecke.forEach((stueck, i) => {
    const anteil = stueck.summe / summe;
    const laenge = Math.max(anteil * UMFANG - LUECKE, 1);

    const bogen = document.createElementNS(NS, "circle");
    bogen.setAttribute("cx", "100");
    bogen.setAttribute("cy", "100");
    bogen.setAttribute("r", String(RADIUS));
    bogen.setAttribute("fill", "none");
    bogen.setAttribute("stroke", stueck.farbe);
    bogen.setAttribute("stroke-width", String(DICKE));
    bogen.setAttribute("stroke-dasharray", `${laenge} ${UMFANG - laenge}`);
    bogen.setAttribute("stroke-dashoffset", String(-gelaufen * UMFANG));
    // Bei zwoelf Uhr beginnen statt bei drei.
    bogen.setAttribute("transform", "rotate(-90 100 100)");
    bogen.dataset.platz = String(i);

    if (beiAuswahl) {
      bogen.style.cursor = "pointer";
      bogen.addEventListener("click", () => beiAuswahl(stueck, i));
      bogen.addEventListener("mouseenter", () => beiAuswahl(stueck, i, true));
    }

    const titel = document.createElementNS(NS, "title");
    titel.textContent = `${stueck.name}: ${Math.round(anteil * 100)} %`;
    bogen.appendChild(titel);

    svg.appendChild(bogen);
    gelaufen += anteil;
  });
}

// Hebt ein Stueck hervor, indem alle anderen zuruecktreten.
export function stueckHervorheben(svg, platz) {
  for (const bogen of svg.querySelectorAll("circle[data-platz]")) {
    const dieses = Number(bogen.dataset.platz) === platz;
    bogen.style.opacity = platz === null || dieses ? "1" : "0.35";
  }
}
