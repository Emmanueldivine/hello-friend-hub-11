-- ENUMS
CREATE TYPE public.app_role AS ENUM ('student','vendor','admin','super_admin');
CREATE TYPE public.order_status AS ENUM ('pending','in_progress','under_review','completed','cancelled');
CREATE TYPE public.vendor_status AS ENUM ('pending','approved','rejected','suspended');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL DEFAULT 'Unnamed user',
  email text,
  school text,
  avatar_url text,
  phone text,
  banned boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin'));
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.claim_super_admin()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN 'unauthenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN RETURN 'exists'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN 'granted';
END;
$$;

CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles admin delete" ON public.profiles FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "roles super admin write" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "roles super admin update" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "roles super admin delete" ON public.user_roles FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

-- ADMIN PERMISSIONS
CREATE TABLE public.admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_id, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_permissions TO authenticated;
GRANT ALL ON public.admin_permissions TO service_role;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm read" ON public.admin_permissions FOR SELECT TO authenticated USING (admin_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "perm super write" ON public.admin_permissions FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id)
      OR EXISTS (SELECT 1 FROM public.admin_permissions WHERE admin_id = _user_id AND permission = _permission);
$$;

-- VENDORS
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_name text NOT NULL,
  bio text,
  status public.vendor_status NOT NULL DEFAULT 'pending',
  rating numeric(3,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT SELECT ON public.vendors TO anon;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendors public read approved" ON public.vendors FOR SELECT USING (status = 'approved' OR user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "vendors self insert" ON public.vendors FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "vendors update" ON public.vendors FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "vendors admin delete" ON public.vendors FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ASSIGNMENTS
CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category text,
  course_code text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT SELECT ON public.assignments TO anon;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments public read" ON public.assignments FOR SELECT USING (true);
CREATE POLICY "assignments vendor write" ON public.assignments FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()));
CREATE POLICY "assignments vendor update" ON public.assignments FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()));
CREATE POLICY "assignments admin delete" ON public.assignments FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ORDERS
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL DEFAULT ('UH' || to_char(now(),'YYMMDD') || lpad((floor(random()*100000))::int::text, 5, '0')),
  student_id uuid,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Assignment order',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  commission numeric(12,2) NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders read own" ON public.orders FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()));
CREATE POLICY "orders insert own" ON public.orders FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "orders update" ON public.orders FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()));
CREATE POLICY "orders admin delete" ON public.orders FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- WALLETS
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets read" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "wallets admin write" ON public.wallets FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  reference text NOT NULL DEFAULT ('PSK-' || substr(md5(random()::text), 1, 10)),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'payment',
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx read" ON public.transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "tx admin write" ON public.transactions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- CHATS
CREATE TABLE public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  student_id uuid,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  subject text NOT NULL DEFAULT 'Conversation',
  is_dispute boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO authenticated;
GRANT ALL ON public.chats TO service_role;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chats read" ON public.chats FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()));
CREATE POLICY "chats insert" ON public.chats FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "chats update" ON public.chats FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id uuid,
  sender_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages read" ON public.chat_messages FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_id AND (c.student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = c.vendor_id AND v.user_id = auth.uid()))));
CREATE POLICY "messages insert" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() OR public.is_admin(auth.uid()));

-- DEMO DATA
INSERT INTO public.profiles (id, full_name, email, school, created_at, last_seen_at) VALUES
 ('11111111-1111-4111-8111-000000000001','Adaeze Okafor','adaeze@example.com','University of Lagos', now() - interval '40 days', now()),
 ('11111111-1111-4111-8111-000000000002','Ibrahim Musa','ibrahim@example.com','Ahmadu Bello University', now() - interval '28 days', now() - interval '3 hours'),
 ('11111111-1111-4111-8111-000000000003','Chiamaka Eze','chiamaka@example.com','University of Nigeria, Nsukka', now() - interval '20 days', now() - interval '1 day'),
 ('11111111-1111-4111-8111-000000000004','Tunde Bakare','tunde@example.com','Obafemi Awolowo University', now() - interval '12 days', now()),
 ('11111111-1111-4111-8111-000000000005','Fatima Bello','fatima@example.com','Bayero University Kano', now() - interval '6 days', now() - interval '10 days'),
 ('22222222-2222-4222-8222-000000000001','Chukwuemeka Obi','emeka@example.com','University of Lagos', now() - interval '50 days', now()),
 ('22222222-2222-4222-8222-000000000002','Grace Nwosu','grace@example.com','Covenant University', now() - interval '45 days', now() - interval '2 hours'),
 ('22222222-2222-4222-8222-000000000003','David Adeyemi','david@example.com','University of Ibadan', now() - interval '30 days', now() - interval '5 days');

INSERT INTO public.user_roles (user_id, role) VALUES
 ('11111111-1111-4111-8111-000000000001','student'),
 ('11111111-1111-4111-8111-000000000002','student'),
 ('11111111-1111-4111-8111-000000000003','student'),
 ('11111111-1111-4111-8111-000000000004','student'),
 ('11111111-1111-4111-8111-000000000005','student'),
 ('22222222-2222-4222-8222-000000000001','vendor'),
 ('22222222-2222-4222-8222-000000000002','vendor'),
 ('22222222-2222-4222-8222-000000000003','vendor');

INSERT INTO public.vendors (id, user_id, business_name, bio, status, rating, created_at) VALUES
 ('33333333-3333-4333-8333-000000000001','22222222-2222-4222-8222-000000000001','Emeka Media Works','Mass communication research and analysis','approved',4.9, now() - interval '50 days'),
 ('33333333-3333-4333-8333-000000000002','22222222-2222-4222-8222-000000000002','Grace Business Desk','Business, economics and accounting support','approved',4.8, now() - interval '45 days'),
 ('33333333-3333-4333-8333-000000000003','22222222-2222-4222-8222-000000000003','David Science Lab','Anatomy, biology and lab reports','pending',0, now() - interval '3 days');

INSERT INTO public.assignments (id, vendor_id, title, description, category, course_code, price, created_at) VALUES
 ('44444444-4444-4444-8444-000000000001','33333333-3333-4333-8333-000000000001','Social Media and Radio Listenership','Field research and analysis write-up','Mass Communication','MAC 401',28000, now() - interval '30 days'),
 ('44444444-4444-4444-8444-000000000002','33333333-3333-4333-8333-000000000002','Fuel Subsidy and Small Businesses','Economics term paper with data','Economics','ECO 302',35000, now() - interval '25 days'),
 ('44444444-4444-4444-8444-000000000003','33333333-3333-4333-8333-000000000003','Thoracic Organs Practical Report','Anatomy practical report with diagrams','Science','ANA 304',18000, now() - interval '18 days'),
 ('44444444-4444-4444-8444-000000000004','33333333-3333-4333-8333-000000000002','Accounting Ratio Analysis Project','Full ratio analysis of a listed company','Accounting','ACC 305',22000, now() - interval '9 days'),
 ('44444444-4444-4444-8444-000000000005','33333333-3333-4333-8333-000000000001','Broadcast Script Writing Task','Radio documentary script','Mass Communication','MAC 312',15000, now() - interval '2 days');

INSERT INTO public.orders (id, student_id, vendor_id, assignment_id, title, amount, commission, status, created_at) VALUES
 ('55555555-5555-4555-8555-000000000001','11111111-1111-4111-8111-000000000001','33333333-3333-4333-8333-000000000001','44444444-4444-4444-8444-000000000001','Social Media and Radio Listenership',28000,2800,'in_progress', now() - interval '6 days'),
 ('55555555-5555-4555-8555-000000000002','11111111-1111-4111-8111-000000000002','33333333-3333-4333-8333-000000000003','44444444-4444-4444-8444-000000000003','Thoracic Organs Practical Report',18000,1800,'pending', now() - interval '5 days'),
 ('55555555-5555-4555-8555-000000000003','11111111-1111-4111-8111-000000000003','33333333-3333-4333-8333-000000000002','44444444-4444-4444-8444-000000000002','Fuel Subsidy and Small Businesses',35000,3500,'completed', now() - interval '4 days'),
 ('55555555-5555-4555-8555-000000000004','11111111-1111-4111-8111-000000000004','33333333-3333-4333-8333-000000000002','44444444-4444-4444-8444-000000000004','Accounting Ratio Analysis Project',22000,2200,'under_review', now() - interval '3 days'),
 ('55555555-5555-4555-8555-000000000005','11111111-1111-4111-8111-000000000005','33333333-3333-4333-8333-000000000001','44444444-4444-4444-8444-000000000005','Broadcast Script Writing Task',15000,1500,'completed', now() - interval '2 days'),
 ('55555555-5555-4555-8555-000000000006','11111111-1111-4111-8111-000000000001','33333333-3333-4333-8333-000000000002','44444444-4444-4444-8444-000000000002','Fuel Subsidy follow-up chapter',30000,3000,'completed', now() - interval '1 day'),
 ('55555555-5555-4555-8555-000000000007','11111111-1111-4111-8111-000000000003','33333333-3333-4333-8333-000000000001','44444444-4444-4444-8444-000000000001','Listenership survey part two',26000,2600,'pending', now());

INSERT INTO public.wallets (user_id, balance) VALUES
 ('22222222-2222-4222-8222-000000000001','58500'),
 ('22222222-2222-4222-8222-000000000002','76300'),
 ('11111111-1111-4111-8111-000000000001','4200');

INSERT INTO public.transactions (user_id, order_id, amount, type, status, created_at)
SELECT o.student_id, o.id, o.amount, 'payment', CASE WHEN o.status = 'pending' THEN 'pending' ELSE 'success' END, o.created_at FROM public.orders o;

INSERT INTO public.chats (id, order_id, student_id, vendor_id, subject, is_dispute, status, created_at) VALUES
 ('66666666-6666-4666-8666-000000000001','55555555-5555-4555-8555-000000000002','11111111-1111-4111-8111-000000000002','33333333-3333-4333-8333-000000000003','Late delivery on anatomy report', true,'open', now() - interval '2 days'),
 ('66666666-6666-4666-8666-000000000002','55555555-5555-4555-8555-000000000001','11111111-1111-4111-8111-000000000001','33333333-3333-4333-8333-000000000001','Clarifying survey sample size', false,'open', now() - interval '1 day');

INSERT INTO public.chat_messages (chat_id, sender_name, body, created_at) VALUES
 ('66666666-6666-4666-8666-000000000001','Ibrahim Musa','The report was due yesterday and I have not received anything.', now() - interval '2 days'),
 ('66666666-6666-4666-8666-000000000001','David Adeyemi','Apologies, the diagrams took longer. Sending tonight.', now() - interval '1 day'),
 ('66666666-6666-4666-8666-000000000002','Adaeze Okafor','Should the sample size be 120 or 150 respondents?', now() - interval '1 day'),
 ('66666666-6666-4666-8666-000000000002','Chukwuemeka Obi','150 gives a stronger confidence level. I will use that.', now() - interval '20 hours');