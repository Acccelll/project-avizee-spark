-- Restrict profiles SELECT to own profile or admin
DROP POLICY IF EXISTS profiles_select ON public.profiles;

CREATE POLICY profiles_select
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));