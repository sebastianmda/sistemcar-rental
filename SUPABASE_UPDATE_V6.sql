-- =====================================================================
--  SISTEMCAR RENTAL v6 — contract semnat cu pixul (pe hârtie)
--  Rulează în Supabase → SQL Editor → Run (după V5).
--  Nu șterge nimic și poate fi rulat de mai multe ori.
-- =====================================================================

-- momentul în care contractul a fost tipărit pentru semnare pe hârtie
alter table public.rentals add column if not exists semnat_hartie_predare timestamptz;
alter table public.rentals add column if not exists semnat_hartie_retur   timestamptz;

-- Gata. Dacă vezi „Success. No rows returned”, totul e în regulă.
