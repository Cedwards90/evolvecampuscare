
ALTER TABLE public.participant_transfers REPLICA IDENTITY FULL;
ALTER TABLE public.participant_transfer_events REPLICA IDENTITY FULL;
ALTER TABLE public.participant_record_exports REPLICA IDENTITY FULL;
ALTER TABLE public.participant_record_access_log REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.participant_transfers; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.participant_transfer_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.participant_record_exports; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.participant_record_access_log; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
