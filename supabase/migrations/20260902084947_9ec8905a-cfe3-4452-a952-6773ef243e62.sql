DROP POLICY "vendors public read approved" ON public.vendors;
CREATE POLICY "vendors anon read approved" ON public.vendors FOR SELECT TO anon USING (status = 'approved');
CREATE POLICY "vendors auth read" ON public.vendors FOR SELECT TO authenticated USING (status = 'approved' OR user_id = auth.uid() OR public.is_admin(auth.uid()));

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_super_admin() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_super_admin() TO authenticated, service_role;