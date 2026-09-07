// Meldet den Service Worker an, damit die App installierbar ist und
// ohne Netz wenigstens ihr Geruest zeigt.
//
// Beim lokalen Ausprobieren bleibt er aus: sonst haelt er alte Dateien
// fest und man sucht Fehler, die man laengst behoben hat.

const OERTLICH = ["localhost", "127.0.0.1"].includes(location.hostname);

if ("serviceWorker" in navigator && !OERTLICH) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Ohne Service Worker laeuft die App genauso, nur eben nicht offline.
    });
  });
}
