-- =====================================================================
--  SISTEMCAR RENTAL v7 — clienți persoane juridice (firme) și delegat
--  Rulează în Supabase → SQL Editor → Run (după V6).
--  Nu șterge nimic și poate fi rulat de mai multe ori.
-- =====================================================================

-- client: persoană fizică (PF) sau juridică (PJ); pentru firme: nr. Reg. Com. și sediul social
alter table public.clients add column if not exists tip_client text not null default 'PF';
alter table public.clients add column if not exists reg_com    text;
alter table public.clients add column if not exists sediu      text;

-- închiriere pe firmă: persoana delegată care primește mașina (se păstrează pe fiecare contract)
alter table public.rentals add column if not exists delegat_nume             text;
alter table public.rentals add column if not exists delegat_cnp              text;
alter table public.rentals add column if not exists delegat_act              text;
alter table public.rentals add column if not exists delegat_telefon          text;
alter table public.rentals add column if not exists delegat_permis_numar     text;
alter table public.rentals add column if not exists delegat_permis_categorie text;
alter table public.rentals add column if not exists delegat_permis_expira    date;
alter table public.rentals add column if not exists delegatie                text;

-- Gata. Dacă vezi „Success. No rows returned”, totul e în regulă.
