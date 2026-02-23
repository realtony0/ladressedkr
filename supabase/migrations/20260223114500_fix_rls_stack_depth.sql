-- Fix RLS recursion that caused "stack depth limit exceeded" on public reads
-- (items/tables/promotions) when policies evaluated public.is_staff().

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.role_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_restaurant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_staff(allowed public.role_type[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_role() = ANY(allowed), false);
$$;
