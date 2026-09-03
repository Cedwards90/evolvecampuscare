CREATE TABLE public.request_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.support_requests(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_eligible BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX request_line_items_request_id_idx ON public.request_line_items(request_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_line_items TO authenticated;
GRANT ALL ON public.request_line_items TO service_role;

ALTER TABLE public.request_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view line items for accessible requests"
ON public.request_line_items FOR SELECT TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'case_manager') OR public.is_org_admin(auth.uid()))
  AND public.can_staff_access_request(auth.uid(), request_id)
);

CREATE POLICY "Staff can add line items for accessible requests"
ON public.request_line_items FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'case_manager') OR public.is_org_admin(auth.uid()))
  AND public.can_staff_access_request(auth.uid(), request_id)
);

CREATE POLICY "Staff can update line items for accessible requests"
ON public.request_line_items FOR UPDATE TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'case_manager') OR public.is_org_admin(auth.uid()))
  AND public.can_staff_access_request(auth.uid(), request_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'case_manager') OR public.is_org_admin(auth.uid()))
  AND public.can_staff_access_request(auth.uid(), request_id)
);

CREATE POLICY "Staff can delete line items for accessible requests"
ON public.request_line_items FOR DELETE TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'case_manager') OR public.is_org_admin(auth.uid()))
  AND public.can_staff_access_request(auth.uid(), request_id)
);

CREATE TRIGGER update_request_line_items_updated_at
BEFORE UPDATE ON public.request_line_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();