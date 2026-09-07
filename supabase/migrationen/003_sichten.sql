-- ============================================================
--  Sichten: Salden und offene Faelligkeiten
-- ============================================================
--  Gerechnet wird in der Datenbank, nicht im Browser. Sonst muesste
--  jedes Geraet alle Buchungen laden, um eine einzige Zahl zu zeigen.
--
--  Beide Sichten laufen mit security_invoker: sie sehen genau das,
--  was die abfragende Person laut RLS sehen darf.
-- ============================================================

-- ------------------------------------------------------------
--  Faellige Termine einer Serie ausrechnen
-- ------------------------------------------------------------
--  Nicht gespeichert, sondern gerechnet - so bleibt eine Serie
--  aenderbar, ohne dass vorausberechnete Zeilen nachgezogen werden.
--
--  Der 31. als Faelligkeitstag rutscht in kurzen Monaten auf den
--  Monatsletzten: eine Miete zum 31. ist im Februar am 28. faellig,
--  nicht am 3. Maerz.
create or replace function intern.faelligkeiten(
  p_rhythmus  text,
  p_intervall integer,
  p_tag       integer,
  p_beginnt   date,
  p_endet     date,
  p_bis       date
)
returns setof date
language plpgsql
stable
set search_path = public
as $$
declare
  v_bis    date := least(coalesce(p_endet, p_bis), p_bis);
  v_monate integer;
  v_monat  date;
  v_tag    integer;
  v_datum  date;
begin
  if v_bis is null or v_bis < p_beginnt then
    return;
  end if;

  -- Woechentlich zaehlt vom Beginn an weiter; der Wochentag ergibt
  -- sich damit aus beginnt_am und braucht keine eigene Angabe.
  if p_rhythmus = 'woechentlich' then
    return query
      select d::date
        from generate_series(p_beginnt::timestamp,
                             v_bis::timestamp,
                             make_interval(days => p_intervall * 7)) as d;
    return;
  end if;

  v_monate := case p_rhythmus
                when 'quartal'       then 3
                when 'halbjaehrlich' then 6
                when 'jaehrlich'     then 12
                else 1
              end * p_intervall;

  v_monat := date_trunc('month', p_beginnt)::date;
  while v_monat <= v_bis loop
    -- Letzter Tag des Monats als Obergrenze.
    v_tag := least(p_tag, extract(day from (v_monat + interval '1 month - 1 day'))::integer);
    v_datum := v_monat + (v_tag - 1);
    if v_datum >= p_beginnt and v_datum <= v_bis then
      return next v_datum;
    end if;
    v_monat := (v_monat + make_interval(months => v_monate))::date;
  end loop;
end;
$$;

revoke execute on function intern.faelligkeiten(text, integer, integer, date, date, date)
  from public, anon;
grant execute on function intern.faelligkeiten(text, integer, integer, date, date, date)
  to authenticated;

-- ------------------------------------------------------------
--  Saldo je Konto
-- ------------------------------------------------------------
--  Startsaldo plus alles, was seit dem Startdatum darauf gebucht wurde.
--  Buchungen vor dem Startdatum bleiben aussen vor - die stecken
--  bereits im Startsaldo.
--
--  Eine Umbuchung geht dem Quellkonto ab und kommt beim Zielkonto an.
--  In Summe ueber alle Konten hebt sie sich damit auf, so wie es sein
--  soll: Geld von einem Konto auf ein anderes ist keine Ausgabe.
create or replace view public.v_kontosaldo
with (security_invoker = true) as
select
  k.id          as konto_id,
  k.name,
  k.art,
  k.farbe,
  k.sortierung,
  k.archiviert,
  k.startsaldo,
  k.startdatum,
  k.startsaldo
    + coalesce((
        select sum(b.betrag) from public.buchung b
         where b.geloescht_am is null
           and b.datum >= k.startdatum
           and ((b.art = 'einnahme'  and b.konto_id      = k.id)
             or (b.art = 'umbuchung' and b.ziel_konto_id = k.id))
      ), 0)
    - coalesce((
        select sum(b.betrag) from public.buchung b
         where b.geloescht_am is null
           and b.datum >= k.startdatum
           and ((b.art = 'ausgabe'   and b.konto_id = k.id)
             or (b.art = 'umbuchung' and b.konto_id = k.id))
      ), 0)
    as saldo
from public.konto k;

-- ------------------------------------------------------------
--  Offene Faelligkeiten
-- ------------------------------------------------------------
--  Alles, was laut Serie faellig ist oder war und wofuer es weder eine
--  Buchung noch eine Ausnahme gibt. Vergangenes bleibt stehen, bis es
--  bestaetigt wird - eine vergessene Rechnung soll nicht stillschweigend
--  aus der Liste rutschen.
--
--  Faelligkeiten vor dem Startdatum des Kontos bleiben aussen vor: die
--  stecken bereits im Startsaldo. Ohne diese Bedingung wuerde eine Serie,
--  die schon laenger laeuft, beim Anlegen eine Wand alter "offener"
--  Posten erzeugen, die in Wahrheit laengst bezahlt sind.
--
--  Vorschau bis 60 Tage voraus; die App zeigt daraus je nach Ansicht
--  die naechsten sieben Tage oder den Rest des Monats.
create or replace view public.v_offene_faelligkeit
with (security_invoker = true) as
select
  s.id           as serie_id,
  s.name,
  s.betrag,
  s.art,
  s.konto_id,
  s.kategorie_id,
  s.wer,
  f.faellig_am,
  (f.faellig_am < current_date) as ueberfaellig
from public.serie s
join public.konto k on k.id = s.konto_id
cross join lateral intern.faelligkeiten(
       s.rhythmus, s.intervall, s.faelligkeitstag,
       s.beginnt_am, s.endet_am, (current_date + 60)
     ) as f(faellig_am)
where s.aktiv
  and f.faellig_am >= k.startdatum
  and not exists (
        select 1 from public.buchung b
         where b.serie_id = s.id
           and b.serie_datum = f.faellig_am
           and b.geloescht_am is null)
  and not exists (
        select 1 from public.serie_ausnahme a
         where a.serie_id = s.id
           and a.faellig_am = f.faellig_am);
