-- Harden table QR access tokens and lock down anonymous access to sensitive tables.

ALTER TABLE public.tables
ADD COLUMN IF NOT EXISTS access_token TEXT;

UPDATE public.tables
SET access_token = replace(gen_random_uuid()::text, '-', '')
WHERE access_token IS NULL OR btrim(access_token) = '';

ALTER TABLE public.tables
ALTER COLUMN access_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tables_restaurant_access_token
ON public.tables(restaurant_id, access_token);

UPDATE public.tables
SET qr_code = CASE
  WHEN position('access=' in qr_code) > 0 THEN qr_code
  WHEN position('?' in qr_code) > 0 THEN qr_code || '&access=' || access_token
  ELSE qr_code || '?access=' || access_token
END
WHERE qr_code IS NOT NULL
  AND btrim(qr_code) <> '';

-- Orders and order lines: no anonymous reads, staff only in their own restaurant.
DROP POLICY IF EXISTS orders_public_select ON public.orders;

DROP POLICY IF EXISTS orders_staff_manage ON public.orders;
CREATE POLICY orders_staff_manage ON public.orders
FOR ALL
USING (
  public.is_staff(ARRAY['cuisine'::public.role_type, 'serveur'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type])
  AND restaurant_id = public.current_restaurant_id()
)
WITH CHECK (
  public.is_staff(ARRAY['cuisine'::public.role_type, 'serveur'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type])
  AND restaurant_id = public.current_restaurant_id()
);

DROP POLICY IF EXISTS order_items_public_select ON public.order_items;

DROP POLICY IF EXISTS order_items_staff_manage ON public.order_items;
CREATE POLICY order_items_staff_manage ON public.order_items
FOR ALL
USING (
  public.is_staff(ARRAY['cuisine'::public.role_type, 'serveur'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type])
  AND EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_items.order_id
      AND orders.restaurant_id = public.current_restaurant_id()
  )
)
WITH CHECK (
  public.is_staff(ARRAY['cuisine'::public.role_type, 'serveur'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type])
  AND EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_items.order_id
      AND orders.restaurant_id = public.current_restaurant_id()
  )
);

-- Server calls: no anonymous direct inserts/selects. Staff sees/updates only own restaurant rows.
DROP POLICY IF EXISTS server_calls_public_insert ON public.server_calls;
CREATE POLICY server_calls_public_insert ON public.server_calls
FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS server_calls_public_select ON public.server_calls;
CREATE POLICY server_calls_public_select ON public.server_calls
FOR SELECT
USING (
  public.is_staff(ARRAY['cuisine'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type])
  AND restaurant_id = public.current_restaurant_id()
);

DROP POLICY IF EXISTS server_calls_staff_update ON public.server_calls;
CREATE POLICY server_calls_staff_update ON public.server_calls
FOR UPDATE
USING (
  public.is_staff(ARRAY['cuisine'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type])
  AND restaurant_id = public.current_restaurant_id()
)
WITH CHECK (
  public.is_staff(ARRAY['cuisine'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type])
  AND restaurant_id = public.current_restaurant_id()
);

-- Ratings: no anonymous direct inserts/selects. Staff reads only ratings tied to own restaurant orders.
DROP POLICY IF EXISTS ratings_public_insert ON public.ratings;
CREATE POLICY ratings_public_insert ON public.ratings
FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS ratings_staff_select ON public.ratings;
CREATE POLICY ratings_staff_select ON public.ratings
FOR SELECT
USING (
  public.is_staff(ARRAY['cuisine'::public.role_type, 'serveur'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type])
  AND EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = ratings.order_id
      AND orders.restaurant_id = public.current_restaurant_id()
  )
);
