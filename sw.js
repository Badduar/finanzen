// ============================================================
//  Service Worker
// ============================================================
//  Legt nur das Geruest der App in den Zwischenspeicher (HTML, CSS, JS,
//  Symbole). Buchungen und Salden kommen IMMER frisch aus dem Netz -
//  eine Finanz-App, die einen veralteten Kontostand zeigt, ist
//  schlimmer als gar keine.
//
//  Die Zahl in CACHE ist die Versionsnummer. Sie MUSS bei jeder
//  Aenderung an einer der Dateien unten hochgezaehlt werden, sonst
//  behalten Geraete, die die App schon installiert haben, den alten
//  Stand.
// ============================================================

const CACHE = "finanzen-v1";

const GERUEST = [
  "./",
  "./index.html",
  "./start.html",
  "./buchungen.html",
  "./erfassen.html",
  "./fixkosten.html",
  "./serie.html",
  "./auswertung.html",
  "./konten.html",
  "./kategorien.html",
  "./manifest.webmanifest",
  "./css/stil.css",
  "./js/auth.js",
  "./js/daten.js",
  "./js/darstellung.js",
  "./js/konfig.js",
  "./js/kuchen.js",
  "./js/navigation.js",
  "./js/pwa.js",
  "./js/serie.js",
  "./js/supabase.js",
  "./icons/symbol.svg",
  "./icons/symbol-maskiert.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // Einzeln, damit eine fehlende Datei nicht die ganze Installation kippt.
      .then((cache) => Promise.allSettled(GERUEST.map((pfad) => cache.add(pfad))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(
        namen.filter((n) => n !== CACHE).map((n) => caches.delete(n)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const anfrage = e.request;
  if (anfrage.method !== "GET") return;

  const adresse = new URL(anfrage.url);

  // Alles, was nicht zur App gehoert - vor allem Supabase und die
  // Bibliothek vom CDN - geht unangetastet ins Netz.
  if (adresse.origin !== self.location.origin) return;

  // Zuerst das Netz fragen, damit Aenderungen sofort ankommen. Nur wenn
  // es nicht erreichbar ist, den Zwischenspeicher nehmen.
  //
  // Wichtig: "no-cache" erzwingt eine Rueckfrage beim Server. Ohne das
  // wuerde dieses fetch selbst aus dem HTTP-Zwischenspeicher des
  // Browsers bedient - "Netz zuerst" waere dann nur dem Namen nach wahr
  // und ein neuer Programmstand kaeme verspaetet an. Unveraenderte
  // Dateien beantwortet der Server weiterhin billig mit 304.
  e.respondWith(
    fetch(anfrage.url, { cache: "no-cache", credentials: "same-origin" })
      .then((antwort) => {
        if (antwort.ok) {
          const kopie = antwort.clone();
          caches.open(CACHE).then((cache) => cache.put(anfrage, kopie));
        }
        return antwort;
      })
      .catch(async () => {
        const gespeichert = await caches.match(anfrage);
        if (gespeichert) return gespeichert;
        if (anfrage.mode === "navigate") {
          const geruest = await caches.match("./start.html");
          if (geruest) return geruest;
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }),
  );
});
