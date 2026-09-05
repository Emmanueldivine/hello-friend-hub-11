DELETE FROM public.chat_messages;
DELETE FROM public.chats;
DELETE FROM public.transactions;
DELETE FROM public.wallets;
DELETE FROM public.orders;
DELETE FROM public.profiles WHERE email LIKE '%@example.com' OR email LIKE '%@portal.local';