-- ============================================================
--  Registrierung: Einladungscode und Freischaltung
-- ============================================================
--  Der einzige Weg zu einem nutzbaren Profil fuehrt ueber die Edge
--  Function "registrieren". Sie prueft den Code mit Dienstrechten und
--  schaltet das Profil danach frei. Wer auf anderem Weg ein Konto
--  anlegt, bekommt ein Profil ohne Freischaltung: es sieht nichts.
-- ============================================================

-- Prueft den Code und zaehlt ihn in einem Schritt hoch. Atomar, damit
-- ein Code mit begrenzter Nutzungszahl nicht durch zwei gleichzeitige
-- Registrierungen ueberzogen werden kann.
create or replace function public.code_verbrauchen(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  update public.einladungscode
     set benutzt = benutzt + 1
   where code = p_code
     and aktiv
     and (max_nutzungen is null or benutzt < max_nutzungen)
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

-- Macht eine verbrauchte Nutzung wieder rueckgaengig, falls das Anlegen
-- des Kontos danach fehlschlaegt.
create or replace function public.code_zuruecknehmen(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.einladungscode
     set benutzt = greatest(benutzt - 1, 0)
   where code = p_code;
$$;

create or replace function public.profil_freischalten(p_profil uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profil set freigeschaltet = true where id = p_profil;
$$;

revoke execute on function public.code_verbrauchen(text)      from public, anon, authenticated;
revoke execute on function public.code_zuruecknehmen(text)    from public, anon, authenticated;
revoke execute on function public.profil_freischalten(uuid)   from public, anon, authenticated;
grant  execute on function public.code_verbrauchen(text)      to service_role;
grant  execute on function public.code_zuruecknehmen(text)    to service_role;
grant  execute on function public.profil_freischalten(uuid)   to service_role;

-- ------------------------------------------------------------
--  Die Freischaltung gegen Selbstbedienung sichern
-- ------------------------------------------------------------
--  Die Policy profil_aendern erlaubt jedem, sein eigenes Profil zu
--  aendern - Name und Farbe soll man ja anpassen koennen. Ohne die
--  folgende Sperre koennte damit aber auch jemand sein eigenes
--  freigeschaltet auf true setzen und den Einladungscode aushebeln.
--
--  Der Trigger setzt den Wert still auf den alten zurueck, statt einen
--  Fehler zu werfen: eine Fehlermeldung wuerde nur verraten, dass es
--  hier etwas zu holen gibt.

create or replace function intern.freischaltung_schuetzen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.freigeschaltet is distinct from old.freigeschaltet
     and coalesce(auth.role(), '') <> 'service_role' then
    new.freigeschaltet := old.freigeschaltet;
  end if;
  return new;
end;
$$;

drop trigger if exists profil_freischaltung on public.profil;
create trigger profil_freischaltung
  before update on public.profil
  for each row execute function intern.freischaltung_schuetzen();

-- ------------------------------------------------------------
--  Kein Code in dieser Datei!
-- ------------------------------------------------------------
--  Diese Datei liegt in einem oeffentlichen Repository. Ein Code, der
--  hier steht, ist fuer alle lesbar - und damit wertlos.
--  Codes werden von Hand im SQL-Editor angelegt:
--
--    insert into public.einladungscode (code, max_nutzungen, bemerkung)
--    values ('AUSGEDACHTER-CODE', 2, 'Fuer uns beide');
--
--  Nachsehen, welche es gibt und wie oft sie benutzt wurden:
--
--    select code, aktiv, benutzt, max_nutzungen, bemerkung
--      from public.einladungscode;
--
--  Sperren:
--
--    update public.einladungscode set aktiv = false where code = '...';
-- ------------------------------------------------------------
