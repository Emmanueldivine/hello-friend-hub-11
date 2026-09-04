CREATE OR REPLACE FUNCTION public.super_admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin');
$$;

REVOKE ALL ON FUNCTION public.super_admin_exists() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_exists() TO anon, authenticated, service_role;