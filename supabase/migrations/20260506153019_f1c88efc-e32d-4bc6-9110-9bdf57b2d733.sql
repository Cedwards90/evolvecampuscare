DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'appointments','file_notes','student_checkins','intake_responses',
    'post_graduation_plans','profiles','organization_memberships','org_admins',
    'training_organizations','qr_codes','qr_scan_events','site_settings',
    'scheduled_survey_distributions','request_share_links','nda_documents','nda_acceptances',
    'support_requests','request_updates','request_attachments','student_assignments',
    'staff_messages','notifications','user_invitations'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;