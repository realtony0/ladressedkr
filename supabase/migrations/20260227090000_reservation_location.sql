DO $$ BEGIN
  CREATE TYPE public.reservation_location AS ENUM ('interieur', 'terrasse');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS emplacement public.reservation_location NOT NULL DEFAULT 'interieur';
