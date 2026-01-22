-- Add RLS policies for admin role management

-- Allow admins to update any user's role
CREATE POLICY "Admins can update user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to insert new roles
CREATE POLICY "Admins can insert user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete roles
CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Promote the first user (wealthyby2025@gmail.com) to admin
UPDATE public.user_roles 
SET role = 'admin'
WHERE user_id = (
  SELECT user_id FROM public.profiles WHERE email = 'wealthyby2025@gmail.com' LIMIT 1
);