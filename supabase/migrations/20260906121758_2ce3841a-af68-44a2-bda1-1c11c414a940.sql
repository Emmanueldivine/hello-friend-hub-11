
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin'));
$$;

CREATE OR REPLACE FUNCTION private.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION private.has_permission(_user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.is_super_admin(_user_id)
      OR EXISTS (SELECT 1 FROM public.admin_permissions WHERE admin_id = _user_id AND permission = _permission);
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_permission(uuid, text) TO authenticated, service_role;

-- admin_permissions
DROP POLICY IF EXISTS "perm read" ON public.admin_permissions;
CREATE POLICY "perm read" ON public.admin_permissions FOR SELECT TO authenticated
  USING (admin_id = auth.uid() OR private.is_admin(auth.uid()));
DROP POLICY IF EXISTS "perm super write" ON public.admin_permissions;
CREATE POLICY "perm super write" ON public.admin_permissions FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid())) WITH CHECK (private.is_super_admin(auth.uid()));

-- assignments
DROP POLICY IF EXISTS "assignments admin delete" ON public.assignments;
CREATE POLICY "assignments admin delete" ON public.assignments FOR DELETE TO authenticated
  USING (private.is_admin(auth.uid()));
DROP POLICY IF EXISTS "assignments vendor update" ON public.assignments;
CREATE POLICY "assignments vendor update" ON public.assignments FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = assignments.vendor_id AND v.user_id = auth.uid()));
DROP POLICY IF EXISTS "assignments vendor write" ON public.assignments;
CREATE POLICY "assignments vendor write" ON public.assignments FOR INSERT TO authenticated
  WITH CHECK (private.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = assignments.vendor_id AND v.user_id = auth.uid()));

-- chat_messages
DROP POLICY IF EXISTS "messages insert" ON public.chat_messages;
CREATE POLICY "messages insert" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() OR private.is_admin(auth.uid()));
DROP POLICY IF EXISTS "messages read" ON public.chat_messages;
CREATE POLICY "messages read" ON public.chat_messages FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.chats c WHERE c.id = chat_messages.chat_id AND (
      c.student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = c.vendor_id AND v.user_id = auth.uid())
    )));

-- chats
DROP POLICY IF EXISTS "chats insert" ON public.chats;
CREATE POLICY "chats insert" ON public.chats FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() OR private.is_admin(auth.uid()));
DROP POLICY IF EXISTS "chats read" ON public.chats;
CREATE POLICY "chats read" ON public.chats FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR private.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = chats.vendor_id AND v.user_id = auth.uid()));
DROP POLICY IF EXISTS "chats update" ON public.chats;
CREATE POLICY "chats update" ON public.chats FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid()) OR student_id = auth.uid())
  WITH CHECK (private.is_admin(auth.uid()) OR student_id = auth.uid());
DROP POLICY IF EXISTS "chats admin delete" ON public.chats;
CREATE POLICY "chats admin delete" ON public.chats FOR DELETE TO authenticated
  USING (private.is_admin(auth.uid()));

-- orders
DROP POLICY IF EXISTS "orders admin delete" ON public.orders;
CREATE POLICY "orders admin delete" ON public.orders FOR DELETE TO authenticated
  USING (private.is_admin(auth.uid()));
DROP POLICY IF EXISTS "orders insert own" ON public.orders;
CREATE POLICY "orders insert own" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() OR private.is_admin(auth.uid()));
DROP POLICY IF EXISTS "orders read own" ON public.orders;
CREATE POLICY "orders read own" ON public.orders FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR private.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = orders.vendor_id AND v.user_id = auth.uid()));
DROP POLICY IF EXISTS "orders update" ON public.orders;
CREATE POLICY "orders update" ON public.orders FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = orders.vendor_id AND v.user_id = auth.uid()));

-- profiles
DROP POLICY IF EXISTS "profiles admin delete" ON public.profiles;
CREATE POLICY "profiles admin delete" ON public.profiles FOR DELETE TO authenticated
  USING (private.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "profiles self insert" ON public.profiles;
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR private.is_admin(auth.uid()));
DROP POLICY IF EXISTS "profiles self read" ON public.profiles;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.is_admin(auth.uid()));
DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR private.is_admin(auth.uid())) WITH CHECK (id = auth.uid() OR private.is_admin(auth.uid()));

-- transactions
DROP POLICY IF EXISTS "tx admin write" ON public.transactions;
CREATE POLICY "tx admin write" ON public.transactions FOR ALL TO authenticated
  USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
DROP POLICY IF EXISTS "tx read" ON public.transactions;
CREATE POLICY "tx read" ON public.transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS "roles self read" ON public.user_roles;
CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid()));
DROP POLICY IF EXISTS "roles super admin delete" ON public.user_roles;
CREATE POLICY "roles super admin delete" ON public.user_roles FOR DELETE TO authenticated
  USING (private.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "roles super admin update" ON public.user_roles;
CREATE POLICY "roles super admin update" ON public.user_roles FOR UPDATE TO authenticated
  USING (private.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "roles super admin write" ON public.user_roles;
CREATE POLICY "roles super admin write" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin(auth.uid()));

-- vendors: no more anonymous access to the directory
DROP POLICY IF EXISTS "vendors anon read approved" ON public.vendors;
REVOKE SELECT ON public.vendors FROM anon;
DROP POLICY IF EXISTS "vendors admin delete" ON public.vendors;
CREATE POLICY "vendors admin delete" ON public.vendors FOR DELETE TO authenticated
  USING (private.is_admin(auth.uid()));
DROP POLICY IF EXISTS "vendors auth read" ON public.vendors;
CREATE POLICY "vendors auth read" ON public.vendors FOR SELECT TO authenticated
  USING (status = 'approved'::public.vendor_status OR user_id = auth.uid() OR private.is_admin(auth.uid()));
DROP POLICY IF EXISTS "vendors update" ON public.vendors;
CREATE POLICY "vendors update" ON public.vendors FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid())) WITH CHECK (user_id = auth.uid() OR private.is_admin(auth.uid()));

-- wallets
DROP POLICY IF EXISTS "wallets admin write" ON public.wallets;
CREATE POLICY "wallets admin write" ON public.wallets FOR ALL TO authenticated
  USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
DROP POLICY IF EXISTS "wallets read" ON public.wallets;
CREATE POLICY "wallets read" ON public.wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid()));

-- remove the publicly callable definer functions
DROP FUNCTION IF EXISTS public.has_permission(uuid, text);
DROP FUNCTION IF EXISTS public.is_admin(uuid);
DROP FUNCTION IF EXISTS public.is_super_admin(uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.claim_super_admin();
DROP FUNCTION IF EXISTS public.super_admin_exists();
