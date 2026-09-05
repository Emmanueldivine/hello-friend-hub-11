DELETE FROM public.chat_messages;
DELETE FROM public.chats;
DELETE FROM public.transactions;
DELETE FROM public.wallets;
DELETE FROM public.orders;
DELETE FROM public.assignments;
DELETE FROM public.vendors;
DELETE FROM public.profiles WHERE id NOT IN (SELECT id FROM auth.users);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0;

UPDATE public.profiles SET email = lower(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON public.profiles (lower(email)) WHERE email IS NOT NULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;