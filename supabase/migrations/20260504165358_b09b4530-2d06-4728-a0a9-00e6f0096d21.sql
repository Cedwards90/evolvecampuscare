ALTER TABLE public.support_requests REPLICA IDENTITY FULL;
ALTER TABLE public.request_updates REPLICA IDENTITY FULL;
ALTER TABLE public.request_attachments REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.request_updates;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.request_attachments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;