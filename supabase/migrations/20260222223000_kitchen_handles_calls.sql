-- Les appels clients sont traités par la cuisine (plus de flux serveur dédié).

DROP POLICY IF EXISTS server_calls_public_select ON public.server_calls;
CREATE POLICY server_calls_public_select ON public.server_calls
FOR SELECT
USING (public.is_staff(ARRAY['cuisine'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type]));

DROP POLICY IF EXISTS server_calls_staff_update ON public.server_calls;
CREATE POLICY server_calls_staff_update ON public.server_calls
FOR UPDATE
USING (public.is_staff(ARRAY['cuisine'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type]))
WITH CHECK (public.is_staff(ARRAY['cuisine'::public.role_type, 'admin'::public.role_type, 'proprio'::public.role_type]));
