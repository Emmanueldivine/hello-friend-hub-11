DO $$
DECLARE sid uuid;
BEGIN
  SELECT id INTO sid FROM public.profiles WHERE email = 'chidi.test@example.com';
  IF sid IS NOT NULL THEN
    DELETE FROM public.chat_messages WHERE chat_id IN (SELECT id FROM public.chats WHERE student_id = sid);
    DELETE FROM public.chats WHERE student_id = sid;
    DELETE FROM public.transactions WHERE user_id = sid;
    DELETE FROM public.wallets WHERE user_id = sid;
    DELETE FROM public.orders WHERE student_id = sid;
    DELETE FROM public.profiles WHERE id = sid;
  END IF;
END $$;