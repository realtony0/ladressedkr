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
-- SECURITY DEFINER bypasses RLS when querying public.users, preventing infinite recursion
-- (policies on users call is_staff which would re-trigger users RLS without this)
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.role_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_restaurant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_staff(allowed public.role_type[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

DROP POLICY IF EXISTS orders_public_insert ON public.orders;
CREATE POLICY orders_public_insert ON public.orders
FOR INSERT
WITH CHECK (true);

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

DROP POLICY IF EXISTS order_items_public_insert ON public.order_items;
CREATE POLICY order_items_public_insert ON public.order_items
FOR INSERT
WITH CHECK (true);

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
  'Rond-point Ngor, Dakar'
)
ON CONFLICT (id) DO UPDATE SET
  nom = EXCLUDED.nom,
  adresse = EXCLUDED.adresse;

-- Seed tables 1..20
INSERT INTO public.tables (numero, qr_code, statut, restaurant_id)
SELECT gs.numero,
       format('https://ladressedkr.vercel.app/%s', gs.numero),
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
  ('Cocktails sans alcool', 'cocktails-sans-alcool', 'GlassWater', 8, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55')
ON CONFLICT (restaurant_id, slug) DO UPDATE SET
  nom = EXCLUDED.nom,
  icone = EXCLUDED.icone,
  ordre = EXCLUDED.ordre;

-- Seed subcategories (pizza bases + cocktail families)
INSERT INTO public.subcategories (nom, ordre, categorie_id, restaurant_id)
SELECT v.nom, v.ordre, c.id, c.restaurant_id
FROM (
  VALUES
    ('Base tomate', 1, 'pizzas'),
    ('Base crème fraîche', 2, 'pizzas'),
    ('Virgins', 1, 'cocktails-sans-alcool'),
    ('Cocktails', 2, 'cocktails-sans-alcool')
) AS v(nom, ordre, cat_slug)
JOIN public.categories c
  ON c.slug = v.cat_slug AND c.restaurant_id = '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'
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
    -- Entrées & Salades
    ('Salade César', 'Poulet crispy, copeaux de parmesan, croûtons dorés, sauce césar maison.', 7000, 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&w=800&q=70', 'entrees-salades', NULL, true, ARRAY['gluten','lait','oeufs','poissons'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Salade Douceur de Chèvre', 'Fromage de chèvre chaud légèrement gratiné, miel et noix torréfiées.', 7000, 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&w=800&q=70', 'entrees-salades', NULL, true, ARRAY['lait','fruits-a-coque'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Salade Rivera', 'Avocat frais, crevettes marinées au citron et aux herbes fraîches.', 7500, 'https://images.unsplash.com/photo-1551248429-40975aa4de74?auto=format&fit=crop&w=800&q=70', 'entrees-salades', NULL, true, ARRAY['crustaces'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Salade Nordic Green', 'Saumon grillé, avocat, vinaigrette légère au citron.', 8000, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=70', 'entrees-salades', NULL, true, ARRAY['poissons'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Tartare de Saumon', 'Saumon cru citronné finement taillé, touche d''huile d''olive.', 8500, 'https://images.unsplash.com/photo-1656106577512-0259bf5b9fd6?auto=format&fit=crop&w=800&q=70', 'entrees-salades', NULL, true, ARRAY['poissons'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Pastels maison', 'Pastels maison farcis à la viande, sauce relevée.', 4500, 'https://images.unsplash.com/photo-1666190091090-1d312a4b04c2?auto=format&fit=crop&w=800&q=70', 'entrees-salades', NULL, true, ARRAY['gluten'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Avocado Bowl', 'Avocat en tranches, crevettes sautées, vinaigrette citronnée et herbes fraîches.', 7500, 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&w=800&q=70', 'entrees-salades', NULL, true, ARRAY['crustaces'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Samosas Dorés au Bœuf', 'Samosas maison farcis au bœuf et épices douces.', 5000, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=70', 'entrees-salades', NULL, true, ARRAY['gluten'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    -- Burgers (servis avec frites maison)
    ('Burger Chicken Avocado', 'Poulet pané, avocat, sauce blanche, servi avec frites maison.', 8500, 'https://images.unsplash.com/photo-1610970878459-a0e464d7592b?auto=format&fit=crop&w=800&q=70', 'burgers', NULL, true, ARRAY['gluten','lait','oeufs'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Burger Steak Cheddar', 'Steak haché, cheddar, bacon, oignons caramélisés, servi avec frites maison.', 8000, 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=70', 'burgers', NULL, true, ARRAY['gluten','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Burger Classique', 'Steak 150 g, fromage, crudités, sauce maison, servi avec frites maison.', 7000, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=70', 'burgers', NULL, true, ARRAY['gluten','lait','oeufs'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    -- Pâtes
    ('Tagliatelle Carbonara', 'Tagliatelles fraîches nappées d''une sauce crémeuse, lardons dorés et parmesan affiné.', 8000, 'https://images.unsplash.com/photo-1612966893103-790e549a2ab1?auto=format&fit=crop&w=800&q=70', 'pates', NULL, true, ARRAY['gluten','lait','oeufs'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Penne Poulet Champignons', 'Penne, émincé de poulet, champignons sautés et crème onctueuse, parmesan râpé.', 7500, 'https://images.unsplash.com/photo-1556761223-4c4282c73f77?auto=format&fit=crop&w=800&q=70', 'pates', NULL, true, ARRAY['gluten','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Penne Saumon Crémeux', 'Penne accompagnées de saumon fondant, sauce crémeuse parfumée au citron et à l''aneth.', 9000, 'https://images.unsplash.com/photo-1551892374-ecf8754cf8b0?auto=format&fit=crop&w=800&q=70', 'pates', NULL, true, ARRAY['gluten','lait','poissons'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Lasagnes Maison', 'Feuilles de lasagnes, viande mijotée maison, béchamel onctueuse et fromage gratiné.', 8000, 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?auto=format&fit=crop&w=800&q=70', 'pates', NULL, true, ARRAY['gluten','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    -- Viandes
    ('Entrecôte du Grill', 'Entrecôte de bœuf grillée, accompagnée d''une sauce au choix.', 14000, 'https://images.unsplash.com/photo-1508615263227-c5d58c1e5821?auto=format&fit=crop&w=800&q=70', 'viandes', NULL, true, ARRAY[]::text[], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Faux-Filet de Bœuf Grillé', 'Faux-filet tendre et juteux, grillé au feu vif pour préserver toutes ses saveurs.', 12500, 'https://images.unsplash.com/photo-1633436375795-12b3b339712f?auto=format&fit=crop&w=800&q=70', 'viandes', NULL, true, ARRAY[]::text[], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Filet Mignon de Bœuf', 'Pièce noble de bœuf délicatement saisie, reconnue pour sa tendreté exceptionnelle.', 16000, 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=70', 'viandes', NULL, true, ARRAY[]::text[], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Bœuf Effiloché Confit', 'Bœuf longuement mijoté à basse température, effiloché, nappé d''une sauce réduite et savoureuse.', 11500, 'https://images.unsplash.com/photo-1594041680534-e8c8cdebd659?auto=format&fit=crop&w=800&q=70', 'viandes', NULL, true, ARRAY[]::text[], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    -- Volailles
    ('Cordon Bleu Maison', 'Volaille panée, fromage fondant et jambon.', 9500, 'https://images.unsplash.com/photo-1652545296821-09a023a9fd08?auto=format&fit=crop&w=800&q=70', 'volailles', NULL, true, ARRAY['gluten','lait','oeufs'], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Escalope Gratinée', 'Escalope de volaille, jambon et fromage gratiné.', 9000, 'https://images.unsplash.com/photo-1585325701956-60dd9c8553bc?auto=format&fit=crop&w=800&q=70', 'volailles', NULL, true, ARRAY['lait'], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    -- Poissons
    ('Poisson Braisé du Jour', 'Poisson frais selon arrivage (Capitaine, Dorade ou Thiof), délicatement braisé.', 13000, 'https://images.unsplash.com/photo-1600699899970-b1c9fadd8f9e?auto=format&fit=crop&w=800&q=70', 'poissons', NULL, true, ARRAY['poissons'], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, true),
    ('Pavé de Saumon Grillé', 'Pavé de saumon grillé, nappé d''une sauce fraîche au citron et à l''aneth ou d''une sauce onctueuse aux échalotes finement ciselées.', 13000, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=70', 'poissons', NULL, true, ARRAY['poissons','lait'], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Saumon Teriyaki', 'Saumon laqué à la sauce teriyaki, servi avec riz parfumé et légumes sautés croquants.', 14000, 'https://images.unsplash.com/photo-1560717845-968823efbee1?auto=format&fit=crop&w=800&q=70', 'poissons', NULL, true, ARRAY['poissons','soja','gluten'], true, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    -- Pizzas base tomate
    ('Pizza Margherita', 'Sauce tomate, mozzarella, origan.', 5000, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=70', 'pizzas', 'Base tomate', true, ARRAY['gluten','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Pizza Beef Lover', 'Sauce tomate, mozzarella, pepperoni.', 7000, 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=800&q=70', 'pizzas', 'Base tomate', true, ARRAY['gluten','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Pizza Golden BBQ', 'Sauce BBQ, mozzarella, poulet grillé, oignons.', 7000, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=70', 'pizzas', 'Base tomate', true, ARRAY['gluten','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Pizza La Capri', 'Sauce tomate, mozzarella, thon, olives, oignons.', 6500, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=70', 'pizzas', 'Base tomate', true, ARRAY['gluten','lait','poissons'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Pizza Végétarienne', 'Sauce tomate, mozzarella, légumes frais.', 6000, 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=800&q=70', 'pizzas', 'Base tomate', true, ARRAY['gluten','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Pizza Dibi – Signature', 'Sauce tomate, mozzarella, viande de dibi, oignons.', 8000, 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=800&q=70', 'pizzas', 'Base tomate', true, ARRAY['gluten','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    -- Pizzas base crème fraîche
    ('Pizza Chèvre Miel', 'Base crème, mozzarella, fromage de chèvre, miel.', 7500, 'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=800&q=70', 'pizzas', 'Base crème fraîche', true, ARRAY['gluten','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Pizza Amalfi', 'Base crème, mozzarella, burrata, roquette.', 8000, 'https://images.unsplash.com/photo-1594007654729-407eedc4be65?auto=format&fit=crop&w=800&q=70', 'pizzas', 'Base crème fraîche', true, ARRAY['gluten','lait'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Pizza Bella Mare', 'Base crème, mozzarella, crevettes.', 7500, 'https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?auto=format&fit=crop&w=800&q=70', 'pizzas', 'Base crème fraîche', true, ARRAY['gluten','lait','crustaces'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Pizza Norvégienne', 'Base crème, mozzarella, saumon.', 7500, 'https://images.unsplash.com/photo-1571066811602-716837d681de?auto=format&fit=crop&w=800&q=70', 'pizzas', 'Base crème fraîche', true, ARRAY['gluten','lait','poissons'], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    -- Créations du Bar : Virgins
    ('Virgin Mojito Classique', 'Menthe fraîche, citron vert, sucre de canne, eau pétillante.', 4000, 'https://images.unsplash.com/photo-1654074517750-f854f7c27d62?auto=format&fit=crop&w=800&q=70', 'cocktails-sans-alcool', 'Virgins', true, ARRAY[]::text[], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Virgin Mojito Passion', 'Menthe fraîche, fruit de la passion, citron vert, eau pétillante.', 4500, 'https://images.unsplash.com/photo-1595977514600-72cbc8376c38?auto=format&fit=crop&w=800&q=70', 'cocktails-sans-alcool', 'Virgins', true, ARRAY[]::text[], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Virgin Mojito Fraise', 'Menthe fraîche, fraise, citron vert, eau pétillante.', 4500, 'https://images.unsplash.com/photo-1634496064950-02f043806b09?auto=format&fit=crop&w=800&q=70', 'cocktails-sans-alcool', 'Virgins', true, ARRAY[]::text[], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Virgin Spritz Chic', 'Jus d''orange frais, bitter sans alcool, eau pétillante.', 4500, 'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?auto=format&fit=crop&w=800&q=70', 'cocktails-sans-alcool', 'Virgins', true, ARRAY[]::text[], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),

    -- Créations du Bar : Cocktails
    ('Passion Fizz', 'Fruit de la passion, citron vert, eau pétillante.', 5000, 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?auto=format&fit=crop&w=800&q=70', 'cocktails-sans-alcool', 'Cocktails', true, ARRAY[]::text[], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Ginger Lemon', 'Citron pressé, ginger beer, sucre léger.', 5000, 'https://images.unsplash.com/photo-1654074518423-750767f571a9?auto=format&fit=crop&w=800&q=70', 'cocktails-sans-alcool', 'Cocktails', true, ARRAY[]::text[], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Virgin Piña Colada', 'Ananas frais, lait de coco, glace pilée.', 5500, 'https://images.unsplash.com/photo-1610515660473-c11d4f3f7d37?auto=format&fit=crop&w=800&q=70', 'cocktails-sans-alcool', 'Cocktails', true, ARRAY[]::text[], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false),
    ('Red Velvet', 'Fraise, framboise, citron, touche de vanille.', 5500, 'https://images.unsplash.com/photo-1661942477265-c6e3fbebb714?auto=format&fit=crop&w=800&q=70', 'cocktails-sans-alcool', 'Cocktails', true, ARRAY[]::text[], false, '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid, false)
) AS v(nom, description, prix, photo, cat_slug, sub_name, disponible, allergenes, a_accompagnement, restaurant_id, plat_du_jour)
JOIN cat ON cat.slug = v.cat_slug
LEFT JOIN sub ON sub.nom = v.sub_name
ON CONFLICT (restaurant_id, nom) DO UPDATE SET
  description = EXCLUDED.description,
  prix = EXCLUDED.prix,
  photo = EXCLUDED.photo,
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

-- No active promotion seeded with the current carte.

-- Reservations (vitrine en ligne)
DO $$ BEGIN
  CREATE TYPE public.reservation_status AS ENUM ('pending', 'confirmed', 'declined', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  telephone TEXT NOT NULL,
  email TEXT,
  date_reservation DATE NOT NULL,
  heure TIME NOT NULL,
  nb_personnes INT NOT NULL CHECK (nb_personnes > 0),
  message TEXT,
  statut public.reservation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservations_restaurant ON public.reservations(restaurant_id, date_reservation);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reservations_public_insert ON public.reservations;
CREATE POLICY reservations_public_insert ON public.reservations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS reservations_staff_select ON public.reservations;
CREATE POLICY reservations_staff_select ON public.reservations FOR SELECT
USING (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type, 'serveur'::public.role_type]));

DROP POLICY IF EXISTS reservations_staff_update ON public.reservations;
CREATE POLICY reservations_staff_update ON public.reservations FOR UPDATE
USING (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type, 'serveur'::public.role_type]))
WITH CHECK (public.is_staff(ARRAY['admin'::public.role_type, 'proprio'::public.role_type, 'serveur'::public.role_type]));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reservations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
    END IF;
  END IF;
END;
$$;
