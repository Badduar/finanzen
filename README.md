# Finanzen

Gemeinsame Haushaltskasse für mehrere Personen: Fixkosten mit tagesgenauer
Fälligkeit, laufende Einnahmen und Ausgaben, Salden je Konto und eine
Auswertung mit Kuchendiagrammen.

Läuft als installierbare Web-App (PWA) ohne Build-Schritt: reines HTML, CSS
und JavaScript in ES-Modulen, gehostet auf GitHub Pages. Die Daten liegen in
Supabase (Postgres mit Row Level Security).

## Aufbau

```
index.html              Anmelden und Registrieren
start.html              Salden, Vorschau aufs Monatsende, fällige Fixkosten
buchungen.html          Liste mit Filtern, Suche und Papierkorb
erfassen.html           Ausgabe, Einnahme, Umbuchung – anlegen und ändern
fixkosten.html          Übersicht der Serien
serie.html              eine Serie anlegen oder ändern
auswertung.html         Kuchendiagramme für Ausgaben, Einnahmen, Fixkosten
konten.html             Konten verwalten, Startsaldo eintragen
kategorien.html         Kategorien in zwei Ebenen verwalten

css/stil.css            gemeinsames Stylesheet
js/konfig.js            Supabase-Zugang, Farben, feste Einstellungen
js/supabase.js          der gemeinsame Datenbank-Client
js/auth.js              Anmelden, Registrieren, eigenes Profil
js/daten.js             alle Datenbankzugriffe an einer Stelle
js/darstellung.js       Beträge, Datumsangaben, Prozente auf Deutsch
js/serie.js             Fälligkeiten einer Serie im Browser rechnen
js/kuchen.js            das Kuchendiagramm als SVG
js/navigation.js        die Leiste am unteren Rand
js/pwa.js               meldet den Service Worker an

sw.js                   Service Worker – Versionsnummer beachten!
manifest.webmanifest    macht die App installierbar
testserver.py           lokaler Testserver ohne Zwischenspeicher

supabase/migrationen/   nummerierte SQL-Migrationen
supabase/funktionen/    Edge Functions (TypeScript)
```

## Grundgedanken

**Ein gemeinsamer Datenraum.** Wer freigeschaltet ist, sieht alle Konten,
Buchungen und Fixkosten. In jeder Buchung steht, wer sie erfasst hat.

**Beträge sind immer positiv.** Ob Geld kommt oder geht, sagt die Spalte
`art`. Ein Minus im Betrag wäre eine zweite, stille Quelle für dieselbe
Information.

**Der Saldo wird gerechnet, nie fortgeschrieben.** Startsaldo plus alle
Buchungen seit dem Startdatum. Damit stimmt er auch dann noch, wenn eine
alte Buchung nachträglich geändert wird.

**Fixkosten werden vorgelegt, nicht gebucht.** Fällige Serien erscheinen auf
dem Startbildschirm als offen; erst ein Tipp macht eine Buchung daraus. So
entspricht der angezeigte Saldo dem echten Kontostand. Fällige Termine
stehen nicht in der Datenbank, sondern werden aus der Regel gerechnet.

**Eine Umbuchung ist eine Zeile mit zwei Konten**, nicht zwei verknüpfte
Zeilen: so kann sie nicht halb geändert oder halb gelöscht werden. In der
Auswertung bleibt sie außen vor, sonst zählte derselbe Euro zweimal.

**Gelöschtes wandert in den Papierkorb** (`geloescht_am`) statt sofort zu
verschwinden. Bei mehreren Personen soll nichts spurlos weg sein.

**Die Fälligkeitsrechnung steht zweimal da** – in `intern.faelligkeiten()`
für den Betrieb und in `js/serie.js` für die Vorschau im Formular, die schon
greifen muss, bevor die Serie gespeichert ist. Wer die eine ändert, muss die
andere mitziehen. Beide sind gegeneinander geprüft, auch für den 29. Februar
und den 31. in kurzen Monaten.

## Entwickeln

Lokal starten mit `python testserver.py`. Der eingebaute `http.server` lässt
Browser die JS-Module zwischenspeichern; Änderungen bleiben dann scheinbar
wirkungslos und man sucht Fehler, die längst behoben sind. `testserver.py`
schickt deshalb `no-store` mit. Der Service Worker meldet sich auf
`localhost` bewusst nicht an – aus demselben Grund.

**Nach jeder Änderung an einer Datei aus `GERUEST` in `sw.js` die
Versionsnummer dort hochzählen.** Sonst behalten Geräte, auf denen die App
schon installiert ist, den alten Stand.

### Testkonten

Testkonten bekommen Adressen auf `example.com` – laut RFC 2606 für Tests
reserviert, ein echtes Profil kann so eine Adresse nicht haben. Aufgeräumt
wird ausschließlich gezielt:

```sql
delete from auth.users where email like '%@example.com';
```

Niemals `delete from auth.users` ohne Bedingung: das trifft alle Konten, und
daran hängt per Kaskade alles – Profile, Buchungen, Serien, angemeldete
Geräte.

## Datenbank neu aufsetzen

Die Migrationen in `supabase/migrationen/` der Reihe nach im SQL-Editor
einspielen. Danach die Edge Function `registrieren` mit
`verify_jwt = false` bereitstellen.

Konten und Kategorien sind Daten, keine Struktur — sie stehen bewusst
nicht im Repository und werden in der App angelegt.

## Einladungscodes

Ein Konto entsteht nur über die Edge Function `registrieren`, und die
verlangt einen gültigen Einladungscode. Wer auf anderem Weg ein Konto
anlegt, bekommt ein Profil ohne Freischaltung: es sieht nichts.

Codes stehen **nie** im Repository — dieses hier ist öffentlich. Sie werden
von Hand im SQL-Editor angelegt:

```sql
insert into public.einladungscode (code, max_nutzungen, bemerkung)
values ('AUSGEDACHTER-CODE', 2, 'Wofür der Code ist');
```

Nachsehen und sperren:

```sql
select code, aktiv, benutzt, max_nutzungen, bemerkung from public.einladungscode;
update public.einladungscode set aktiv = false where code = '...';
```
