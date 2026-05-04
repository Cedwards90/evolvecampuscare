
-- New destination type enum-ish via text + check
ALTER TABLE public.qr_codes
  ADD COLUMN IF NOT EXISTS destination_type text NOT NULL DEFAULT 'request',
  ADD COLUMN IF NOT EXISTS destination_url text NULL,
  ADD COLUMN IF NOT EXISTS title text NULL,
  ADD COLUMN IF NOT EXISTS description text NULL,
  ADD COLUMN IF NOT EXISTS prefill_category public.request_category NULL;

DO $$ BEGIN
  ALTER TABLE public.qr_codes
    ADD CONSTRAINT qr_codes_destination_type_check
    CHECK (destination_type IN ('request','meeting','external'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: title from label where missing
UPDATE public.qr_codes SET title = label WHERE title IS NULL;
