CREATE POLICY "admins read final files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'order-final-files' AND private.is_admin(auth.uid()));

CREATE POLICY "admins upload final files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'order-final-files' AND private.is_admin(auth.uid()));

CREATE POLICY "admins update final files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'order-final-files' AND private.is_admin(auth.uid()));

CREATE POLICY "admins delete final files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'order-final-files' AND private.is_admin(auth.uid()));