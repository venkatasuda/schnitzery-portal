-- Stuttgart checklist templates from "Stuttgart Schnitzery Preparation team Analysis" (pages 1–6).
-- Run once per environment (staging first) AFTER migration 20261108090000_checklist_templates.sql.
-- Safe to re-run: an identical active team/section/task is never inserted twice.
-- Weekdays: 1 Mon · 2 Tue · 3 Wed · 4 Thu · 5 Fri · 6 Sat · 7 Sun.
begin;
do $$
declare b uuid; target text := coalesce(nullif(current_setting('seed.branch', true), ''), 'Schnitzery Stuttgart');
begin
  -- Stuttgart by default; for staging run  set seed.branch = 'LOCAL TEST Branch A';  first.
  select id into b from public.branches where name = target and is_active;
  if b is null then raise exception 'Branch "%" not found — check the name in Settings / Branches', target; end if;

  insert into public.checklist_templates (branch_id, team, section, task, task_de, weekdays, sort)
  select b, v.team, v.section, v.task, v.task_de, v.days::smallint[], v.sort
  from (values
    -- Preparation
    ('Preparation', null, 'Record fridge temperatures for all refrigerators before any preparation (Temperature log)', 'Kühlschranktemperaturen aller Kühlschränke vor Arbeitsbeginn erfassen (Temperaturprotokoll)', '{1,2,3,4,5,6,7}', 10),
    ('Preparation', null, 'Prepare every item on today''s preparation list', 'Alle Positionen der heutigen Vorbereitungsliste vorbereiten', '{1,2,3,4,5,6,7}', 20),
    ('Preparation', null, 'Boards & knives: salad green/black, cheese yellow/blue, garlic red-brown/sky-blue — never mix', 'Bretter & Messer: Salat grün/schwarz, Käse gelb/blau, Knoblauch rot-braun/hellblau — nie mischen', '{1,2,3,4,5,6,7}', 25),
    ('Preparation', null, 'Clean the walls behind the chicken tumbler and around all preparation areas', 'Wände hinter dem Hähnchen-Tumbler und um alle Vorbereitungsbereiche reinigen', '{1,2,3,4,5,6,7}', 30),
    ('Preparation', null, 'Clean under all prep tables', 'Unter allen Vorbereitungstischen reinigen', '{1,2,3,4,5,6,7}', 40),
    ('Preparation', null, 'Clean both prep fridges inside and outside before restocking', 'Beide Vorbereitungskühlschränke innen und außen vor dem Auffüllen reinigen', '{1,2,3,4,5,6,7}', 50),
    ('Preparation', null, 'Clean machines & surfaces after use: salad cutters, chicken tumbler, tables, counters, trays, containers', 'Maschinen & Flächen nach Gebrauch reinigen: Salatschneider, Tumbler, Tische, Theken, Bleche, Behälter', '{1,2,3,4,5,6,7}', 60),
    ('Preparation', null, 'Knives cleaned and back on the wall magnet', 'Messer gereinigt und zurück an die Magnetleiste', '{1,2,3,4,5,6,7}', 70),
    ('Preparation', null, 'Spoons in their boxes — none left lying around', 'Löffel in ihre Boxen — nichts herumliegen lassen', '{1,2,3,4,5,6,7}', 80),
    ('Preparation', null, 'Used utensils handed to the Spüler', 'Benutzte Utensilien an den Spüler übergeben', '{1,2,3,4,5,6,7}', 90),
    ('Preparation', null, 'Sweep, then mop when preparation and cleaning are finished', 'Fegen, dann wischen, wenn Vorbereitung und Reinigung fertig sind', '{1,2,3,4,5,6,7}', 100),
    ('Preparation', null, 'Empty all bins: blue = general rubbish (downstairs, "Trash for Schnitzery"), black = cardboard & paper', 'Alle Mülleimer leeren: blau = Restmüll (unten, „Trash for Schnitzery“), schwarz = Karton & Papier', '{1,2,3,4,5,6,7}', 110),
    -- Lager (Metro delivery days)
    ('Preparation', 'Lager', 'Metro delivery: remove outer cardboard before putting stock away', 'Metro-Lieferung: Umkartons entfernen, bevor Ware eingeräumt wird', '{2,5}', 10),
    ('Preparation', 'Lager', 'Store everything in its labelled place', 'Alles an seinem beschrifteten Platz lagern', '{2,5}', 20),
    ('Preparation', 'Lager', 'Return black crates and delivery trolleys to the Metro driver', 'Schwarze Kisten und Lieferwagen dem Metro-Fahrer zurückgeben', '{2,5}', 30),
    ('Preparation', 'Lager', 'Sort sauce buckets by use-by date; move buckets needed for service to the kitchen fridge', 'Soßeneimer nach Verbrauchsdatum sortieren; benötigte Eimer in den Küchenkühlschrank', '{2,5}', 40),
    ('Preparation', 'Lager', 'Stock rotation: older stock left, new deliveries right — use oldest first', 'Rotation: ältere Ware links, neue Lieferung rechts — Ältestes zuerst', '{2,5}', 50),
    ('Preparation', 'Lager', 'Label clearly where needed, same system across the whole Lager', 'Wo nötig klar beschriften, gleiches System im ganzen Lager', '{2,5}', 60),
    ('Preparation', 'Lager', 'Sweep, then wet-mop all storage floors (walk-in, drinks room, corridor, bowl room)', 'Alle Lagerböden fegen und nass wischen (Kühlraum, Getränkeraum, Flur, Schüsselraum)', '{2,5}', 70),
    -- Kitchen · Morning
    ('Kitchen', 'Morning', 'Clean fryers & kitchen walls around topping, burger and fryer stations', 'Fritteusen & Küchenwände an Topping-, Burger- und Fritteusenstation reinigen', '{1,2,3,4,5,6,7}', 10),
    ('Kitchen', 'Morning', 'Used oil into the oil can; can back to its place in the Lager', 'Altöl in den Ölkanister; Kanister zurück an seinen Platz im Lager', '{1,2,3,4,5,6,7}', 20),
    ('Kitchen', 'Morning', 'Prepare rice', 'Reis vorbereiten', '{1,2,3,4,5,6,7}', 30),
    ('Kitchen', 'Morning', 'Refill topping station + backup: fries, plant-based, salad, bread, cornichons, corn, jalapeños, mini peppers', 'Topping-Station + Reserve auffüllen: Pommes, vegane Produkte, Salat, Brot, Cornichons, Mais, Jalapeños, Mini-Paprika', '{1,2,3,4,5,6,7}', 40),
    ('Kitchen', 'Morning', 'Clean every station every 10 minutes during service', 'Jede Station während des Service alle 10 Minuten reinigen', '{1,2,3,4,5,6,7}', 50),
    ('Kitchen', 'Morning', 'Before handover: fill all sauce bottles', 'Vor der Übergabe: alle Soßenflaschen füllen', '{1,2,3,4,5,6,7}', 60),
    ('Kitchen', 'Morning', 'Before handover: restock every station (bowls, pasta, supplies)', 'Vor der Übergabe: jede Station auffüllen (Schüsseln, Pasta, Material)', '{1,2,3,4,5,6,7}', 70),
    ('Kitchen', 'Morning', 'Leave every station clean and ready for the evening shift', 'Jede Station sauber und bereit für die Spätschicht hinterlassen', '{1,2,3,4,5,6,7}', 80),
    ('Kitchen', 'Morning', 'Empty all bins (blue = general rubbish, black = cardboard & paper)', 'Alle Mülleimer leeren (blau = Restmüll, schwarz = Karton & Papier)', '{1,2,3,4,5,6,7}', 90),
    -- Kitchen · Evening
    ('Kitchen', 'Evening', 'Deep-clean all stations: topping, burger, fryers, pasta', 'Alle Stationen gründlich reinigen: Topping, Burger, Fritteusen, Pasta', '{1,2,3,4,5,6,7}', 10),
    ('Kitchen', 'Evening', 'Refill sauce bottles and wipe the outside with a paper towel', 'Soßenflaschen auffüllen und außen mit Papiertuch abwischen', '{1,2,3,4,5,6,7}', 20),
    ('Kitchen', 'Evening', 'Clean small utensils, including fry holders', 'Kleine Utensilien reinigen, inklusive Pommes-Halter', '{1,2,3,4,5,6,7}', 30),
    ('Kitchen', 'Evening', 'Clean under every station; remove food from gaps behind and between stations', 'Unter jeder Station reinigen; Essensreste aus Spalten hinter und zwischen Stationen entfernen', '{1,2,3,4,5,6,7}', 40),
    ('Kitchen', 'Evening', 'Sweep, then wet-mop the entire kitchen floor', 'Gesamten Küchenboden fegen und nass wischen', '{1,2,3,4,5,6,7}', 50),
    ('Kitchen', 'Evening', 'Deep-clean ventilation hood and filters with grease remover (Fettlöser)', 'Lüftung / Dunstabzugshaube und Filter mit Fettlöser gründlich reinigen', '{3,7}', 60),
    ('Kitchen', 'Evening', 'Empty all bins (blue = general rubbish, black = cardboard & paper)', 'Alle Mülleimer leeren (blau = Restmüll, schwarz = Karton & Papier)', '{1,2,3,4,5,6,7}', 70),
    -- Dishwashing (Spüler)
    ('Dishwashing', null, 'Wash prep-team utensils and return each item to its place', 'Utensilien des Vorbereitungsteams spülen und an ihren Platz zurücklegen', '{1,2,3,4,5,6,7}', 10),
    ('Dishwashing', null, 'Knives back on the wall magnet', 'Messer zurück an die Magnetleiste', '{1,2,3,4,5,6,7}', 20),
    ('Dishwashing', null, 'Slicers in their boxes', 'Schneider in ihre Boxen', '{1,2,3,4,5,6,7}', 30),
    ('Dishwashing', null, 'Sort lids & containers by size (large, medium, small) into their places', 'Deckel & Behälter nach Größe (groß, mittel, klein) an ihren Platz sortieren', '{1,2,3,4,5,6,7}', 40),
    ('Dishwashing', null, 'Check dining tables every 30 minutes when time allows', 'Tische im Gastraum alle 30 Minuten prüfen, wenn Zeit ist', '{1,2,3,4,5,6,7}', 50),
    ('Dishwashing', null, 'Help the kitchen when needed and dishwashing allows', 'Küche helfen, wenn nötig und das Spülen es erlaubt', '{1,2,3,4,5,6,7}', 60),
    ('Dishwashing', null, 'Deep-clean all sauce bottles', 'Alle Soßenflaschen gründlich reinigen', '{3,7}', 70),
    -- Cashier (Kasse)
    ('Cashier', null, 'Clean all tables & chairs inside and outside', 'Alle Tische & Stühle innen und außen reinigen', '{1,2,3,4,5,6,7}', 10),
    ('Cashier', null, 'Restock service supplies: takeaway bags, bowls, lids, forks', 'Servicematerial auffüllen: Tüten, Schüsseln, Deckel, Gabeln', '{1,2,3,4,5,6,7}', 20),
    ('Cashier', null, 'Sweep & mop Kasse and dining area, including under the tables', 'Kasse und Gastraum fegen & wischen, auch unter den Tischen', '{1,2,3,4,5,6,7}', 30),
    ('Cashier', null, 'Wipe handles & fridge glass — no dirt, no fingerprints', 'Griffe & Kühlschrankglas abwischen — kein Schmutz, keine Fingerabdrücke', '{1,2,3,4,5,6,7}', 40),
    ('Cashier', null, 'Weekly deep clean: walls, skirting boards, dining-area corners (move tables)', 'Wöchentliche Grundreinigung: Wände, Sockelleisten, Ecken im Gastraum (Tische verschieben)', '{1,4}', 50),
    ('Cashier', null, 'Weekly deep clean: drinks fridge interiors, chair frames and gaps, leather benches', 'Wöchentliche Grundreinigung: Getränkekühlschränke innen, Stuhlgestelle und Spalten, Lederbänke', '{2,5}', 60),
    ('Cashier', null, 'Weekly deep clean: front-door glass, windows, table legs and undersides', 'Wöchentliche Grundreinigung: Glas der Eingangstür, Fenster, Tischbeine und -unterseiten', '{3,7}', 70),
    ('Cashier', null, 'Refill both drinks fridges; empty bottles and crates back to the Lager', 'Beide Getränkekühlschränke auffüllen; Leergut und Kisten zurück ins Lager', '{1,2,3,4,5,6,7}', 80),
    ('Cashier', null, 'Empty all bins (blue = general rubbish, black = cardboard & paper)', 'Alle Mülleimer leeren (blau = Restmüll, schwarz = Karton & Papier)', '{1,2,3,4,5,6,7}', 90)
  ) as v(team, section, task, task_de, days, sort)
  where not exists (select 1 from public.checklist_templates t
    where t.branch_id = b and t.team = v.team and t.section is not distinct from v.section and t.task = v.task and t.is_active);
end $$;
commit;
