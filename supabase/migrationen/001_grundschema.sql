-- ============================================================
--  Finanzen - Grundschema, Rechte und Sichtbarkeit
-- ============================================================
--  Ein gemeinsamer Datenraum: wer freigeschaltet ist, sieht alle
--  Konten, Buchungen und Fixkosten. Wer die Buchung erfasst hat,
--  steht in erfasst_von.
--
--  Betraege sind numeric(12,2) - niemals float. Ein Cent, der beim
--  Runden verschwindet, faellt in einer Finanz-App sofort auf.
--
--  Betraege sind immer positiv. Ob Geld kommt oder geht, sagt die
--  Spalte "art". Ein Minus im Betrag waere eine zweite, stille
--  Quelle fuer dieselbe Information - und damit eine Fehlerquelle.
--
--  auth.uid() steht in den Policies bewusst als "(select auth.uid())":
--  so wertet Postgres es einmal je Abfrage aus statt einmal je Zeile.
-- ============================================================

create extension if not exists pgcrypto;

-- Hilfsfunktionen, die RLS umgehen muessen, liegen getrennt vom
-- oeffentlichen Schema. Damit taucht nichts davon in der API auf.
create schema if not exists intern;
revoke all on schema intern from anon, authenticated;
grant usage on schema intern to authenticated;

-- ------------------------------------------------------------
--  Tabellen
-- ------------------------------------------------------------

-- Ein Profil je Benutzerkonto. Wird per Trigger automatisch angelegt.
-- freigeschaltet setzt allein die Edge Function "registrieren".
create table if not exists public.profil (
  id             uuid primary key references auth.users (id) on delete cascade,
  name           text not null check (length(btrim(name)) between 1 and 60),
  farbe          text not null default '#1e6b70' check (farbe ~ '^#[0-9a-fA-F]{6}$'),
  freigeschaltet boolean not null default false,
  erstellt_am    timestamptz not null default now()
);

-- Nur die Edge Function (service_role) kommt hier heran.
create table if not exists public.einladungscode (
  code          text primary key check (length(btrim(code)) between 4 and 64),
  aktiv         boolean not null default true,
  max_nutzungen integer check (max_nutzungen is null or max_nutzungen > 0),
  benutzt       integer not null default 0,
  bemerkung     text,
  erstellt_am   timestamptz not null default now()
);

-- Konten. startsaldo/startdatum sind der Anfangsbestand: ab diesem Tag
-- rechnet die App. Beide bleiben jederzeit aenderbar - der Saldo wird
-- daraus immer neu berechnet, nie fortgeschrieben.
create table if not exists public.konto (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 60),
  art         text not null default 'giro'
              check (art in ('giro', 'bar', 'spar', 'kreditkarte', 'depot')),
  startsaldo  numeric(12,2) not null default 0,
  startdatum  date not null default current_date,
  farbe       text not null default '#1e6b70' check (farbe ~ '^#[0-9a-fA-F]{6}$'),
  sortierung  integer not null default 0,
  archiviert  boolean not null default false,
  erstellt_am timestamptz not null default now()
);

-- Kategorien in zwei Ebenen: eltern_id ist NULL bei einer Hauptkategorie.
-- Die Hauptkategorien sind die Stuecke im Kuchendiagramm, die
-- Unterkategorien erscheinen beim Antippen eines Stuecks.
create table if not exists public.kategorie (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 60),
  art         text not null check (art in ('ausgabe', 'einnahme')),
  eltern_id   uuid references public.kategorie (id) on delete cascade,
  farbe       text not null default '#1e6b70' check (farbe ~ '^#[0-9a-fA-F]{6}$'),
  sortierung  integer not null default 0,
  aktiv       boolean not null default true,
  erstellt_am timestamptz not null default now()
);

-- Kein doppelter Name innerhalb derselben Ebene. Zwei Teilausdruecke,
-- weil ein UNIQUE ueber eine NULL-Spalte sonst beliebig oft zulaesst.
create unique index if not exists kategorie_haupt_eindeutig
  on public.kategorie (art, lower(btrim(name))) where eltern_id is null;
create unique index if not exists kategorie_unter_eindeutig
  on public.kategorie (eltern_id, lower(btrim(name))) where eltern_id is not null;

-- Fixkosten und andere regelmaessige Posten.
--
-- Faellige Termine werden NICHT gespeichert, sondern aus der Regel
-- gerechnet (siehe Migration 003). So bleibt eine Serie aenderbar,
-- ohne dass hunderte vorausberechnete Zeilen nachgezogen werden muessen.
create table if not exists public.serie (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(btrim(name)) between 1 and 80),
  betrag          numeric(12,2) not null check (betrag > 0),
  art             text not null check (art in ('ausgabe', 'einnahme')),
  rhythmus        text not null
                  check (rhythmus in ('woechentlich', 'monatlich', 'quartal',
                                      'halbjaehrlich', 'jaehrlich')),
  -- Alle N Rhythmen: intervall 2 bei 'monatlich' heisst zweimonatlich.
  intervall       integer not null default 1 check (intervall between 1 and 12),
  -- Bei 'woechentlich' der Wochentag (0 = Montag), sonst der Tag im Monat.
  -- Der 31. rutscht in kurzen Monaten automatisch auf den Monatsletzten.
  faelligkeitstag integer not null check (faelligkeitstag between 0 and 31),
  beginnt_am      date not null,
  endet_am        date,
  konto_id        uuid not null references public.konto (id) on delete restrict,
  kategorie_id    uuid references public.kategorie (id) on delete set null,
  wer             text check (length(wer) <= 120),
  notiz           text check (length(notiz) <= 1000),
  aktiv           boolean not null default true,
  erstellt_von    uuid references public.profil (id) on delete set null,
  erstellt_am     timestamptz not null default now(),
  geaendert_am    timestamptz not null default now(),
  constraint serie_zeitraum check (endet_am is null or endet_am >= beginnt_am)
);

-- Jede Bewegung auf einem Konto.
--
-- Eine Umbuchung ist EINE Zeile mit zwei Konten, nicht zwei verknuepfte
-- Zeilen: so kann sie nicht halb geaendert oder halb geloescht werden.
-- In der Auswertung bleibt sie aussen vor, sonst zaehlte derselbe Euro
-- zweimal.
--
-- serie_id + serie_datum halten fest, welches Vorkommen einer Serie
-- mit dieser Buchung erledigt ist. Der Betrag darf davon abweichen -
-- die Stromabrechnung ist selten so hoch wie der Abschlag.
create table if not exists public.buchung (
  id             uuid primary key default gen_random_uuid(),
  datum          date not null,
  betrag         numeric(12,2) not null check (betrag > 0),
  art            text not null check (art in ('ausgabe', 'einnahme', 'umbuchung')),
  konto_id       uuid not null references public.konto (id) on delete restrict,
  ziel_konto_id  uuid references public.konto (id) on delete restrict,
  kategorie_id   uuid references public.kategorie (id) on delete set null,
  wer            text check (length(wer) <= 120),
  notiz          text check (length(notiz) <= 1000),
  serie_id       uuid references public.serie (id) on delete set null,
  serie_datum    date,
  erfasst_von    uuid references public.profil (id) on delete set null,
  erstellt_am    timestamptz not null default now(),
  geaendert_am   timestamptz not null default now(),
  -- Geloeschtes wandert in den Papierkorb statt sofort zu verschwinden:
  -- bei mehreren Personen soll nichts spurlos weg sein.
  geloescht_am   timestamptz,

  -- Umbuchung: zwei verschiedene Konten, keine Kategorie.
  constraint buchung_umbuchung check (
    case when art = 'umbuchung'
      then ziel_konto_id is not null and ziel_konto_id <> konto_id and kategorie_id is null
      else ziel_konto_id is null
    end
  ),
  -- Ein Serienbezug ohne Datum waere nicht zuzuordnen.
  constraint buchung_serie check ((serie_id is null) = (serie_datum is null))
);

-- Ein einzelnes Vorkommen einer Serie ueberspringen, ohne die Serie
-- anzufassen - etwa ein Beitragsmonat, der einmalig entfaellt.
create table if not exists public.serie_ausnahme (
  serie_id     uuid not null references public.serie (id) on delete cascade,
  faellig_am   date not null,
  bemerkung    text check (length(bemerkung) <= 200),
  erstellt_von uuid references public.profil (id) on delete set null,
  erstellt_am  timestamptz not null default now(),
  primary key (serie_id, faellig_am)
);

-- ------------------------------------------------------------
--  Indizes
-- ------------------------------------------------------------

create index if not exists buchung_datum_idx    on public.buchung (datum desc)
  where geloescht_am is null;
create index if not exists buchung_konto_idx    on public.buchung (konto_id);
create index if not exists buchung_ziel_idx     on public.buchung (ziel_konto_id)
  where ziel_konto_id is not null;
create index if not exists buchung_kategorie_idx on public.buchung (kategorie_id);
create index if not exists buchung_serie_idx    on public.buchung (serie_id, serie_datum)
  where serie_id is not null;
create index if not exists kategorie_eltern_idx on public.kategorie (eltern_id);
create index if not exists serie_aktiv_idx      on public.serie (aktiv) where aktiv;

-- ------------------------------------------------------------
--  Trigger
-- ------------------------------------------------------------

create or replace function intern.setze_geaendert_am()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.geaendert_am := now();
  return new;
end;
$$;

drop trigger if exists buchung_geaendert on public.buchung;
create trigger buchung_geaendert
  before update on public.buchung
  for each row execute function intern.setze_geaendert_am();

drop trigger if exists serie_geaendert on public.serie;
create trigger serie_geaendert
  before update on public.serie
  for each row execute function intern.setze_geaendert_am();

-- Legt zu jedem neuen Konto automatisch ein Profil an, damit es nie ein
-- Konto ohne Profil gibt. Name und Farbe kommen aus den Metadaten der
-- Registrierung; ungueltige Werte werden auf Standards zurueckgesetzt,
-- damit eine Registrierung nie an einer Pruefregel scheitert.
create or replace function intern.neues_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_farbe text;
begin
  v_name := left(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), 60);
  if v_name = '' then
    v_name := left(split_part(coalesce(new.email, 'Profil'), '@', 1), 60);
  end if;
  if v_name = '' then
    v_name := 'Profil';
  end if;

  v_farbe := coalesce(new.raw_user_meta_data ->> 'farbe', '');
  if v_farbe !~ '^#[0-9a-fA-F]{6}$' then
    v_farbe := '#1e6b70';
  end if;

  insert into public.profil (id, name, farbe)
  values (new.id, v_name, v_farbe)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists auth_neues_profil on auth.users;
create trigger auth_neues_profil
  after insert on auth.users
  for each row execute function intern.neues_profil();

-- ------------------------------------------------------------
--  Freischaltung
-- ------------------------------------------------------------
--  Ob die Selbstregistrierung im Dashboard abgeschaltet ist, laesst
--  sich von aussen nicht zuverlaessig pruefen - und ein Haken, den
--  jemand versehentlich umlegt, waere ein stiller Totalausfall des
--  Schutzes. Deshalb steht die Huerde hier in der Datenbank.
--
--  Die Funktion laeuft als Eigentuemer und umgeht damit RLS. Ohne das
--  wuerde die Policy auf "profil" sich selbst abfragen - Endlosrekursion.

create or replace function intern.ist_freigeschaltet()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.freigeschaltet from public.profil p where p.id = (select auth.uid())),
    false
  );
$$;

revoke execute on function intern.ist_freigeschaltet() from public, anon;
grant  execute on function intern.ist_freigeschaltet() to authenticated;

-- ------------------------------------------------------------
--  Row Level Security
-- ------------------------------------------------------------

alter table public.profil         enable row level security;
alter table public.einladungscode enable row level security;
alter table public.konto          enable row level security;
alter table public.kategorie      enable row level security;
alter table public.buchung        enable row level security;
alter table public.serie          enable row level security;
alter table public.serie_ausnahme enable row level security;

-- profil: das eigene sieht man immer - sonst koennte die App nicht
-- einmal erklaeren, warum nichts geht. Die uebrigen erst nach
-- Freischaltung. Aendern nur das eigene, und die Freischaltung nie
-- selbst (dafuer die Pruefung in Migration 002).
drop policy if exists profil_lesen on public.profil;
create policy profil_lesen on public.profil
  for select to authenticated
  using (id = (select auth.uid()) or intern.ist_freigeschaltet());

drop policy if exists profil_aendern on public.profil;
create policy profil_aendern on public.profil
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- konto, kategorie, buchung, serie: gemeinsamer Datenraum.
-- Alle freigeschalteten Profile duerfen lesen und schreiben.
do $$
declare
  v_tabelle text;
begin
  foreach v_tabelle in array array['konto', 'kategorie', 'serie', 'serie_ausnahme'] loop
    execute format('drop policy if exists %I on public.%I', v_tabelle || '_lesen', v_tabelle);
    execute format(
      'create policy %I on public.%I for select to authenticated using (intern.ist_freigeschaltet())',
      v_tabelle || '_lesen', v_tabelle);

    execute format('drop policy if exists %I on public.%I', v_tabelle || '_schreiben', v_tabelle);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using (intern.ist_freigeschaltet()) with check (intern.ist_freigeschaltet())',
      v_tabelle || '_schreiben', v_tabelle);
  end loop;
end
$$;

-- buchung: wie oben, aber beim Anlegen muss erfasst_von das eigene
-- Profil sein. So laesst sich keine Buchung unter fremdem Namen ablegen.
drop policy if exists buchung_lesen on public.buchung;
create policy buchung_lesen on public.buchung
  for select to authenticated
  using (intern.ist_freigeschaltet());

drop policy if exists buchung_anlegen on public.buchung;
create policy buchung_anlegen on public.buchung
  for insert to authenticated
  with check (intern.ist_freigeschaltet() and erfasst_von = (select auth.uid()));

-- Aendern darf jeder Freigeschaltete jede Buchung: es ist eine
-- gemeinsame Haushaltskasse, und wer sich vertippt hat, ist oft nicht
-- der, dem es auffaellt. erfasst_von bleibt dabei stehen.
drop policy if exists buchung_aendern on public.buchung;
create policy buchung_aendern on public.buchung
  for update to authenticated
  using (intern.ist_freigeschaltet())
  with check (intern.ist_freigeschaltet());

drop policy if exists buchung_loeschen on public.buchung;
create policy buchung_loeschen on public.buchung
  for delete to authenticated
  using (intern.ist_freigeschaltet());

-- einladungscode: bewusst ohne jede Policy.
-- Damit kommt ausser service_role niemand an die Tabelle heran.
revoke all on public.einladungscode from anon, authenticated;

-- ------------------------------------------------------------
--  Realtime
-- ------------------------------------------------------------
--  Ohne "replica identity full", damit beim Loeschen nur die id
--  uebertragen wird und keine Inhalte an Unbefugte gelangen.
--  Der Client laedt bei einer Meldung die betroffene Sicht neu.

do $$
begin
  begin
    alter publication supabase_realtime add table public.buchung;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.serie;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.konto;
  exception when duplicate_object then null;
  end;
end
$$;
