ALTER PUBLICATION supabase_realtime ADD TABLE public.student_assignments;
ALTER TABLE public.student_assignments REPLICA IDENTITY FULL;