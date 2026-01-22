-- Create staff_messages table for private communication between case managers and admins
CREATE TABLE public.staff_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    recipient_id UUID NOT NULL,
    student_id UUID, -- Optional: context about which student
    request_id UUID REFERENCES public.support_requests(id) ON DELETE SET NULL,
    subject TEXT,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_messages ENABLE ROW LEVEL SECURITY;

-- RLS: Only staff (case managers and admins) can view their own messages
CREATE POLICY "Staff can view their messages"
    ON public.staff_messages FOR SELECT
    TO authenticated
    USING (
        (sender_id = auth.uid() OR recipient_id = auth.uid()) AND
        (has_role(auth.uid(), 'case_manager') OR has_role(auth.uid(), 'admin'))
    );

-- RLS: Staff can send messages
CREATE POLICY "Staff can send messages"
    ON public.staff_messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid() AND
        (has_role(auth.uid(), 'case_manager') OR has_role(auth.uid(), 'admin'))
    );

-- RLS: Recipients can mark messages as read
CREATE POLICY "Recipients can update read status"
    ON public.staff_messages FOR UPDATE
    TO authenticated
    USING (
        recipient_id = auth.uid() AND
        (has_role(auth.uid(), 'case_manager') OR has_role(auth.uid(), 'admin'))
    );

-- Create index for faster queries
CREATE INDEX idx_staff_messages_sender ON public.staff_messages(sender_id);
CREATE INDEX idx_staff_messages_recipient ON public.staff_messages(recipient_id);
CREATE INDEX idx_staff_messages_created_at ON public.staff_messages(created_at DESC);