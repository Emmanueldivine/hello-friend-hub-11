ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS real_email text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_real_email_unique ON public.profiles (lower(real_email)) WHERE real_email IS NOT NULL;

CREATE TABLE public.password_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.password_reset_codes TO service_role;
ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;
CREATE INDEX password_reset_codes_user_idx ON public.password_reset_codes (user_id);