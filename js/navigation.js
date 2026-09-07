// Die Leiste am unteren Rand. Liegt am Daumen, nicht am oberen
// Bildschirmrand - die App wird im Stehen an der Kasse bedient.

const SEITEN = [
  ["start.html",      "Start",     "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5"],
  ["buchungen.html",  "Buchungen", "M4 5h16M4 12h16M4 19h10"],
  ["erfassen.html",   "Erfassen",  "M12 5v14M5 12h14"],
  ["fixkosten.html",  "Fixkosten", "M7 3v3M17 3v3M4 8h16M5 6h14v14H5zM9 13h6"],
  ["auswertung.html", "Auswertung","M12 3a9 9 0 1 0 9 9h-9z M12 3v9h9"],
];

export function navigationZeichnen(aktiv) {
  const leiste = document.createElement("nav");
  leiste.className = "navleiste";
  leiste.setAttribute("aria-label", "Hauptbereiche");

  for (const [ziel, beschriftung, pfad] of SEITEN) {
    const verweis = document.createElement("a");
    verweis.href = ziel;
    if (ziel === aktiv) verweis.setAttribute("aria-current", "page");

    const bild = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bild.setAttribute("viewBox", "0 0 24 24");
    bild.setAttribute("aria-hidden", "true");
    for (const teil of pfad.split(" M").map((p, i) => (i ? "M" + p : p))) {
      const linie = document.createElementNS("http://www.w3.org/2000/svg", "path");
      linie.setAttribute("d", teil);
      bild.appendChild(linie);
    }

    const text = document.createElement("span");
    text.textContent = beschriftung;

    verweis.append(bild, text);
    leiste.appendChild(verweis);
  }

  document.body.appendChild(leiste);
}
