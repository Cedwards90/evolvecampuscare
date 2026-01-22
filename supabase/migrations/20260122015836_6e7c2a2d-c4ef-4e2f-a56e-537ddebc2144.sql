-- Enable realtime for staff_messages table for instant message notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_messages;