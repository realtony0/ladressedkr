create extension if not exists "pgcrypto";

-- Enums
DO $$ BEGIN
  CREATE TYPE public.role_type AS ENUM ('cuisine', 'serveur', 'admin', 'proprio');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('received', 'preparing', 'ready');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.table_status AS ENUM ('active', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.server_call_reason AS ENUM ('addition', 'aide', 'demande_speciale');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.server_call_status AS ENUM ('pending', 'acknowledged', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.promo_type AS ENUM ('percent', 'amount');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.service_type AS ENUM ('service', 'brunch');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tables
CREATE TABLE IF NOT EXISTS public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  logo TEXT,
  adresse TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.role_type NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  prenom TEXT NOT NULL DEFAULT '',
  nom TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INT NOT NULL,
  qr_code TEXT NOT NULL,
  statut public.table_status NOT NULL DEFAULT 'active',
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, numero)
);

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  slug TEXT NOT NULL,
  icone TEXT NOT NULL,
  ordre INT NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, slug)
);

CREATE TABLE IF NOT EXISTS public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  ordre INT NOT NULL,
  categorie_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  description TEXT NOT NULL,
  prix NUMERIC(12,2) NOT NULL CHECK (prix >= 0),
  photo TEXT,
  categorie_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  subcategorie_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  disponible BOOLEAN NOT NULL DEFAULT true,
  allergenes TEXT[] NOT NULL DEFAULT '{}',
  a_accompagnement BOOLEAN NOT NULL DEFAULT false,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  plat_du_jour BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, nom)
);

CREATE TABLE IF NOT EXISTS public.pizza_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  taille TEXT NOT NULL,
  prix NUMERIC(12,2) NOT NULL CHECK (prix >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accompaniments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  prix_supplement NUMERIC(12,2) NOT NULL CHECK (prix_supplement >= 0),
  ordre INT NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, nom)
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  statut public.order_status NOT NULL DEFAULT 'received',
  heure TIMESTAMPTZ NOT NULL DEFAULT now(),
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  eta_minutes INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantite INT NOT NULL CHECK (quantite > 0),
  note TEXT,
  accompagnement_id UUID REFERENCES public.accompaniments(id) ON DELETE SET NULL,
  pizza_size_id UUID REFERENCES public.pizza_sizes(id) ON DELETE SET NULL,
  prix_unitaire NUMERIC(12,2) NOT NULL DEFAULT 0,
  supplement NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.server_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  motif public.server_call_reason NOT NULL,
  details TEXT,
  statut public.server_call_status NOT NULL DEFAULT 'pending',
  heure TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  note INT NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  type public.promo_type NOT NULL,
  valeur NUMERIC(12,2) NOT NULL CHECK (valeur >= 0),
  date_debut TIMESTAMPTZ NOT NULL,
  date_fin TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (date_fin > date_debut)
);

CREATE TABLE IF NOT EXISTS public.staff_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  en_service BOOLEAN NOT NULL DEFAULT false,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS public.service_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  service_type public.service_type NOT NULL,
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, service_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_restaurant ON public.users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON public.tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON public.categories(restaurant_id, ordre);
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items(categorie_id, disponible);
CREATE INDEX IF NOT EXISTS idx_items_restaurant ON public.items(restaurant_id, disponible);
CREATE INDEX IF NOT EXISTS idx_orders_table ON public.orders(table_id, heure DESC);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON public.orders(restaurant_id, heure DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_server_calls_table ON public.server_calls(table_id, heure DESC);
CREATE INDEX IF NOT EXISTS idx_staff_schedule_date ON public.staff_schedule(date, en_service);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions(active, date_debut, date_fin);

-- Updated_at trigger helpers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_items_touch_updated_at ON public.items;
CREATE TRIGGER trg_items_touch_updated_at
BEFORE UPDATE ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_orders_touch_updated_at ON public.orders;
CREATE TRIGGER trg_orders_touch_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

-- Auth helper functions
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.role_type
LANGUAGE sql
STABLE
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_restaurant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT restaurant_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_staff(allowed public.role_type[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = ANY(allowed)
  );
$$;

-- RLS
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizza_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accompaniments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_hours ENABLE ROW LEVEL SECURITY;

-- Restaurants
DROP POLICY IF EXISTS restaurants_public_select ON public.restaurants;
CREATE POLICY restaurants_public_select ON public.restaurants
FOR SELECT
USING (true);

-- Users
DROP POLICY IF EXISTS users_self_or_admin_select ON public.users;
CREATE POLICY users_self_or_admin_select ON public.users
FOR SELECT
USING (
  auth.uid() = id
  OR public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type])
);

DROP POLICY IF EXISTS users_admin_manage ON public.users;
CREATE POLICY users_admin_manage ON public.users
FOR ALL
USING (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]))
WITH CHECK (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]));

-- Tables
DROP POLICY IF EXISTS tables_public_active_select ON public.tables;
CREATE POLICY tables_public_active_select ON public.tables
FOR SELECT
USING (statut = 'active');

DROP POLICY IF EXISTS tables_staff_manage ON public.tables;
CREATE POLICY tables_staff_manage ON public.tables
FOR ALL
USING (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]))
WITH CHECK (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]));

-- Categories/subcategories
DROP POLICY IF EXISTS categories_public_select ON public.categories;
CREATE POLICY categories_public_select ON public.categories
FOR SELECT
USING (true);

DROP POLICY IF EXISTS categories_staff_manage ON public.categories;
CREATE POLICY categories_staff_manage ON public.categories
FOR ALL
USING (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]))
WITH CHECK (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]));

DROP POLICY IF EXISTS subcategories_public_select ON public.subcategories;
CREATE POLICY subcategories_public_select ON public.subcategories
FOR SELECT
USING (true);

DROP POLICY IF EXISTS subcategories_staff_manage ON public.subcategories;
CREATE POLICY subcategories_staff_manage ON public.subcategories
FOR ALL
USING (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]))
WITH CHECK (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]));

-- Items
DROP POLICY IF EXISTS items_public_select_available ON public.items;
CREATE POLICY items_public_select_available ON public.items
FOR SELECT
USING (disponible = true);

DROP POLICY IF EXISTS items_staff_full_select ON public.items;
CREATE POLICY items_staff_full_select ON public.items
FOR SELECT
USING (public.is_staff(ARRAY['cuisine'::public.role_type, 'serveur'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type]));

DROP POLICY IF EXISTS items_cuisine_update_stock ON public.items;
CREATE POLICY items_cuisine_update_stock ON public.items
FOR UPDATE
USING (public.is_staff(ARRAY['cuisine'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type]))
WITH CHECK (public.is_staff(ARRAY['cuisine'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type]));

DROP POLICY IF EXISTS items_admin_manage ON public.items;
CREATE POLICY items_admin_manage ON public.items
FOR ALL
USING (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]))
WITH CHECK (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]));

-- Accompaniments + pizza sizes + promotions + service hours
DROP POLICY IF EXISTS accompaniments_public_select ON public.accompaniments;
CREATE POLICY accompaniments_public_select ON public.accompaniments
FOR SELECT
USING (true);

DROP POLICY IF EXISTS accompaniments_staff_manage ON public.accompaniments;
CREATE POLICY accompaniments_staff_manage ON public.accompaniments
FOR ALL
USING (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]))
WITH CHECK (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]));

DROP POLICY IF EXISTS pizza_sizes_public_select ON public.pizza_sizes;
CREATE POLICY pizza_sizes_public_select ON public.pizza_sizes
FOR SELECT
USING (true);

DROP POLICY IF EXISTS pizza_sizes_staff_manage ON public.pizza_sizes;
CREATE POLICY pizza_sizes_staff_manage ON public.pizza_sizes
FOR ALL
USING (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]))
WITH CHECK (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]));

DROP POLICY IF EXISTS promotions_public_select_active ON public.promotions;
CREATE POLICY promotions_public_select_active ON public.promotions
FOR SELECT
USING (active = true);

DROP POLICY IF EXISTS promotions_staff_manage ON public.promotions;
CREATE POLICY promotions_staff_manage ON public.promotions
FOR ALL
USING (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]))
WITH CHECK (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]));

DROP POLICY IF EXISTS service_hours_public_select ON public.service_hours;
CREATE POLICY service_hours_public_select ON public.service_hours
FOR SELECT
USING (true);

DROP POLICY IF EXISTS service_hours_staff_manage ON public.service_hours;
CREATE POLICY service_hours_staff_manage ON public.service_hours
FOR ALL
USING (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]))
WITH CHECK (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]));

-- Orders
DROP POLICY IF EXISTS orders_public_select ON public.orders;
CREATE POLICY orders_public_select ON public.orders
FOR SELECT
USING (true);

DROP POLICY IF EXISTS orders_staff_manage ON public.orders;
CREATE POLICY orders_staff_manage ON public.orders
FOR ALL
USING (public.is_staff(ARRAY['cuisine'::public.role_type, 'serveur'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type]))
WITH CHECK (public.is_staff(ARRAY['cuisine'::public.role_type, 'serveur'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type]));

-- Order items
DROP POLICY IF EXISTS order_items_public_select ON public.order_items;
CREATE POLICY order_items_public_select ON public.order_items
FOR SELECT
USING (true);

DROP POLICY IF EXISTS order_items_staff_manage ON public.order_items;
CREATE POLICY order_items_staff_manage ON public.order_items
FOR ALL
USING (public.is_staff(ARRAY['cuisine'::public.role_type, 'serveur'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type]))
WITH CHECK (public.is_staff(ARRAY['cuisine'::public.role_type, 'serveur'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type]));

-- Server calls
DROP POLICY IF EXISTS server_calls_public_insert ON public.server_calls;
CREATE POLICY server_calls_public_insert ON public.server_calls
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS server_calls_public_select ON public.server_calls;
CREATE POLICY server_calls_public_select ON public.server_calls
FOR SELECT
USING (public.is_staff(ARRAY['cuisine'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type]));

DROP POLICY IF EXISTS server_calls_staff_update ON public.server_calls;
CREATE POLICY server_calls_staff_update ON public.server_calls
FOR UPDATE
USING (public.is_staff(ARRAY['cuisine'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type]))
WITH CHECK (public.is_staff(ARRAY['cuisine'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type]));

-- Ratings
DROP POLICY IF EXISTS ratings_public_insert ON public.ratings;
CREATE POLICY ratings_public_insert ON public.ratings
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS ratings_staff_select ON public.ratings;
CREATE POLICY ratings_staff_select ON public.ratings
FOR SELECT
USING (true);

-- Staff schedule
DROP POLICY IF EXISTS staff_schedule_staff_select ON public.staff_schedule;
CREATE POLICY staff_schedule_staff_select ON public.staff_schedule
FOR SELECT
USING (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]));

DROP POLICY IF EXISTS staff_schedule_staff_manage ON public.staff_schedule;
CREATE POLICY staff_schedule_staff_manage ON public.staff_schedule
FOR ALL
USING (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]))
WITH CHECK (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type]));

-- Realtime publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'items'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'server_calls'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.server_calls;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'promotions'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.promotions;
    END IF;
  END IF;
END;
$$;

-- Seed base restaurant
INSERT INTO public.restaurants (id, nom, logo, adresse)
VALUES (
  '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55',
  'L''Adresse Dakar',
  NULL,
  'Corniche Ouest, Dakar'
)
ON CONFLICT (id) DO UPDATE SET
  nom = EXCLUDED.nom,
  adresse = EXCLUDED.adresse;

-- Seed tables 1..20
INSERT INTO public.tables (numero, qr_code, statut, restaurant_id)
SELECT gs.numero,
       format('https://ladresse-dakar.vercel.app/%s', gs.numero),
       'active',
       '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'
FROM generate_series(1, 20) AS gs(numero)
ON CONFLICT (restaurant_id, numero) DO NOTHING;

-- Seed categories
INSERT INTO public.categories (nom, slug, icone, ordre, restaurant_id)
VALUES
  ('Entrées & Salades', 'entrees-salades', 'Leaf', 1, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'),
  ('Burgers', 'burgers', 'Sandwich', 2, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'),
  ('Pâtes', 'pates', 'CookingPot', 3, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'),
  ('Viandes', 'viandes', 'Beef', 4, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'),
  ('Volailles', 'volailles', 'Drumstick', 5, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'),
  ('Poissons', 'poissons', 'Fish', 6, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'),
  ('Pizzas', 'pizzas', 'Pizza', 7, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'),
  ('Cocktails sans alcool', 'cocktails-sans-alcool', 'GlassWater', 8, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'),
  ('Brunch', 'brunch', 'Sun', 9, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55')
ON CONFLICT (restaurant_id, slug) DO UPDATE SET
  nom = EXCLUDED.nom,
  icone = EXCLUDED.icone,
  ordre = EXCLUDED.ordre;

-- Seed subcategories
INSERT INTO public.subcategories (nom, ordre, categorie_id, restaurant_id)
SELECT 'Formules', 1, c.id, c.restaurant_id
FROM public.categories c
WHERE c.slug = 'brunch' AND c.restaurant_id = '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'
ON CONFLICT DO NOTHING;

INSERT INTO public.subcategories (nom, ordre, categorie_id, restaurant_id)
SELECT 'À la carte', 2, c.id, c.restaurant_id
FROM public.categories c
WHERE c.slug = 'brunch' AND c.restaurant_id = '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'
ON CONFLICT DO NOTHING;

-- Seed accompaniments
INSERT INTO public.accompaniments (nom, prix_supplement, ordre, restaurant_id)
VALUES
  ('Pas d''accompagnement', 0, 1, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'),
  ('Frites maison', 2500, 2, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'),
  ('Purée de pommes de terre maison', 2500, 3, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'),
  ('Riz basmati parfumé', 2500, 4, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'),
  ('Alloco ou patate douce frite', 2500, 5, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'),
  ('Légumes poêlés de saison', 2500, 6, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55')
ON CONFLICT (restaurant_id, nom) DO UPDATE SET
  prix_supplement = EXCLUDED.prix_supplement,
  ordre = EXCLUDED.ordre;

-- Seed service hours
INSERT INTO public.service_hours (restaurant_id, service_type, open_time, close_time, enabled)
VALUES
  ('8f7c1bf8-feb5-4f34-88fb-781f2fd89d55', 'service', '12:00', '23:30', true),
  ('8f7c1bf8-feb5-4f34-88fb-781f2fd89d55', 'brunch', '10:30', '14:30', true)
ON CONFLICT (restaurant_id, service_type) DO UPDATE SET
  open_time = EXCLUDED.open_time,
  close_time = EXCLUDED.close_time,
  enabled = EXCLUDED.enabled;

-- Seed menu items
WITH ctx AS (
  SELECT '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid AS restaurant_id
),
cat AS (
  SELECT c.id, c.slug
  FROM public.categories c
  JOIN ctx ON c.restaurant_id = ctx.restaurant_id
),
sub AS (
  SELECT s.id, s.nom
  FROM public.subcategories s
  JOIN ctx ON s.restaurant_id = ctx.restaurant_id
)
INSERT INTO public.items (
  nom,
  description,
  prix,
  photo,
  categorie_id,
  subcategorie_id,
  disponible,
  allergenes,
  a_accompagnement,
  restaurant_id,
  plat_du_jour
)
SELECT
  v.nom,
  v.description,
  v.prix,
  v.photo,
  cat.id AS categorie_id,
  sub.id AS subcategorie_id,
  v.disponible,
  v.allergenes,
  v.a_accompagnement,
  v.restaurant_id,
  v.plat_du_jour
FROM (
  VALUES
    ('Burrata de Casamance, tomates confites et basilic', 'Burrata crémeuse, tomates rôties, huile d''olive vierge et basilic frais.', 7800, NULL, 'entrees-salades', NULL, true, ARRAY['lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Salade de crevettes grillées, mangue verte et avocat', 'Crevettes marinées, avocat, mangue verte, jeunes pousses et vinaigrette agrumes.', 9200, NULL, 'entrees-salades', NULL, true, ARRAY['crustaces','moutarde'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Tartare de thon rouge à la dakaroise', 'Thon rouge assaisonné, citron vert, piment doux, coriandre et croustillant de manioc.', 9800, NULL, 'entrees-salades', NULL, true, ARRAY['poissons'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Velouté de patate douce au gingembre frais', 'Soupe onctueuse de patate douce, gingembre et lait de coco.', 6500, NULL, 'entrees-salades', NULL, true, ARRAY['lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    ('Dakar Smash Burger', 'Bœuf smashé, cheddar affiné, oignons caramélisés, sauce maison, servi avec frites maison.', 9500, NULL, 'burgers', NULL, true, ARRAY['gluten','lait','oeufs','moutarde'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Burger poulet yassa croustillant', 'Filet de poulet pané, compotée d''oignons yassa, salade croquante, servi avec frites maison.', 9000, NULL, 'burgers', NULL, true, ARRAY['gluten','oeufs','moutarde'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Burger falafel et tahini', 'Falafel maison, sauce tahini citronnée, crudités, servi avec frites maison.', 8500, NULL, 'burgers', NULL, true, ARRAY['gluten','sesame'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    ('Linguine aux fruits de mer et citron confit', 'Linguine al dente, moules, crevettes, calamars, persil et zeste de citron confit.', 11200, NULL, 'pates', NULL, true, ARRAY['gluten','crustaces'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Penne crème de champignons et parmesan', 'Penne, crème légère, champignons sautés, parmesan affiné et poivre noir.', 9700, NULL, 'pates', NULL, true, ARRAY['gluten','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Tagliatelle au bœuf braisé, sauce tomate piment doux', 'Bœuf mijoté longuement, sauce tomate basilic et tagliatelle fraîches.', 10600, NULL, 'pates', NULL, true, ARRAY['gluten','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    ('Filet de bœuf sauce poivre de Penja', 'Filet de bœuf saisi, sauce poivre de Penja, jus réduit.', 17000, NULL, 'viandes', NULL, true, ARRAY['lait'], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, true),
    ('Côte d''agneau grillée aux herbes fraîches', 'Agneau grillé minute, thym frais, ail confit et jus d''agneau.', 16500, NULL, 'viandes', NULL, true, ARRAY[]::text[], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Entrecôte maturée, sauce chimichurri', 'Entrecôte maturée, sauce herbes fraîches, ail et citron.', 18500, NULL, 'viandes', NULL, true, ARRAY[]::text[], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    ('Suprême de poulet fermier sauce citronnelle', 'Poulet fermier rôti, sauce crémeuse citronnelle et gingembre.', 12600, NULL, 'volailles', NULL, true, ARRAY['lait'], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Coquelet rôti aux épices douces', 'Coquelet entier mariné aux épices maison et rôti lentement.', 13200, NULL, 'volailles', NULL, true, ARRAY[]::text[], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Cordon bleu maison de volaille', 'Volaille farcie au fromage et jambon de dinde, panure croustillante.', 12100, NULL, 'volailles', NULL, true, ARRAY['gluten','lait','oeufs'], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    ('Filet de thiof grillé, beurre citron', 'Thiof frais grillé, beurre citronné et herbes fraîches.', 14500, NULL, 'poissons', NULL, true, ARRAY['poissons','lait'], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Pavé de saumon laqué au gingembre', 'Saumon laqué miel-gingembre, cuisson nacrée.', 15500, NULL, 'poissons', NULL, true, ARRAY['poissons','soja'], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Dorade entière à la braise', 'Dorade entière grillée à la braise, marinade ail-citron.', 16000, NULL, 'poissons', NULL, true, ARRAY['poissons'], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    ('Pizza Margherita Fior di Latte', 'Tomate San Marzano, Fior di Latte, basilic frais.', 9000, NULL, 'pizzas', NULL, true, ARRAY['gluten','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Pizza Reine de Dakar', 'Tomate, mozzarella, jambon de dinde, champignons frais.', 10500, NULL, 'pizzas', NULL, true, ARRAY['gluten','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Pizza Océane', 'Tomate, mozzarella, thon, oignons, olives noires.', 11000, NULL, 'pizzas', NULL, true, ARRAY['gluten','lait','poissons'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Pizza Quatre fromages', 'Mozzarella, parmesan, gorgonzola et emmental.', 11500, NULL, 'pizzas', NULL, true, ARRAY['gluten','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    ('Bissap Mojito', 'Infusion de bissap, citron vert, menthe fraîche et eau pétillante.', 4500, NULL, 'cocktails-sans-alcool', NULL, true, ARRAY[]::text[], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Ginger Passion Spritz', 'Jus de fruit de la passion, gingembre pressé et tonic.', 5000, NULL, 'cocktails-sans-alcool', NULL, true, ARRAY[]::text[], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Tropical coco ananas', 'Lait de coco, jus d''ananas frais et glace pilée.', 4800, NULL, 'cocktails-sans-alcool', NULL, true, ARRAY[]::text[], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Baobab Tonic', 'Pulpe de baobab, tonic premium, zeste d''orange.', 4300, NULL, 'cocktails-sans-alcool', NULL, true, ARRAY[]::text[], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    ('Formule brunch classique', 'Boisson chaude, jus pressé minute, œufs brouillés, viennoiserie artisanale et salade de fruits.', 14500, NULL, 'brunch', 'Formules', true, ARRAY['gluten','oeufs','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Formule brunch signature L''Adresse', 'Boisson chaude, jus pressé, œufs au choix, toast avocat saumon fumé, pancakes et granola maison.', 18500, NULL, 'brunch', 'Formules', true, ARRAY['gluten','oeufs','lait','poissons'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Avocado toast au saumon fumé', 'Pain levain grillé, avocat écrasé, saumon fumé et graines de sésame.', 9000, NULL, 'brunch', 'À la carte', true, ARRAY['gluten','poissons','sesame'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Pancakes banane caramélisée', 'Pancakes moelleux, banane caramélisée et sirop d''érable.', 7800, NULL, 'brunch', 'À la carte', true, ARRAY['gluten','oeufs','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Chakchouka œufs fermiers', 'Tomates mijotées, poivrons, épices douces et œufs fermiers.', 8200, NULL, 'brunch', 'À la carte', true, ARRAY['oeufs'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false)
) AS v(nom, description, prix, photo, cat_slug, sub_name, disponible, allergenes, a_accompagnement, restaurant_id, plat_du_jour)
JOIN cat ON cat.slug = v.cat_slug
LEFT JOIN sub ON sub.nom = v.sub_name
ON CONFLICT (restaurant_id, nom) DO UPDATE SET
  description = EXCLUDED.description,
  prix = EXCLUDED.prix,
  categorie_id = EXCLUDED.categorie_id,
  subcategorie_id = EXCLUDED.subcategorie_id,
  disponible = EXCLUDED.disponible,
  allergenes = EXCLUDED.allergenes,
  a_accompagnement = EXCLUDED.a_accompagnement,
  plat_du_jour = EXCLUDED.plat_du_jour;

-- Seed pizza unique sizes
INSERT INTO public.pizza_sizes (item_id, taille, prix)
SELECT i.id, 'Format unique', i.prix
FROM public.items i
JOIN public.categories c ON c.id = i.categorie_id
WHERE c.slug = 'pizzas' AND i.restaurant_id = '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'
ON CONFLICT DO NOTHING;

-- Seed promotion
INSERT INTO public.promotions (item_id, restaurant_id, type, valeur, date_debut, date_fin, active)
SELECT i.id, i.restaurant_id, 'percent', 10, '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', true
FROM public.items i
WHERE i.nom = 'Formule brunch signature L''Adresse'
  AND i.restaurant_id = '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'
ON CONFLICT DO NOTHING;
